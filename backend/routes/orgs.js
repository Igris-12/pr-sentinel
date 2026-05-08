import express from 'express';
import { protect } from '../middleware/auth.js';
import Organisation from '../models/Organisation.js';

const router = express.Router();

// PUT /api/orgs/settings
router.put('/settings', protect, async (req, res) => {
  try {
    const { name, businessHoursStart, businessHoursEnd, timezone, reviewLatencyAlertHours } = req.body;
    
    const org = await Organisation.findById(req.orgId);
    if (!org) return res.status(404).json({ success: false, message: 'Organisation not found' });

    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only admins can edit org settings' });
    }

    if (name) org.name = name;
    if (businessHoursStart !== undefined) org.config.businessHoursStart = businessHoursStart;
    if (businessHoursEnd !== undefined) org.config.businessHoursEnd = businessHoursEnd;
    if (timezone) org.config.timezone = timezone;
    if (reviewLatencyAlertHours !== undefined) org.config.reviewLatencyAlertHours = reviewLatencyAlertHours;

    await org.save();
    res.json({ success: true, org });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// GET /api/orgs/settings
router.get('/settings', protect, async (req, res) => {
  try {
    const org = await Organisation.findById(req.orgId);
    if (!org) return res.status(404).json({ success: false, message: 'Organisation not found' });
    res.json({ success: true, org });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

export default router;
