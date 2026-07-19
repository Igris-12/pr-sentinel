import express from 'express';
import { protect } from '../middleware/auth.js';
import PullRequest from '../models/PullRequest.js';
import MetricSnapshot from '../models/MetricSnapshot.js';
import Repository from '../models/Repository.js';

const router = express.Router();

// Helper: parse date range from query
function getDateRange(query) {
  const days = parseInt(query.days) || 30;
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);
  return since;
}

// GET /api/metrics/dashboard  — main dashboard aggregation
router.get('/dashboard', protect, async (req, res) => {
  try {
    const since = getDateRange(req.query);
    const orgId = req.orgId;
    const filter = { orgId };

    if (req.query.repoFullName) {
      const repo = await Repository.findOne({ fullName: req.query.repoFullName, orgId });
      if (repo) filter.repoId = repo._id;
    }

    const prs = await PullRequest.find({
      ...filter,
      $or: [
        { openedAt: { $gte: since } },
        { mergedAt: { $gte: since } },
        { closedAt: { $gte: since } },
      ],
    });
    const merged = prs.filter((p) => p.state === 'merged');
    const open = prs.filter((p) => p.state === 'open');

    // Cycle time (seconds → hours)
    const ctValues = merged.filter((p) => p.cycleTimeSeconds).map((p) => p.cycleTimeSeconds / 3600);
    const avgCycleTimeHours = ctValues.length
      ? parseFloat((ctValues.reduce((a, b) => a + b, 0) / ctValues.length).toFixed(1))
      : 0;

    // Review latency
    const rlValues = merged.filter((p) => p.reviewLatencySeconds).map((p) => p.reviewLatencySeconds / 3600);
    const avgReviewLatencyHours = rlValues.length
      ? parseFloat((rlValues.reduce((a, b) => a + b, 0) / rlValues.length).toFixed(1))
      : 0;

    // Throughput — PRs merged per week
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const merged7d = merged.filter((p) => p.mergedAt && p.mergedAt >= sevenDaysAgo).length;

    // Churn rate
    const avgChurn = prs.length
      ? parseFloat((prs.reduce((s, p) => s + (p.churnRate || 0), 0) / prs.length).toFixed(2))
      : 0;

    // WIP (open, non-draft)
    const wip = open.filter((p) => !p.isDraft);
    const wipByStage = {
      draft: open.filter((p) => p.isDraft).length,
      inReview: wip.filter((p) => p.requestedReviewers?.length > 0).length,
      waitingForReviewer: wip.filter((p) => !p.requestedReviewers?.length).length,
    };

    // ── Sprint Health Score (real-time weighted calculation) ──
    // If a MetricSnapshot exists, use it; otherwise calculate live from PR data.
    const snapshotFilter = { orgId };
    if (req.query.repoFullName) {
      const repo = await Repository.findOne({ fullName: req.query.repoFullName, orgId });
      if (repo) snapshotFilter.repoId = repo._id;
    }
    const latestSnapshot = await MetricSnapshot.findOne(snapshotFilter).sort({ date: -1 });
    let sprintHealthScore = latestSnapshot?.sprintHealthScore ?? null;

    if (sprintHealthScore == null) {
      if (prs.length === 0) {
        sprintHealthScore = null;
      } else {
        // Calculate live sprint health from current data
        // 1. Throughput score (30%) — target: ≥5 PRs merged/week = 100
        const throughputScore = Math.min(100, (merged7d / Math.max(1, 5)) * 100);

        // 2. Cycle time score (25%) — target: <24h = 100, >72h = 0
        const ctScore = avgCycleTimeHours <= 0
          ? 50 // neutral if no data
          : avgCycleTimeHours <= 24
            ? 100
            : avgCycleTimeHours >= 72
              ? 0
              : Math.round(100 - ((avgCycleTimeHours - 24) / 48) * 100);

        // 3. Review latency score (20%) — target: <4h = 100, >24h = 0
        const rlScore = avgReviewLatencyHours <= 0
          ? 50
          : avgReviewLatencyHours <= 4
            ? 100
            : avgReviewLatencyHours >= 24
              ? 0
              : Math.round(100 - ((avgReviewLatencyHours - 4) / 20) * 100);

        // 4. Churn rate score (15%) — target: 0 = 100, >0.5 = 0
        const churnScore = avgChurn <= 0
          ? 100
          : avgChurn >= 0.5
            ? 0
            : Math.round(100 - (avgChurn / 0.5) * 100);

        // 5. WIP balance score (10%) — target: 2-4 open PRs = 100, >8 = 0
        const openCount = open.length;
        const wipScore = openCount <= 4
          ? 100
          : openCount >= 8
            ? 0
            : Math.round(100 - ((openCount - 4) / 4) * 100);

        sprintHealthScore = Math.round(
          throughputScore * 0.30 +
          ctScore * 0.25 +
          rlScore * 0.20 +
          churnScore * 0.15 +
          wipScore * 0.10
        );

        // Clamp to 0-100
        sprintHealthScore = Math.max(0, Math.min(100, sprintHealthScore));
      }
    }

    // Throughput over last 14 days (by day)
    const throughputTrend = [];
    for (let i = 13; i >= 0; i--) {
      const dayStart = new Date(Date.now() - i * 24 * 3600 * 1000);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      const count = merged.filter(
        (p) => p.mergedAt && p.mergedAt >= dayStart && p.mergedAt <= dayEnd
      ).length;
      throughputTrend.push({ date: dayStart.toISOString().split('T')[0], merged: count });
    }

    // AI Insights - Overloaded Reviewers
    const reviewerLoads = {};
    open.forEach(pr => {
      (pr.requestedReviewers || []).forEach(r => {
        reviewerLoads[r.username] = (reviewerLoads[r.username] || 0) + 1;
      });
    });
    const overloadedReviewers = Object.entries(reviewerLoads)
      .map(([username, count]) => ({ username, count }))
      .sort((a,b) => b.count - a.count)
      .slice(0, 5);

    // AI Insights - Stuck PRs
    const stuckPRs = open.filter(p => p.stallReason === 'NO_REVIEWER' || p.stallReason === 'REVIEWER_INACTIVE').length;

    // AI Insights - Delay by Size
    const delaysBySize = { trivial: [], low: [], medium: [], high: [], epic: [] };
    merged.forEach(p => {
       if (p.cycleTimeSeconds) delaysBySize[p.complexityLabel].push(p.cycleTimeSeconds / 3600);
    });
    const delayBySizeChart = Object.keys(delaysBySize).map(k => ({
       size: k,
       avgDelayHours: parseFloat((delaysBySize[k].length ? (delaysBySize[k].reduce((a,b)=>a+b,0)/delaysBySize[k].length) : 0).toFixed(1))
    }));

    res.json({
      success: true,
      data: {
        sprintHealthScore,
        avgCycleTimeHours,
        avgReviewLatencyHours,
        throughput7d: merged7d,
        avgChurnRate: avgChurn,
        openPRs: open.length,
        mergedPRs: merged.length,
        wipByStage,
        throughputTrend,
        totalPRs: prs.length,
        overloadedReviewers,
        stuckPRsCount: stuckPRs,
        delayBySizeChart
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/metrics/cycle-time  — cycle time funnel data
router.get('/cycle-time', protect, async (req, res) => {
  try {
    const since = getDateRange(req.query);
    const merged = await PullRequest.find({
      orgId: req.orgId,
      state: 'merged',
      $or: [{ openedAt: { $gte: since } }, { mergedAt: { $gte: since } }]
    });

    const stages = merged.map((p) => {
      const commit2open = p.openedAt && p.firstCommitAt
        ? (p.openedAt - p.firstCommitAt) / 3600000 : 0;
      const open2review = p.firstReviewAt && p.openedAt
        ? (p.firstReviewAt - p.openedAt) / 3600000 : 0;
      const review2merge = p.mergedAt && (p.firstReviewAt || p.openedAt)
        ? (p.mergedAt - (p.firstReviewAt || p.openedAt)) / 3600000 : 0;
      return { commit2open, open2review, review2merge };
    });

    const avg = (key) =>
      stages.length
        ? parseFloat((stages.reduce((s, x) => s + x[key], 0) / stages.length).toFixed(1))
        : 0;

    res.json({
      success: true,
      data: {
        commitToOpen: avg('commit2open'),
        openToReview: avg('open2review'),
        reviewToMerge: avg('review2merge'),
        totalCycleHours: avg('commit2open') + avg('open2review') + avg('review2merge'),
        sampleSize: stages.length,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/metrics/snapshots  — historical trend data per repo
router.get('/snapshots', protect, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const since = new Date(Date.now() - parseInt(days) * 24 * 3600 * 1000);
    const snapshots = await MetricSnapshot.find({ orgId: req.orgId, date: { $gte: since } })
      .sort({ date: 1 })
      .populate('repoId', 'fullName name');
    res.json({ success: true, data: snapshots });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
