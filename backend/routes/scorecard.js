import express from 'express';
import { protect } from '../middleware/auth.js';
import PullRequest from '../models/PullRequest.js';
import Contributor from '../models/Contributor.js';

const router = express.Router();

// ─── Helper: determine if a review is a rubber stamp ───────────────────────
// A rubber stamp: approved with 0 comments AND time-to-review < 5 minutes
function isRubberStamp(pr) {
  // We infer rubber stamps from reviewDepthScore < 0.15 on PRs that are merged
  return (pr.reviewDepthScore || 0) < 0.15 && pr.state === 'merged';
}

// ─── Helper: classify complexity for risk scoring ──────────────────────────
function complexityRiskWeight(label) {
  const m = { trivial: 0, low: 0.2, medium: 0.4, high: 0.8, epic: 1.0 };
  return m[label] ?? 0.4;
}

// ─── Build scorecard for one developer ────────────────────────────────────
async function buildScorecard(username, orgId, allPRs, allContributors) {
  const teamSize = Math.max(allContributors.length, 1);

  // PRs this dev authored
  const authored = allPRs.filter((p) => p.authorUsername === username);
  // PRs this dev was assigned as reviewer
  const asReviewer = allPRs.filter((p) =>
    (p.requestedReviewers || []).some((r) => r.username === username)
  );
  // Merged PRs authored by this dev
  const authoredMerged = authored.filter((p) => p.state === 'merged');

  // ── Author metrics ────────────────────────────────────────────────────────
  const totalPRsAuthored = authored.length;
  const avgPRSize =
    authored.length
      ? Math.round(
          authored.reduce((s, p) => s + (p.linesAdded || 0) + (p.linesRemoved || 0), 0) /
            authored.length
        )
      : 0;

  // ── Reviewer metrics ──────────────────────────────────────────────────────
  const totalReviewsGiven = asReviewer.length;

  // Rubber stamp rate
  const rubberStamps = asReviewer.filter(isRubberStamp).length;
  const rubberStampRate = totalReviewsGiven > 0 ? rubberStamps / totalReviewsGiven : 0;

  // Avg review depth score
  const depthScores = asReviewer.filter((p) => p.reviewDepthScore != null);
  const avgReviewDepthScore =
    depthScores.length > 0
      ? parseFloat(
          (depthScores.reduce((s, p) => s + p.reviewDepthScore, 0) / depthScores.length).toFixed(2)
        )
      : 0;

  // Avg time to review (hours)
  const reviewTimes = asReviewer.filter((p) => p.reviewLatencySeconds != null);
  const avgTimeToReviewHours =
    reviewTimes.length > 0
      ? parseFloat(
          (
            reviewTimes.reduce((s, p) => s + p.reviewLatencySeconds, 0) /
            reviewTimes.length /
            3600
          ).toFixed(1)
        )
      : 0;

  // ── Collaboration spread ──────────────────────────────────────────────────
  // Unique authors this dev reviewed
  const uniqueAuthorsReviewed = new Set(asReviewer.map((p) => p.authorUsername)).size;
  // Unique reviewers on this dev's PRs
  const uniqueReviewers = new Set(
    authored.flatMap((p) => (p.requestedReviewers || []).map((r) => r.username))
  ).size;
  const uniqueCollaborators = uniqueAuthorsReviewed + uniqueReviewers;
  const knowledgeDiffusionScore = parseFloat(
    Math.min(uniqueCollaborators / (teamSize * 1.5), 1).toFixed(2)
  );

  // ── Bias / Clique score ───────────────────────────────────────────────────
  // Clique score: how concentrated are reviews around one author?
  // If all reviews go to one person → 1.0 (bad), spread evenly → 0 (good)
  let cliqueScore = 0;
  if (asReviewer.length > 0) {
    const authorCounts = {};
    for (const p of asReviewer) {
      authorCounts[p.authorUsername] = (authorCounts[p.authorUsername] || 0) + 1;
    }
    const counts = Object.values(authorCounts);
    const maxCount = Math.max(...counts);
    cliqueScore = parseFloat((maxCount / asReviewer.length).toFixed(2));
  }

  // Who is the most-reviewed author by this dev?
  let topReviewTarget = null;
  let topReviewTargetPct = 0;
  if (asReviewer.length > 0) {
    const authorCounts = {};
    for (const p of asReviewer) {
      authorCounts[p.authorUsername] = (authorCounts[p.authorUsername] || 0) + 1;
    }
    const sorted = Object.entries(authorCounts).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) {
      topReviewTarget = sorted[0][0];
      topReviewTargetPct = Math.round((sorted[0][1] / asReviewer.length) * 100);
    }
  }

  // ── Risk contribution ─────────────────────────────────────────────────────
  const highRiskApprovals = asReviewer.filter(
    (p) => (p.complexityLabel === 'high' || p.complexityLabel === 'epic') && p.state === 'merged'
  ).length;
  const riskContributionScore =
    totalReviewsGiven > 0
      ? parseFloat((highRiskApprovals / totalReviewsGiven).toFixed(2))
      : 0;

  // Weighted risk: average complexity weight of approved merged PRs
  const mergedReviews = asReviewer.filter((p) => p.state === 'merged');
  const avgRiskWeight =
    mergedReviews.length > 0
      ? parseFloat(
          (
            mergedReviews.reduce((s, p) => s + complexityRiskWeight(p.complexityLabel), 0) /
            mergedReviews.length
          ).toFixed(2)
        )
      : 0;

  // ── Active review load ────────────────────────────────────────────────────
  const openPRs = allPRs.filter((p) => p.state === 'open');
  const activeReviewLoad = openPRs.filter((p) =>
    (p.requestedReviewers || []).some((r) => r.username === username)
  ).length;

  // ── Contributor base data ─────────────────────────────────────────────────
  const contributor = allContributors.find((c) => c.username === username);

  // ── Speed vs Quality ──────────────────────────────────────────────────────
  // Fast = avgTimeToReviewHours < 2; Thorough = avgReviewDepthScore > 0.6
  let speedQualityLabel = 'Balanced';
  const isFast = avgTimeToReviewHours > 0 && avgTimeToReviewHours < 2;
  const isThorough = avgReviewDepthScore > 0.6;
  if (isFast && isThorough) speedQualityLabel = 'Fast & Thorough ✅';
  else if (isFast && !isThorough) speedQualityLabel = 'Fast but Shallow ⚠️';
  else if (!isFast && isThorough) speedQualityLabel = 'Slow but Detailed 🤔';
  else if (avgTimeToReviewHours === 0 && avgReviewDepthScore === 0) speedQualityLabel = 'No Reviews Yet';

  // ── Avg cycle time authored ───────────────────────────────────────────────
  const cycleValues = authoredMerged.filter((p) => p.cycleTimeSeconds);
  const avgCycleTimeHours =
    cycleValues.length > 0
      ? parseFloat(
          (cycleValues.reduce((s, p) => s + p.cycleTimeSeconds, 0) / cycleValues.length / 3600).toFixed(1)
        )
      : 0;

  // ── Radar dimensions (0-1 normalized) ────────────────────────────────────
  const radar = {
    reviewQuality: Math.min(avgReviewDepthScore, 1),
    fairness: parseFloat(Math.max(0, 1 - cliqueScore).toFixed(2)),
    collaboration: knowledgeDiffusionScore,
    riskAwareness: parseFloat(Math.max(0, 1 - avgRiskWeight).toFixed(2)),
    loadBalance: parseFloat(Math.max(0, 1 - Math.min(activeReviewLoad / 10, 1)).toFixed(2)),
    speed: avgTimeToReviewHours > 0
      ? parseFloat(Math.max(0, 1 - Math.min(avgTimeToReviewHours / 24, 1)).toFixed(2))
      : 0.5,
  };

  // ── Auto-generated insights ────────────────────────────────────────────────
  const insights = [];

  if (rubberStampRate > 0.4) {
    insights.push({
      type: 'warning',
      text: `Higher-than-average rubber stamp rate (${Math.round(rubberStampRate * 100)}%) — approvals may lack depth`,
    });
  } else if (rubberStampRate < 0.15 && totalReviewsGiven > 3) {
    insights.push({ type: 'positive', text: 'Low rubber stamp rate — reviews consistently include meaningful feedback' });
  }

  if (cliqueScore > 0.6 && topReviewTarget && topReviewTargetPct > 50) {
    insights.push({
      type: 'warning',
      text: `Reviews heavily concentrated on @${topReviewTarget}'s PRs (${topReviewTargetPct}%) — consider broader review distribution`,
    });
  } else if (cliqueScore < 0.4 && totalReviewsGiven > 3) {
    insights.push({ type: 'positive', text: 'Healthy reviewer distribution across the team' });
  }

  if (avgReviewDepthScore > 0.7 && totalReviewsGiven > 3) {
    insights.push({ type: 'positive', text: 'High-quality reviewer — provides detailed, actionable feedback' });
  }

  if (activeReviewLoad > 7) {
    insights.push({
      type: 'warning',
      text: `Review load is above team average (${activeReviewLoad} open PRs) — may affect review quality`,
    });
  }

  if (highRiskApprovals > 3) {
    insights.push({
      type: 'warning',
      text: `Approved ${highRiskApprovals} high-complexity PRs — verify risk awareness on large changesets`,
    });
  }

  if (knowledgeDiffusionScore > 0.65) {
    insights.push({ type: 'positive', text: 'Strong cross-team collaboration and knowledge sharing' });
  } else if (knowledgeDiffusionScore < 0.3 && totalReviewsGiven > 3) {
    insights.push({ type: 'info', text: 'Collaboration spread is narrow — most interactions within a small group' });
  }

  if (isFast && isThorough) {
    insights.push({ type: 'positive', text: 'Excellent speed-quality balance — fast and thorough reviews' });
  } else if (isFast && !isThorough && totalReviewsGiven > 3) {
    insights.push({ type: 'warning', text: 'Review speed is high but depth scores suggest shallow feedback' });
  }

  if (insights.length === 0) {
    insights.push({ type: 'info', text: 'Not enough review data to generate behavioral insights yet' });
  }

  return {
    username,
    displayName: contributor?.displayName || username,
    avatarUrl: contributor?.avatarUrl || null,

    // Activity
    totalPRsAuthored,
    totalReviewsGiven,
    avgPRSize,
    avgCycleTimeHours,

    // Review quality
    avgReviewDepthScore,
    avgTimeToReviewHours,
    rubberStampRate: parseFloat(rubberStampRate.toFixed(2)),
    rubberStampCount: rubberStamps,

    // Bias & fairness
    cliqueScore,
    topReviewTarget,
    topReviewTargetPct,

    // Collaboration
    uniqueReviewers,
    uniqueAuthorsReviewed,
    uniqueCollaborators,
    knowledgeDiffusionScore,

    // Risk
    highRiskApprovals,
    riskContributionScore,
    avgRiskWeight,

    // Load
    activeReviewLoad,

    // Derived
    speedQualityLabel,
    radar,
    insights,
  };
}

