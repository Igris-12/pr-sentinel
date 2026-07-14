import express from 'express';
import { protect } from '../middleware/auth.js';
import PullRequest from '../models/PullRequest.js';
import RiskAnalysis from '../models/RiskAnalysis.js';
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

export default router;
