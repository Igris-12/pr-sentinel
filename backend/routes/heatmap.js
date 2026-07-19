import express from 'express';
import { protect } from '../middleware/auth.js';
import PullRequest from '../models/PullRequest.js';
import Contributor from '../models/Contributor.js';

const router = express.Router();

function isRubberStamp(pr) {
  return (pr.reviewDepthScore || 0) < 0.15 && pr.state === 'merged';
}

router.get('/', protect, async (req, res) => {
  try {
    const orgId = req.orgId;
    const days = parseInt(req.query.days) || 30;
    const since = new Date(Date.now() - days * 24 * 3600 * 1000);

    const prFilter = { 
      orgId, 
      $or: [
        { openedAt: { $gte: since } },
        { lastActivityAt: { $gte: since } },
        { mergedAt: { $gte: since } }
      ]
    };
    if (req.query.repoFullName) prFilter.repoFullName = req.query.repoFullName;

    const [allPRs, contributors] = await Promise.all([
      PullRequest.find(prFilter),
      Contributor.find({ orgId })
    ]);

    // Create a mapping of username -> contributor info
    const contributorMap = {};
    for (const c of contributors) {
      contributorMap[c.username] = {
        username: c.username,
        displayName: c.displayName || c.username,
        avatarUrl: c.avatarUrl
      };
    }

    const heatmap = {}; // heatmap[reviewer][author] = cellData

    for (const pr of allPRs) {
      const author = pr.authorUsername;
      if (!author) continue;

      const requestedReviewers = pr.requestedReviewers || [];
      const isRs = isRubberStamp(pr);
      const timeSecs = pr.reviewLatencySeconds || 0;
      const depth = pr.reviewDepthScore || 0;

      for (const rev of requestedReviewers) {
        const reviewer = rev.username;
        if (!reviewer || reviewer === author) continue;

        if (!heatmap[reviewer]) heatmap[reviewer] = {};
        if (!heatmap[reviewer][author]) {
          heatmap[reviewer][author] = {
            count: 0,
            rubberStamps: 0,
            totalTimeSecs: 0,
            totalDepth: 0
          };
        }

        const cell = heatmap[reviewer][author];
        cell.count += 1;
        if (isRs) cell.rubberStamps += 1;
        cell.totalTimeSecs += timeSecs;
        cell.totalDepth += depth;
      }
    }

    // Limit to top 10 most active contributors to avoid overwhelming the UI
    const activityScore = {};
    Object.keys(heatmap).forEach(reviewer => {
      activityScore[reviewer] = (activityScore[reviewer] || 0) + Object.values(heatmap[reviewer]).reduce((s, c) => s + c.count, 0);
    });
    Object.keys(heatmap).forEach(reviewer => {
      Object.keys(heatmap[reviewer]).forEach(author => {
        activityScore[author] = (activityScore[author] || 0) + heatmap[reviewer][author].count;
      });
    });

    const topUsers = Object.keys({ ...contributorMap, ...activityScore })
      .sort((a, b) => (activityScore[b] || 0) - (activityScore[a] || 0))
      .slice(0, 10);

    const activeUsers = new Set(topUsers);
    const nodes = topUsers.map(username =>
      contributorMap[username] || { username, displayName: username, avatarUrl: null }
    );

    // Finalize cell computations (health score)
    const processedHeatmap = {};
    for (const reviewer in heatmap) {
      processedHeatmap[reviewer] = {};
      for (const author in heatmap[reviewer]) {
        const cell = heatmap[reviewer][author];
        const count = cell.count;
        const rubberStampRate = count > 0 ? (cell.rubberStamps / count) : 0;
        const avgTimeHours = count > 0 ? (cell.totalTimeSecs / count / 3600) : 0;
        const avgDepth = count > 0 ? (cell.totalDepth / count) : 0;

        // Health Score logic (0 to 1) higher is healthier
        // Penalty for high rubberStampRate
        const rsScore = Math.max(0, 1 - rubberStampRate); // 0% rs -> 1.0, 100% rs -> 0.0
        const depthScore = Math.min(avgDepth * 1.5, 1); // Depth 0.6 -> 0.9. Depth 0 -> 0.
        
        // Time logic: too fast with low depth is bad (rubber clamp). Too slow is bottleneck. Fast + good depth is ideal.
        // Let's keep it simple for visualization:
        const score = (rsScore * 0.4) + (depthScore * 0.6);

        processedHeatmap[reviewer][author] = {
          count,
          rubberStampRate,
          avgTimeHours: parseFloat(avgTimeHours.toFixed(2)),
          avgDepth: parseFloat(avgDepth.toFixed(2)),
          score: parseFloat(score.toFixed(2))
        };
      }
    }

    // ─── Knowledge Diffusion Score ──────────────────────────────────────────
    const totalDevs = activeUsers.size;
    let totalEntropyScore = 0;
    let totalCoverageScore = 0;
    let activeAuthors = 0;

    for (const author of activeUsers) {
      // Get all reviews DONE FOR this author
      let authorTotalReviews = 0;
      const reviewerCounts = {};
      
      for (const reviewer of activeUsers) {
        if (reviewer === author) continue;
        const cell = processedHeatmap[reviewer]?.[author];
        if (cell && cell.count > 0) {
          reviewerCounts[reviewer] = cell.count;
          authorTotalReviews += cell.count;
        }
      }

      if (authorTotalReviews > 0) {
        activeAuthors++;
        const uniqueReviewers = Object.keys(reviewerCounts).length;
        
        // Coverage Score
        const coverage = totalDevs > 1 ? uniqueReviewers / (totalDevs - 1) : 1;
        totalCoverageScore += Math.min(coverage, 1);

        // Entropy Score
        let entropy = 0;
        for (const r in reviewerCounts) {
          const p = reviewerCounts[r] / authorTotalReviews;
          entropy -= p * Math.log(p);
        }
        
        const maxEntropy = totalDevs > 2 ? Math.log(totalDevs - 1) : 0;
        const entropyScore = maxEntropy > 0 ? (entropy / maxEntropy) : 1;

        totalEntropyScore += Math.min(entropyScore, 1);
      }
    }

    let knowledgeDiffusion = 0;
    let insight = "Not enough data to calculate knowledge diffusion.";

    if (activeAuthors > 0) {
      const avgCoverage = totalCoverageScore / activeAuthors;
      const avgEntropy = totalEntropyScore / activeAuthors;
      
      knowledgeDiffusion = parseFloat(((avgCoverage * 0.4) + (avgEntropy * 0.6)).toFixed(2));
      
      if (knowledgeDiffusion >= 0.7) {
        insight = "Excellent knowledge sharing. Reviews are widely distributed across the team.";
      } else if (knowledgeDiffusion >= 0.4) {
        insight = "Average diffusion. Some distinct reviewer pairings exist, but spread is acceptable.";
      } else {
        let topReviewer = null;
        let maxR = 0;
        for (const r in heatmap) {
          let rc = 0;
          for (const a in heatmap[r]) rc += heatmap[r][a].count;
          if (rc > maxR) { maxR = rc; topReviewer = contributorMap[r]?.displayName || r; }
        }
        insight = topReviewer 
          ? `High Risk: Code knowledge is dangerously concentrated, heavily relying on ${topReviewer.split(' ')[0]}.`
          : "Code knowledge is concentrated in tight silos.";
      }
    }

    res.json({ 
      success: true, 
      data: { 
        nodes, 
        matrix: processedHeatmap,
        metrics: { knowledgeDiffusion, insight }
      } 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
