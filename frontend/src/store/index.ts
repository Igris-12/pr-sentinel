import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: string;
  orgId: string;
  githubUsername?: string;
}

interface AuthStore {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  setUser: (user: User) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      setAuth: (user, token) => {
        localStorage.setItem('prsentinel_token', token);
        set({ user, token });
      },
      setUser: (user) => set({ user }),
      clearAuth: () => {
        localStorage.removeItem('prsentinel_token');
        set({ user: null, token: null });
      },
    }),
    { name: 'prsentinel-auth', partialize: (s) => ({ user: s.user, token: s.token }) }
  )
);

// Dashboard filter store
interface FilterStore {
  days: number;
  selectedRepo: string | null;
  setDays: (days: number) => void;
  setRepo: (repo: string | null) => void;
}

export const useFilterStore = create<FilterStore>((set) => ({
  days: 30,
  selectedRepo: null,
  setDays: (days) => set({ days }),
  setRepo: (repo) => set({ selectedRepo: repo }),
}));

// Live notification type (from socket)
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

// Notifications store — persisted read/dismiss + in-memory live notifs
interface NotifStore {
  readIds: number[];
  dismissedIds: number[];
  liveNotifs: LiveNotification[];  // real-time from socket — not persisted
  markRead: (id: number) => void;
  markAllRead: (ids: number[]) => void;
  dismiss: (id: number) => void;
  addLiveNotif: (n: LiveNotification) => void;
  clearLive: () => void;
}

export const useNotifStore = create<NotifStore>()(
  persist(
    (set) => ({
      readIds: [],
      dismissedIds: [],
      liveNotifs: [],
      markRead:    (id)  => set((s) => ({ readIds: [...s.readIds, id] })),
      markAllRead: (ids) => set((s) => ({ readIds: Array.from(new Set([...s.readIds, ...ids])) })),
      dismiss:     (id)  => set((s) => ({ dismissedIds: [...s.dismissedIds, id] })),
      addLiveNotif: (n)  => set((s) => ({ liveNotifs: [n, ...s.liveNotifs].slice(0, 50) })),
      clearLive:   ()    => set({ liveNotifs: [] }),
    }),
    // Only persist read/dismissed state, not ephemeral live notifs
    { name: 'prsentinel-notifs', partialize: (s) => ({ readIds: s.readIds, dismissedIds: s.dismissedIds }) }
  )
);

// User preference store (persisted)
interface PrefsStore {
  autoRefresh: boolean;
  soundNotifs: boolean;
  emailWeekly: boolean;
  emailAlerts: boolean;
  compactMode: boolean;
  reducedMotion: boolean;
  setPref: (k: string, v: boolean) => void;
}

export const usePrefsStore = create<PrefsStore>()(
  persist(
    (set) => ({
      autoRefresh: true,
      soundNotifs: false,
      emailWeekly: true,
      emailAlerts: true,
      compactMode: false,
      reducedMotion: false,
      setPref: (k, v) => set((s) => ({ ...s, [k]: v })),
    }),
    { name: 'prsentinel-prefs' }
  )
);
