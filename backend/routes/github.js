import express from 'express';
import { Octokit } from '@octokit/rest';
import Cryptr from 'cryptr';
import { protect } from '../middleware/auth.js';
import User from '../models/User.js';
import Repository from '../models/Repository.js';
import { syncRepository } from '../scripts/syncGitHub.js';
import logger from '../config/logger.js';

const router = express.Router();

const getCryptr = () => new Cryptr(process.env.PAT_ENCRYPTION_KEY || 'fallback_key_change_this');

// POST /api/github/connect-pat  — save PAT and verify it works
router.post('/connect-pat', protect, async (req, res) => {
  try {
    const { pat } = req.body;
    if (!pat) return res.status(400).json({ success: false, message: 'PAT required' });

    // Verify the PAT works
    const octokit = new Octokit({ auth: pat });
    let ghUser;
    try {
      const { data } = await octokit.rest.users.getAuthenticated();
      ghUser = data;
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid GitHub token — check your PAT' });
    }

    const cryptr = getCryptr();
    const encrypted = cryptr.encrypt(pat);

    await User.findByIdAndUpdate(req.user._id, {
      githubPatEncrypted: encrypted,
      githubUsername: ghUser.login,
    });

    res.json({
      success: true,
      message: 'GitHub connected',
      githubUsername: ghUser.login,
      avatar: ghUser.avatar_url,
    });
  } catch (err) {
    logger.error('connect-pat error', { error: err.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/github/repos  — list repos accessible with the stored PAT
router.get('/repos', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user.githubPatEncrypted) {
      return res.json({ success: true, repos: [] }); // Soft fail if no PAT, allow empty state for public connection
    }
    const cryptr = getCryptr();
    const pat = cryptr.decrypt(user.githubPatEncrypted);
    const octokit = new Octokit({ auth: pat });

    const { data } = await octokit.rest.repos.listForAuthenticatedUser({
      sort: 'updated',
      per_page: 50,
    });

    const repos = data.map((r) => ({
      id: r.id,
      fullName: r.full_name,
      owner: r.owner.login,
      name: r.name,
      defaultBranch: r.default_branch,
      private: r.private,
      description: r.description,
      language: r.language,
      stars: r.stargazers_count,
      updatedAt: r.updated_at,
    }));

    res.json({ success: true, repos });
  } catch (err) {
    logger.error('list repos error', { error: err.message });
    res.status(500).json({ success: false, message: 'Failed to fetch repos' });
  }
});

// POST /api/github/add-repo  — connect a repo (start syncing it)
router.post('/add-repo', protect, async (req, res) => {
  try {
    const { owner, name, fullName, defaultBranch } = req.body;
    if (!owner || !name) return res.status(400).json({ success: false, message: 'owner and name required' });

    const existing = await Repository.findOne({ orgId: req.orgId, fullName });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Repository already connected' });
    }

    const repo = await Repository.create({
      orgId: req.orgId,
      owner,
      name,
      fullName: fullName || `${owner}/${name}`,
      defaultBranch: defaultBranch || 'main',
      addedBy: req.user._id,
    });

    // Kick off async sync (don't await — respond immediately)
    const user = await User.findById(req.user._id);
    const cryptr = getCryptr();
    const pat = user.githubPatEncrypted ? cryptr.decrypt(user.githubPatEncrypted) : null;
    syncRepository(repo, pat, req.orgId).catch((e) =>
      logger.error('Background sync failed', { repo: fullName, error: e.message })
    );

    res.status(201).json({ success: true, repo });
  } catch (err) {
    logger.error('add-repo error', { error: err.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/github/connected-repos  — list repos already added
router.get('/connected-repos', protect, async (req, res) => {
  try {
    const repos = await Repository.find({ orgId: req.orgId, isActive: true }).sort({ createdAt: -1 });
    res.json({ success: true, repos });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/github/sync/:repoId  — manually trigger a re-sync
router.post('/sync/:repoId', protect, async (req, res) => {
  try {
    const repo = await Repository.findOne({ _id: req.params.repoId, orgId: req.orgId });
    if (!repo) return res.status(404).json({ success: false, message: 'Repo not found' });

    const user = await User.findById(req.user._id);
    const cryptr = getCryptr();
    const pat = user.githubPatEncrypted ? cryptr.decrypt(user.githubPatEncrypted) : null;

    res.json({ success: true, message: 'Sync started' });
    syncRepository(repo, pat, req.orgId).catch((e) =>
      logger.error('Manual sync failed', { repo: repo.fullName, error: e.message })
    )
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/github/sync-all  — manually trigger re-sync for ALL connected repos in org
router.post('/sync-all', protect, async (req, res) => {
  try {
    const repos = await Repository.find({ orgId: req.orgId });
    if (!repos.length) return res.status(400).json({ success: false, message: 'No repositories connected. Go to Connect Repo first.' });

    const user = await User.findById(req.user._id);
    const cryptr = getCryptr();
    const pat = user.githubPatEncrypted ? cryptr.decrypt(user.githubPatEncrypted) : null;

    // Respond immediately so UI isn't blocked
    res.json({ success: true, message: `Sync started for ${repos.length} repo(s)` });

    for (const repo of repos) {
      syncRepository(repo, pat, req.orgId).catch((e) => {
        logger.error('Manual complete sync failed', { repo: repo.fullName, error: e.message, stack: e.stack });
      });
    }
  } catch (err) {
    logger.error('sync-all route error', { error: err.message });
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
