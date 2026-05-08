import express from 'express';
import { protect } from '../middleware/auth.js';
import User from '../models/User.js';

const router = express.Router();

// PUT /api/users/me
router.put('/me', protect, async (req, res) => {
  try {
    const { name, githubUsername, avatar } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { name, githubUsername, avatar } },
      { new: true, runValidators: true }
    ).select('-refreshToken -githubPatEncrypted');
    
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

export default router;
