import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore, useNotifStore } from '../store';
import { useQueryClient } from '@tanstack/react-query';

type ConnectionStatus = 'live' | 'polling' | 'offline';

// Real-time notification shape pushed by backend
export interface LiveNotification {
  id: number;
  category: string;
  title: string;
  body: string;
  color: string;
  time: string;
  date: string;
  read: boolean;
  timestamp: string;
}

export function useSocket() {
  const { user } = useAuthStore();
  const { addLiveNotif } = useNotifStore();
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const [status, setStatus] = useState<ConnectionStatus>('offline');

  const clearPoll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = undefined; }
  }, []);

  useEffect(() => {
    if (!user?.orgId) return;

    const socket = io(import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000', {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      // Client-side keepalive
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 20000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setStatus('live');
      clearPoll();
      socket.emit('join-org', user.orgId);
    });

    socket.on('disconnect', () => {
      setStatus('offline');
      // Polling fallback while socket reconnects
      clearPoll();
      pollRef.current = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        setStatus('polling');
      }, 30_000);
    });

    socket.on('connect_error', () => setStatus('polling'));

    // ── Real-time data events ─────────────────────────────────────────────
    socket.on('pr:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['prs'] });
      queryClient.invalidateQueries({ queryKey: ['bubble-matrix'] });
    });

    socket.on('metrics:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['cycle-time'] });
    });

    socket.on('sync:complete', () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['prs'] });
      queryClient.invalidateQueries({ queryKey: ['team'] });
      queryClient.invalidateQueries({ queryKey: ['connected-repos'] });
      queryClient.invalidateQueries({ queryKey: ['cycle-time'] });
    });

    // ── Real-time notifications ───────────────────────────────────────────
    socket.on('notification:new', (notif: LiveNotification) => {
      addLiveNotif(notif);
    });

    return () => {
      clearPoll();
      socket.disconnect();
    };
  }, [user?.orgId, queryClient, addLiveNotif, clearPoll]);

  return { status, socket: socketRef.current };
}
