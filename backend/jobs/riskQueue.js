import { Queue, Worker } from 'bullmq';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { Octokit } from '@octokit/rest';
import { retry } from '@octokit/plugin-retry';
import Cryptr from 'cryptr';
import connection from '../config/redis.js';
import logger from '../config/logger.js';
import PullRequest from '../models/PullRequest.js';
import RiskAnalysis from '../models/RiskAnalysis.js';
import Repository from '../models/Repository.js';
import User from '../models/User.js';

const QUEUE_NAME = 'riskQueue';
const SIDECAR_URL = process.env.SIDECAR_URL || 'http://localhost:8000';
const getCryptr = () => new Cryptr(process.env.PAT_ENCRYPTION_KEY || 'fallback_key_change_this');

export const riskQueue = new Queue(QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: true,
  },
});

export const riskWorker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const { prId, prNumber, repoId, orgId, owner, repoName, authToken } = job.data;

    // 0. JWT Validation (Hard Constraint)
    if (!authToken) {
      logger.error(`[Worker] Missing authToken for job ${job.id}`);
      throw new Error('Authentication required');
    }
    try {
      jwt.verify(authToken, process.env.JWT_SECRET);
    } catch (err) {
      logger.error(`[Worker] Invalid authToken for job ${job.id}: ${err.message}`);
      throw new Error('Invalid authentication token');
    }

    logger.info(`[Worker] Processing risk analysis for PR #${prNumber} in ${owner}/${repoName}`);

    try {
      // 1. Get PAT for the repository
      const repo = await Repository.findById(repoId);
      if (!repo) throw new Error(`Repository ${repoId} not found`);

      let pat = null;
      if (repo.addedBy) {
        const user = await User.findById(repo.addedBy);
        if (user && user.githubPatEncrypted) {
          const cryptr = getCryptr();
          pat = cryptr.decrypt(user.githubPatEncrypted);
        }
      }

      // If no PAT found, fallback to system token or anonymous
      const activePat = pat || process.env.GITHUB_SYSTEM_TOKEN;
      
      const MyOctokit = Octokit.plugin(retry);
      const octokit = new MyOctokit({
        auth: activePat,
        request: { retries: 3, retryAfter: 1 },
        retry: { doNotRetry: [400, 401, 403, 404, 422] },
      });

      // 2. Fetch the diff from GitHub
      logger.debug(`[Worker] Fetching diff for PR #${prNumber}`);
      const { data: diff } = await octokit.rest.pulls.get({
        owner,
        repo: repoName,
        pull_number: prNumber,
        headers: { accept: 'application/vnd.github.v3.diff' },
      });

      // 3. Call the Python sidecar for AI analysis
      logger.info(`[Worker] Sending diff to sidecar at ${SIDECAR_URL}/api/analyze`);
      const response = await axios.post(`${SIDECAR_URL}/api/analyze`, { diff });
      const analysis = response.data;

      // 4. Save analysis results to MongoDB
      logger.debug(`[Worker] Saving analysis results for PR #${prNumber}`);
      const ra = await RiskAnalysis.findOneAndUpdate(
        { prId },
        {
          ...analysis,
          prId,
          githubPrNumber: prNumber,
          repoId,
          orgId,
        },
        { upsert: true, new: true }
      );

      // 5. Update PullRequest model with key risk metrics
      await PullRequest.findByIdAndUpdate(prId, {
        riskScore: analysis.riskScore,
        riskLabel: analysis.riskLabel,
        riskAnalysisId: ra._id,
      });

      // 6. Post the Risk Assessment comment to GitHub
      logger.info(`[Worker] Posting risk assessment comment to PR #${prNumber}`);
      const commentBody = formatRiskComment(analysis);
      const commentResponse = await octokit.rest.issues.createComment({
        owner,
        repo: repoName,
        issue_number: prNumber,
        body: commentBody,
      });

      await PullRequest.findByIdAndUpdate(prId, {
        botCommentPosted: true,
        botCommentId: String(commentResponse.data.id),
      });

      logger.info(`[Worker] Risk analysis completed and posted for PR #${prNumber}. Score: ${analysis.riskScore} (${analysis.riskLabel})`);
      return { success: true, riskScore: analysis.riskScore, commentId: commentResponse.data.id };

    } catch (err) {
      logger.error(`[Worker] Error analyzing PR #${prNumber}: ${err.message}`, { stack: err.stack });
      throw err; // Re-throw to trigger BullMQ retry
    }
  },
  { 
    connection,
    concurrency: 2 // Handle up to 2 analysis jobs in parallel
  }
);

/**
 * Format the RiskAnalysis data into a GitHub-friendly markdown comment
 */
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

riskWorker.on('completed', (job) => {
  logger.info(`[Worker] Job ${job.id} completed successfully`);
});

riskWorker.on('failed', (job, err) => {
  logger.error(`[Worker] Job ${job.id} failed after retries`, { error: err.message });
});
