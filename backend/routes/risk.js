import express from 'express';
import axios from 'axios';
import { Octokit } from '@octokit/rest';
import { retry } from '@octokit/plugin-retry';
import Cryptr from 'cryptr';
import { protect } from '../middleware/auth.js';
import PullRequest from '../models/PullRequest.js';
import RiskAnalysis from '../models/RiskAnalysis.js';
import Repository from '../models/Repository.js';
import User from '../models/User.js';
import logger from '../config/logger.js';

const router = express.Router();

/**
 * GET /api/risk/:prId
 * Returns detailed risk analysis for a specific PR.
 */
router.get('/:prId', protect, async (req, res) => {
  try {
    const { prId } = req.params;
    
    // Ensure the PR belongs to the user's organization
    const pr = await PullRequest.findOne({ _id: prId, orgId: req.orgId });
    if (!pr) {
      return res.status(404).json({ success: false, message: 'PR not found' });
    }

    // Find the latest risk analysis for this PR
    const analysis = await RiskAnalysis.findOne({ prId })
      .sort({ analyzedAt: -1 })
      .lean();

    if (!analysis) {
      return res.json({ 
        success: true, 
        data: {
          pr,
          analysis: null,
          message: 'No risk analysis available yet.'
        }
      });
    }

    res.json({
      success: true,
      data: {
        pr,
        analysis
      }
    });
  } catch (err) {
    logger.error('Fetch risk detail error', { error: err.message, prId: req.params.prId });
    res.status(500).json({ success: false, message: 'Failed to load risk details' });
  }
});

/**
 * POST /api/risk/:prId/analyze
 * Triggers a live AI analysis of the PR.
 */
router.post('/:prId/analyze', protect, async (req, res) => {
  try {
    const { prId } = req.params;
    const pr = await PullRequest.findOne({ _id: prId, orgId: req.orgId });
    if (!pr) return res.status(404).json({ success: false, message: 'PR not found' });

    const SIDECAR_URL = process.env.SIDECAR_URL || 'http://localhost:8000';

    // 1. Get PAT for the repository
    const repo = await Repository.findById(pr.repoId);
    let pat = null;
    if (repo && repo.addedBy) {
      const user = await User.findById(repo.addedBy);
      if (user && user.githubPatEncrypted) {
        const cryptr = new Cryptr(process.env.PAT_ENCRYPTION_KEY || 'fallback_key_change_this');
        pat = cryptr.decrypt(user.githubPatEncrypted);
      }
    }
    const activePat = pat || process.env.GITHUB_SYSTEM_TOKEN;
    const MyOctokit = Octokit.plugin(retry);
    const octokit = new MyOctokit({
      auth: activePat,
      request: { retries: 3, retryAfter: 1 },
      retry: { doNotRetry: [400, 401, 403, 404, 422] },
    });

    const [owner, repoName] = pr.repoFullName.split('/');

    // 2. Fetch the diff from GitHub
    logger.debug(`[API] Fetching diff for PR #${pr.number} live`);
    const { data: diff } = await octokit.rest.pulls.get({
      owner,
      repo: repoName,
      pull_number: pr.number,
      headers: { accept: 'application/vnd.github.v3.diff' },
    });

    // 3. Call the Python sidecar for AI analysis
    logger.info(`[API] Sending diff to sidecar at ${SIDECAR_URL}/api/analyze live`);
    const response = await axios.post(`${SIDECAR_URL}/api/analyze`, { diff });
    const analysis = response.data;

    // 4. Save analysis results to MongoDB
    const ra = await RiskAnalysis.findOneAndUpdate(
      { prId },
      {
        ...analysis,
        prId,
        githubPrNumber: pr.number,
        repoId: pr.repoId,
        orgId: req.orgId,
      },
      { upsert: true, new: true }
    );

    // 5. Update PullRequest model
    await PullRequest.findByIdAndUpdate(prId, {
      riskScore: analysis.riskScore,
      riskLabel: analysis.riskLabel,
      riskAnalysisId: ra._id,
    });

    // 6. Fire-and-forget GitHub comment
    const commentBody = formatRiskComment(analysis);
    octokit.rest.issues.createComment({
      owner,
      repo: repoName,
      issue_number: pr.number,
      body: commentBody,
    }).then(async (commentResponse) => {
       await PullRequest.findByIdAndUpdate(prId, {
          botCommentPosted: true,
          botCommentId: String(commentResponse.data.id),
        });
    }).catch(err => {
      logger.warn(`[API] Could not post comment to PR #${pr.number} (Likely a public repo without write access). Skipping comment.`);
    });

    res.json({
      success: true,
      data: {
        pr: await PullRequest.findById(prId),
        analysis: ra
      }
    });

  } catch (err) {
    logger.error('Live risk analysis error', { error: err.message, prId: req.params.prId, stack: err.stack });
    res.status(500).json({ success: false, message: 'Failed to generate live risk analysis: ' + err.message });
  }
});

function formatRiskComment(analysis) {
  const score = analysis.riskScore.toFixed(1);
  const label = analysis.riskLabel;
  const labelEmoji = {
    'LOW': '✅',
    'MEDIUM': '⚠️',
    'HIGH': '🟠',
    'CRITICAL': '🚨'
  }[label] || '🔍';

  let body = `## ${labelEmoji} PRSentinel Risk Assessment: ${label} (${score}/10.0)\n\n`;
  
  if (analysis.rationale && analysis.rationale.length > 0) {
    body += `### Rationale\n${analysis.rationale.map(r => `- ${r}`).join('\n')}\n\n`;
  }

  if (analysis.radar) {
    body += `### Risk Dimensions\n`;
    body += `- **Logic Complexity:** ${analysis.radar.logicRisk}/10\n`;
    body += `- **Dependency Risk:** ${analysis.radar.dependencyRisk}/10\n`;
    body += `- **Data Exposure:** ${analysis.radar.dataExposure}/10\n`;
    body += `- **Testing Coverage:** ${analysis.radar.testingCoverage}/10\n\n`;
  }

  if (analysis.staticMetrics) {
    body += `### Static Analysis\n`;
    body += `- **Files Changed:** ${analysis.staticMetrics.filesChanged}\n`;
    body += `- **Lines Added:** +${analysis.staticMetrics.linesAdded}\n`;
    body += `- **Lines Removed:** -${analysis.staticMetrics.linesRemoved}\n\n`;
  }

  body += `*Confidence: ${Math.round(analysis.confidence * 100)}% | Model: ${analysis.geminiModelVersion}*`;
  
  return body;
}

export default router;
