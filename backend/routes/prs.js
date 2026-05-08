import express from 'express';
import { Octokit } from '@octokit/rest';
import Cryptr from 'cryptr';
import { protect } from '../middleware/auth.js';
import PullRequest from '../models/PullRequest.js';
import User from '../models/User.js';

const router = express.Router();

// GET /api/prs?state=open&repo=owner/name&days=30
router.get('/', protect, async (req, res) => {
  try {
    const { state, repo, days = 30 } = req.query;
    const since = new Date(Date.now() - parseInt(days) * 24 * 3600 * 1000);
    const filter = { orgId: req.orgId, openedAt: { $gte: since } };
    if (state && state !== 'all') filter.state = state;
    if (repo) filter.repoFullName = repo;

    const prs = await PullRequest.find(filter)
      .sort({ lastActivityAt: -1 })
      .limit(200);
    res.json({ success: true, count: prs.length, data: prs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/prs/bubble-matrix  — D3 bubble data: id, size, color (health), title, author
router.get('/bubble-matrix', protect, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    const total = await PullRequest.countDocuments({ orgId: req.orgId, state: 'open' });
    const prs = await PullRequest.find({ orgId: req.orgId, state: 'open' })
      .select('number title authorUsername authorAvatarUrl linesAdded linesRemoved complexityLabel shipProbability stallProbability stallReason lastActivityAt requestedReviewers repoFullName')
      .sort({ lastActivityAt: -1 })
      .skip(skip)
      .limit(limit);

    const bubbles = prs.map((p) => {
      const size = Math.max(p.linesAdded + p.linesRemoved, 5);
      const hoursSinceActivity = p.lastActivityAt
        ? (Date.now() - p.lastActivityAt) / 3600000
        : 9999;
      const health =
        hoursSinceActivity < 24 ? 'healthy'
        : hoursSinceActivity < 72 ? 'at-risk'
        : 'stalled';
      return {
        id: p._id,
        number: p.number,
        title: p.title,
        author: p.authorUsername,
        authorAvatar: p.authorAvatarUrl,
        size,
        linesAdded: p.linesAdded,
        linesRemoved: p.linesRemoved,
        complexity: p.complexityLabel,
        shipProbability: p.shipProbability,
        stallReason: p.stallReason,
        health,
        hasReviewer: (p.requestedReviewers || []).length > 0,
        reviewers: (p.requestedReviewers || []).map(r => ({
          username: r.username,
          displayName: r.displayName || r.username,
          avatarUrl: r.avatarUrl || '',
          assignmentMethod: r.assignmentMethod || 'github_assigned',
        })),
        repo: p.repoFullName,
      };
    });

    res.json({ success: true, data: bubbles, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/prs/:id/impact
// 1-hop file impact surface. Fetches changed files via GitHub API, then
// scans the repo tree for other files that import those paths via regex.
// Zero new dependencies — uses Octokit + Cryptr already in the stack.
router.get('/:id/impact', protect, async (req, res) => {
  try {
    const pr = await PullRequest.findOne({ _id: req.params.id, orgId: req.orgId });
    if (!pr) return res.status(404).json({ success: false, message: 'PR not found' });

    // Decrypt PAT
    const user = await User.findById(req.user._id);
    if (!user?.githubPatEncrypted) {
      return res.status(400).json({ success: false, message: 'GitHub not connected' });
    }
    const cryptr = new Cryptr(process.env.PAT_ENCRYPTION_KEY || 'fallback_key_change_this');
    const pat = cryptr.decrypt(user.githubPatEncrypted);
    const octokit = new Octokit({ auth: pat });

    const [owner, repoName] = pr.repoFullName.split('/');

    // Step 1: Get changed files for this PR
    let changedFiles = [];
    try {
      const { data } = await octokit.rest.pulls.listFiles({
        owner,
        repo: repoName,
        pull_number: pr.number,
        per_page: 100,
      });
      changedFiles = data.map((f) => f.filename);
    } catch {
      return res.json({
        success: true,
        data: { changedFiles: [], dependents: [], impactScore: 0 },
      });
    }

    // Step 2: Infer service from directory structure — no config needed
    function inferService(filePath) {
      const parts = filePath.split('/');
      if (parts.includes('services')) return parts[parts.indexOf('services') + 1] || 'core';
      if (parts.includes('packages')) return parts[parts.indexOf('packages') + 1] || 'core';
      if (parts.includes('src'))      return parts[parts.indexOf('src') + 1]      || 'core';
      return 'core';
    }

    const changedServices = [...new Set(changedFiles.map(inferService))];

    // Step 3: Scan repo tree for files that import any of the changed paths (1-hop)
    const dependents = [];
    const seenFiles = new Set();

    // Get the full repo file tree once — reuse for all changed files
    let treeFiles = [];
    try {
      const { data: treeData } = await octokit.rest.git.getTree({
        owner,
        repo: repoName,
        tree_sha: 'HEAD',
        recursive: '1',
      });
      treeFiles = (treeData.tree || [])
        .filter((f) => f.type === 'blob' && /\.(ts|js|tsx|jsx)$/.test(f.path || ''))
        .slice(0, 120); // cap to avoid rate limiting
    } catch { /* if tree fetch fails, return what we have */ }

    for (const changedFile of changedFiles.slice(0, 8)) {
      // Build a loose regex: match imports of this file's base name
      const baseName = changedFile.split('/').pop().replace(/\.(ts|js|tsx|jsx)$/, '');
      const escapedBase = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const importPattern = new RegExp(
        `from\\s+['"].*${escapedBase}['"]|require\\(['"].*${escapedBase}['"]\\)`
      );

      for (const candidate of treeFiles) {
        if (seenFiles.has(candidate.path) || candidate.path === changedFile) continue;
        try {
          const { data: fileData } = await octokit.rest.repos.getContent({
            owner,
            repo: repoName,
            path: candidate.path,
          });
          const content = Buffer.from(fileData.content || '', 'base64').toString('utf8');
          if (importPattern.test(content)) {
            seenFiles.add(candidate.path);
            dependents.push({
              path: candidate.path,
              service: inferService(candidate.path),
              importsFrom: changedFile,
            });
          }
        } catch { /* skip unreadable/binary files */ }
      }
    }

    const affectedServices = [...new Set(dependents.map((d) => d.service))];
    const serviceBoundariesCrossed = affectedServices.filter(
      (s) => !changedServices.includes(s)
    );

    // Impact score 0-10
    const impactScore = parseFloat(
      Math.min(
        10,
        dependents.length * 0.3 +
        serviceBoundariesCrossed.length * 2 +
        changedFiles.length * 0.2
      ).toFixed(1)
    );

    // Other open PRs in the same repo (potential conflicts)
    const relatedOpenPRs = await PullRequest.find({
      orgId: req.orgId,
      repoFullName: pr.repoFullName,
      state: 'open',
      _id: { $ne: pr._id },
    }).select('number title authorUsername stallReason').limit(10);

    res.json({
      success: true,
      data: {
        pr: {
          number: pr.number,
          title: pr.title,
          complexity: pr.complexityLabel,
          stallReason: pr.stallReason,
        },
        changedFiles,
        changedServices,
        dependents,
        affectedServices,
        serviceBoundariesCrossed,
        impactScore,
        relatedOpenPRs: relatedOpenPRs.map((p) => ({
          number: p.number,
          title: p.title,
          author: p.authorUsername,
          stallReason: p.stallReason,
        })),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/prs/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const pr = await PullRequest.findOne({ _id: req.params.id, orgId: req.orgId });
    if (!pr) return res.status(404).json({ success: false, message: 'PR not found' });
    res.json({ success: true, data: pr });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/prs/latency-histogram  — distribution of review latencies in hours
router.get('/stats/latency-histogram', protect, async (req, res) => {
  try {
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const merged = await PullRequest.find({
      orgId: req.orgId,
      state: 'merged',
      reviewLatencySeconds: { $ne: null },
    }).select('reviewLatencySeconds').limit(500);

    // Bucket into 0-6h, 6-12h, 12-24h, 24-48h, 48-72h, 72h+
    const buckets = [
      { label: '0–6h',  min: 0,  max: 6,        count: 0 },
      { label: '6–12h', min: 6,  max: 12,       count: 0 },
      { label: '12–24h',min: 12, max: 24,       count: 0 },
      { label: '24–48h',min: 24, max: 48,       count: 0 },
      { label: '48–72h',min: 48, max: 72,       count: 0 },
      { label: '72h+',  min: 72, max: Infinity, count: 0 },
    ];

    for (const pr of merged) {
      const hours = pr.reviewLatencySeconds / 3600;
      const bucket = buckets.find((b) => hours >= b.min && hours < b.max);
      if (bucket) bucket.count++;
    }

    res.json({ success: true, data: buckets });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
