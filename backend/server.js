import 'dotenv/config';
import express from 'express';
import http from 'http';
import mongoose from 'mongoose';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { initFirebase } from './config/firebase.js';
import { initSocket } from './socket/index.js';
import logger from './config/logger.js';
import './jobs/webhookQueue.js'; 
import './jobs/riskQueue.js'; // Initialize BullMQ risk worker

import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import orgsRoutes from './routes/orgs.js';
import githubRoutes from './routes/github.js';
import metricsRoutes from './routes/metrics.js';
import prRoutes from './routes/prs.js';
import riskRoutes from './routes/risk.js';
import teamRoutes from './routes/team.js';
import webhookRoutes from './routes/webhooks.js';
import aiRoutes from './routes/ai.js';
import scorecardRoutes from './routes/scorecard.js';
import heatmapRoutes from './routes/heatmap.js';
import jiraRoutes from './routes/jira.js';
import autoAssignRoutes from './routes/autoAssign.js';

// ─── App ─────────────────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);

// ─── Firebase Admin SDK ───────────────────────────────────────────────────
initFirebase();

// ─── Socket.IO ────────────────────────────────────────────────────────────
initSocket(server);

// ─── Middleware ───────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({
  limit: '5mb',
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  },
}));

// Rate limiting
const apiLimiter = rateLimit({ windowMs: 60_000, max: 100, standardHeaders: true, legacyHeaders: false });
app.use('/api', apiLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/orgs', orgsRoutes);
app.use('/api/github', githubRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/prs', prRoutes);
app.use('/api/risk', riskRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/scorecard', scorecardRoutes);
app.use('/api/heatmap', heatmapRoutes);
app.use('/api/jira', jiraRoutes);
app.use('/api/auto-assign', autoAssignRoutes);

// Health check
app.get('/api/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// 404
app.use((_, res) => res.status(404).json({ success: false, message: 'Not found' }));

// Error handler
app.use((err, req, res, _next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(err.status || 500).json({ success: false, message: err.message || 'Server error' });
});

// ─── MongoDB ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/prsentinel';

mongoose
  .connect(MONGO_URI)
  .then(() => {
    logger.info('MongoDB connected');
    server.listen(PORT, () => logger.info(`PRSentinel server running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    logger.error('MongoDB connection failed', { error: err.message });
    process.exit(1);
  });