// ─── GET /api/scorecard  — all developers ─────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    const orgId = req.orgId;
    const days = parseInt(req.query.days) || 30;
    const since = new Date(Date.now() - days * 24 * 3600 * 1000);

    const prFilter = { orgId, openedAt: { $gte: since } };
    if (req.query.repoFullName) prFilter.repoFullName = req.query.repoFullName;

    const [allPRs, allContributors] = await Promise.all([
      PullRequest.find(prFilter),
      Contributor.find({ orgId }),
    ]);

    // Collect all active usernames
    const usernamesFromPRs = new Set([
      ...allPRs.map((p) => p.authorUsername).filter(Boolean),
      ...allPRs.flatMap((p) => (p.requestedReviewers || []).map((r) => r.username)),
    ]);

    const scorecards = await Promise.all(
      [...usernamesFromPRs].map((u) => buildScorecard(u, orgId, allPRs, allContributors))
    );

    // Sort by total activity desc
    scorecards.sort(
      (a, b) => b.totalPRsAuthored + b.totalReviewsGiven - (a.totalPRsAuthored + a.totalReviewsGiven)
    );

    res.json({ success: true, count: scorecards.length, data: scorecards });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/scorecard/compare/two?a=alice&b=bob  — side-by-side ──────
// IMPORTANT: must come BEFORE /:username or Express will treat 'compare' as a username
router.get('/compare/two', protect, async (req, res) => {
  try {
    const orgId = req.orgId;
    const { a, b } = req.query;
    if (!a || !b) return res.status(400).json({ success: false, message: 'Provide ?a=user1&b=user2' });

    const days = parseInt(req.query.days) || 30;
    const since = new Date(Date.now() - days * 24 * 3600 * 1000);

    const prFilter = { orgId, openedAt: { $gte: since } };
    if (req.query.repoFullName) prFilter.repoFullName = req.query.repoFullName;

    const [allPRs, allContributors] = await Promise.all([
      PullRequest.find(prFilter),
      Contributor.find({ orgId }),
    ]);

    const [cardA, cardB] = await Promise.all([
      buildScorecard(a, orgId, allPRs, allContributors),
      buildScorecard(b, orgId, allPRs, allContributors),
    ]);

    res.json({ success: true, data: { a: cardA, b: cardB } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/scorecard/:username  — single developer ─────────────────────
router.get('/:username', protect, async (req, res) => {
  try {
    const orgId = req.orgId;
    const { username } = req.params;
    const days = parseInt(req.query.days) || 30;
    const since = new Date(Date.now() - days * 24 * 3600 * 1000);

    const prFilter = { orgId, openedAt: { $gte: since } };
    if (req.query.repoFullName) prFilter.repoFullName = req.query.repoFullName;

    const [allPRs, allContributors] = await Promise.all([
      PullRequest.find(prFilter),
      Contributor.find({ orgId }),
    ]);

    const scorecard = await buildScorecard(username, orgId, allPRs, allContributors);
    res.json({ success: true, data: scorecard });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
