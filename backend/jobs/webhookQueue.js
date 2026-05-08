import logger from '../config/logger.js';

// Redis and BullMQ have been removed for now.
// The background worker queue is disabled.
// Any incoming webhooks will simply log a warning instead of being queued.

export const webhookQueue = null;
export const webhookWorker = null;

export async function enqueueWebhook(data) {
  logger.warn('Redis queue is disabled. Ignoring webhook event:', { event: data.event, action: data.action });
  return null;
}

