import express from 'express';
import crypto from 'crypto';
import logger from '../config/logger.js';
import { enqueueWebhook } from '../jobs/webhookQueue.js';

const router = express.Router();

// Middleware: Authenticate Github Webhook HMAC signatures
const verifyGitHubWebhook = (req, res, next) => {
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) {
    return res.status(401).json({ success: false, message: 'No signature found' });
  }

  const payloadBuffer = req.rawBody;
  if (!payloadBuffer?.length) {
    logger.warn('Webhook received without raw body');
    return res.status(400).json({ success: false, message: 'Missing raw request body' });
  }

  const secret = process.env.GITHUB_WEBHOOK_SECRET || 'prsentinel_webhook_verification_secret_key';
  const digest = 'sha256=' + crypto.createHmac('sha256', secret).update(payloadBuffer).digest('hex');
  if (signature.length !== digest.length) {
    logger.warn('Webhook signature length mismatch', { signatureLength: signature.length, digestLength: digest.length });
    return res.status(401).json({ success: false, message: 'Invalid signature' });
  }

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))) {
    logger.warn('Webhook signature mismatch', { signature, digest });
    return res.status(401).json({ success: false, message: 'Invalid signature' });
  }

  next();
};

// POST /api/webhooks/github
router.post('/github', verifyGitHubWebhook, async (req, res) => {
  try {
    const event = req.headers['x-github-event'];
    const action = req.body.action;

    logger.info('Received GitHub webhook', { event, action });

    await enqueueWebhook({
      event,
      action,
      payload: req.body,
    });

    res.status(202).json({ success: true, message: 'Webhook securely queued for processing' });
  } catch (err) {
    logger.error('Webhook error', { error: err.message });
    res.status(500).json({ success: false, message: 'Internal server error while processing webhook' });
  }
});

export default router;
