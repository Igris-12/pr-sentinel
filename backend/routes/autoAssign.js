import express from 'express';
import { Octokit } from '@octokit/rest';
import Cryptr from 'cryptr';
import { protect } from '../middleware/auth.js';
import PullRequest from '../models/PullRequest.js';
import Contributor from '../models/Contributor.js';
import User from '../models/User.js';
import logger from '../config/logger.js';
import { getIO } from '../socket/index.js';

const router = express.Router();

const getCryptr = () => new Cryptr(process.env.PAT_ENCRYPTION_KEY || 'fallback_key_change_this');

/**
 * POST /api/auto-assign/:prId
 *
 * Cascade assignment system:
 *   1. Find eligible reviewer (lowest load, not the PR author)
 *   2. Try GitHub API assignment (pulls.requestReviewers)
 *   3. Fallback: post a comment tagging the reviewer
 *   4. Fallback: emit socket notification to the reviewer
 *
 * ✅ ALWAYS saves the reviewer to MongoDB (PullRequest.requestedReviewers)
 * regardless of which cascade step succeeded — so data survives page refresh.
 */
router.post('/:prId', protect, async (req, res) => {
  try {
    const { prId } = req.params;

    // 1. Find the PR
    const pr = await PullRequest.findOne({ _id: prId, orgId: req.orgId });
    if (!pr) {
      return res.status(404).json({ success: false, message: 'PR not found' });
    }

    // 2. Get user's PAT
    const user = await User.findById(req.user._id);
    if (!user?.githubPatEncrypted) {
      return res.status(400).json({ success: false, message: 'GitHub not connected' });
    }
    const cryptr = getCryptr();
    const pat = cryptr.decrypt(user.githubPatEncrypted);
    const octokit = new Octokit({ auth: pat });

    // 3. Find eligible reviewers (not the PR author, lowest load)
    const contributors = await Contributor.find({
      orgId: req.orgId,
      username: { $ne: pr.authorUsername },
    }).sort({ reviewerLoadIndex: 1, totalReviewsThisWeek: 1 });

    if (contributors.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No eligible reviewers found. Add team members first.',
      });
    }

    const reviewer = contributors[0];
    const [owner, repoName] = pr.repoFullName.split('/');
    let assignmentMethod = 'none';
    let fallbackUsed = false;

    // ── CASCADE STEP 1: Try formal GitHub assignment ──
    try {
      await octokit.rest.pulls.requestReviewers({
        owner,
        repo: repoName,
        pull_number: pr.number,
        reviewers: [reviewer.username],
      });
      assignmentMethod = 'github_assigned';
      logger.info(`Auto-assigned reviewer ${reviewer.username} to PR #${pr.number} via GitHub API`);
    } catch (ghErr) {
      logger.warn(`GitHub assignment failed for PR #${pr.number}: ${ghErr.message}. Falling back to comment.`);
      fallbackUsed = true;

      // ── CASCADE STEP 2: Post a comment tagging the reviewer ──
      try {
        await octokit.rest.issues.createComment({
          owner,
          repo: repoName,
          issue_number: pr.number,
          body: `👋 @${reviewer.username}, you've been auto-assigned to review this PR by **FlowMetric**.\n\n` +
                `> _This reviewer was selected based on load-balancing — they currently have the lowest active review queue._\n\n` +
                `Please review when you get a chance! 🚀`,
        });
        assignmentMethod = 'comment_tagged';
        logger.info(`Tagged reviewer ${reviewer.username} via comment on PR #${pr.number}`);
      } catch (commentErr) {
        logger.warn(`Comment fallback also failed for PR #${pr.number}: ${commentErr.message}. Using socket notification.`);
        assignmentMethod = 'socket_notified';
      }

      // ── CASCADE STEP 3: Always send socket notification as final guarantee ──
      try {
        const io = getIO();
        if (io) {
          io.to(`org:${req.orgId}`).emit('notification', {
            id: Date.now(),
            category: 'pr_review',
            title: '🔔 Review Requested',
            body: `You've been assigned to review PR #${pr.number}: "${pr.title}" in ${pr.repoFullName}. Reviewer: @${reviewer.username}`,
            color: '#f59e0b',
            time: new Date().toLocaleTimeString(),
            date: new Date().toLocaleDateString(),
            read: false,
            timestamp: new Date().toISOString(),
          });
          logger.info(`Socket notification sent for reviewer ${reviewer.username} on PR #${pr.number}`);
        }
      } catch (socketErr) {
        logger.error(`Socket notification failed: ${socketErr.message}`);
      }
    }

    // ── ALWAYS: Save reviewer to MongoDB so it survives page refresh ──
    // This runs regardless of which cascade step succeeded.
    await PullRequest.findByIdAndUpdate(pr._id, {
      $addToSet: {
        requestedReviewers: {
          username: reviewer.username,
          avatarUrl: reviewer.avatarUrl || '',
          displayName: reviewer.displayName || reviewer.username,
          assignmentMethod,
          assignedAt: new Date(),
        },
      },
      stallReason: null,
    });
    logger.info(`Reviewer ${reviewer.username} saved to MongoDB for PR #${pr.number} (method: ${assignmentMethod})`);

    // Update reviewer load index
    await Contributor.findByIdAndUpdate(reviewer._id, {
      $inc: { reviewerLoadIndex: 1 },
    });

    res.json({
      success: true,
      message: `Reviewer assigned via ${assignmentMethod.replace(/_/g, ' ')}`,
      data: {
        reviewer: {
          username: reviewer.username,
          displayName: reviewer.displayName || reviewer.username,
          avatarUrl: reviewer.avatarUrl,
        },
        pr: {
          number: pr.number,
          title: pr.title,
          repo: pr.repoFullName,
        },
        method: assignmentMethod,
        fallbackUsed,
      },
    });
  } catch (err) {
    logger.error('Auto-assign error', { error: err.message, stack: err.stack });
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

export default router;
