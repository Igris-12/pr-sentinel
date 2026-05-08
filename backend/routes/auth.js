import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { admin } from '../config/firebase.js';
import User from '../models/User.js';
import Organisation from '../models/Organisation.js';
import logger from '../config/logger.js';

const router = express.Router();

const issueTokens = (userId) => {
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });
  const refreshToken = jwt.sign({ userId }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  });
  return { accessToken, refreshToken };
};

// POST /api/auth/firebase  — verify Firebase idToken → issue our JWT
router.post('/firebase', async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ success: false, message: 'idToken required' });

    // Verify with Firebase Admin
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (firebaseErr) {
      logger.warn('Firebase token verification failed', { error: firebaseErr.message });
      return res.status(401).json({ success: false, message: 'Invalid Firebase token' });
    }

    const { uid, name, email, picture } = decodedToken;

    // Find or create user
    let user = await User.findOne({ firebaseUid: uid });
    if (!user) {
      // Auto-create a personal org for the new user, breaking the circular requirement by pre-generating ObjectIds
      const orgId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();

      const slug = (email || '').split('@')[0].replace(/[^a-z0-9]/gi, '-').toLowerCase() + '-' + Date.now();
      
      const org = new Organisation({ _id: orgId, name: name || email, slug, ownerId: userId });
      user = new User({
        _id: userId,
        firebaseUid: uid,
        name: name || 'Developer',
        email,
        avatar: picture,
        orgId: orgId,
        role: 'admin',
      });

      await Promise.all([org.save(), user.save()]);
      logger.info('New user registered', { email });
    }

    const { accessToken, refreshToken } = issueTokens(user._id.toString());
    user.refreshToken = refreshToken;
    await user.save();

    res
      .cookie('refreshToken', refreshToken, {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .json({
        success: true,
        accessToken,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          role: user.role,
          orgId: user.orgId,
          githubUsername: user.githubUsername,
        },
      });
  } catch (err) {
    logger.error('Auth error', { error: err.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/auth/refresh  — use refreshToken cookie to get new accessToken
router.post('/refresh', async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ success: false, message: 'No refresh token' });
    const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user || user.refreshToken !== token) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }
    const { accessToken, refreshToken } = issueTokens(user._id.toString());
    user.refreshToken = refreshToken;
    await user.save();
    res
      .cookie('refreshToken', refreshToken, {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .json({ success: true, accessToken });
  } catch (err) {
    res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
  }
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (token) {
      const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET).catch(() => null);
      if (decoded) {
        await User.findByIdAndUpdate(decoded.userId, { refreshToken: null });
      }
    }
  } catch (_) {}
  res.clearCookie('refreshToken').json({ success: true, message: 'Logged out' });
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ success: false });
    const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-refreshToken -githubPatEncrypted');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
});

export default router;
