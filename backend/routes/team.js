import express from 'express';
import { protect } from '../middleware/auth.js';
import Contributor from '../models/Contributor.js';
import PullRequest from '../models/PullRequest.js';

const router = express.Router();

// GET /api/team  — contributor load and quality metrics
router.get('/', protect, async (req, res) => {
  try {
    const orgId = req.orgId;
    const contributors = await Contributor.find({ orgId }).sort({ reviewerLoadIndex: -1 });

    // For each contributor, compute fresh open review count
    const openPRs = await PullRequest.find({ orgId, state: 'open' });

    const enriched = contributors.map((c) => {
      const assigned = openPRs.filter((p) =>
        (p.requestedReviewers || []).some((r) => r.username === c.username)
      ).length;
      const authored = openPRs.filter((p) => p.authorUsername === c.username).length;
      return {
        ...c.toObject(),
        openReviewRequests: assigned,
        openPRsAuthored: authored,
      };
    });

    res.json({ success: true, count: enriched.length, data: enriched });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/team/:username  — contributor detail
router.get('/:username', protect, async (req, res) => {
  try {
    const contributor = await Contributor.findOne({
      orgId: req.orgId,
      username: req.params.username,
    });
    if (!contributor) return res.status(404).json({ success: false, message: 'Contributor not found' });

    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const authored = await PullRequest.find({
      orgId: req.orgId,
      authorUsername: req.params.username,
      openedAt: { $gte: since },
    }).select('number title state cycleTimeSeconds reviewLatencySeconds complexityLabel openedAt mergedAt');

    res.json({ success: true, data: { contributor, prs: authored } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
