import { Server } from 'socket.io';
import logger from '../config/logger.js';

let io;

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // ── Keep-alive: prevents idle disconnects ──────────────────────────────
    pingInterval: 25000,   // send ping every 25s
    pingTimeout:  60000,   // wait 60s for pong before closing
    connectTimeout: 10000,
    // ── Allow client state recovery after brief disconnects ───────────────
    connectionStateRecovery: { maxDisconnectionDuration: 2 * 60 * 1000 },
  });

  io.on('connection', (socket) => {
    logger.info('Socket connected', { id: socket.id });

    // Client joins their org room
    socket.on('join-org', (orgId) => {
      if (orgId) {
        socket.join(`org:${orgId}`);
        logger.debug('Socket joined org room', { socketId: socket.id, orgId });
      }
    });

    socket.on('disconnect', (reason) => {
      logger.debug('Socket disconnected', { id: socket.id, reason });
    });
  });

  return io;
}


export function broadcastPRUpdate(orgId, pr) {
  if (!io) return;
  io.to(`org:${orgId}`).emit('pr:updated', {
    type: 'pr:updated',
    data: pr,
    timestamp: new Date().toISOString(),
  });
  logger.debug('Broadcast pr:updated', { orgId, prNumber: pr.number });
}

export function broadcastMetricUpdate(orgId, metrics) {
  if (!io) return;
  io.to(`org:${orgId}`).emit('metrics:updated', {
    type: 'metrics:updated',
    data: metrics,
    timestamp: new Date().toISOString(),
  });
}

export function broadcastSyncComplete(orgId, repoFullName) {
  if (!io) return;
  io.to(`org:${orgId}`).emit('sync:complete', {
    type: 'sync:complete',
    data: { repoFullName },
    timestamp: new Date().toISOString(),
  });
  // Also emit a real notification for the sync
  broadcastNotification(orgId, {
    category: 'Sync',
    title: `Sync complete — ${repoFullName}`,
    body: `GitHub data for ${repoFullName} has been refreshed.`,
    color: '#3fb950',
  });
}

export function broadcastNotification(orgId, { category, title, body, color }) {
  if (!io) return;
  io.to(`org:${orgId}`).emit('notification:new', {
    id: Date.now(),
    category,
    title,
    body,
    color: color || '#6577f3',
    time: 'Just now',
    date: 'Today',
    read: false,
    timestamp: new Date().toISOString(),
  });
}

export function getIO() { return io; }
export { io };

