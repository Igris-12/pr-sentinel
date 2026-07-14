import { NavLink, useNavigate } from 'react-router-dom';
import { PRSentinelLogo } from './PRSentinelLogo';

import {
  LayoutDashboard, GitPullRequest, Users, Bot,
  LogOut, Plus, Settings, RefreshCw, FileText, ClipboardList, Clock, Bell, UserCheck, Network, Kanban
} from 'lucide-react';
import { useAuthStore, useNotifStore } from '../store';
import api from '../lib/api';
import { openAlertBox } from '../lib/toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/prs', icon: GitPullRequest, label: 'PR Health' },
  { to: '/team', icon: Users, label: 'Team' },
  { to: '/ai', icon: Bot, label: 'AI Assistant' },
  { to: '/changelog', icon: FileText, label: 'Changelog' },
  { to: '/retro', icon: ClipboardList, label: 'Retro' },
  { to: '/settings', icon: Settings, label: 'Settings' },
  { to: '/cycle-time',  icon: Clock,           label: 'Cycle Time' },
  { to: '/heatmap',     icon: Network,         label: 'Review Heatmap' },
  { to: '/scorecard',   icon: UserCheck,       label: 'Scorecard' },
  { to: '/jira',        icon: ClipboardList,   label: 'Project Tracking' },
  { to: '/jira-dashboard', icon: Kanban,       label: 'Jira Workflows' },
];

export default function Sidebar() {
  const { user, clearAuth } = useAuthStore();
  const { readIds, dismissedIds, liveNotifs } = useNotifStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const unreadCount = liveNotifs.filter(n => !readIds.includes(n.id) && !dismissedIds.includes(n.id)).length;

  const syncMutation = useMutation({
    mutationFn: () => api.post('/github/sync-all'),
    onSuccess: () => {
      openAlertBox('success', 'Sync triggered! Fetching latest GitHub payloads in the background.');
      setTimeout(() => queryClient.invalidateQueries(), 2000);
    },
    onError: (err: any) => openAlertBox('error', err.response?.data?.message || 'Failed to trigger sync'),
  });

  const handleLogout = async () => {
    try { await api.post('/auth/logout'); } catch (_) {}
    clearAuth();
    navigate('/');
  };

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <PRSentinelLogo size="sm" />
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} style={{ textDecoration: 'none' }}>
            {({ isActive }) => (
              <div className={`sidebar-item ${isActive ? 'active' : ''}`}>
                <Icon size={16} />
                {label}
              </div>
            )}
          </NavLink>
        ))}

        {/* Notifications with badge */}
        <NavLink to="/notifications" style={{ textDecoration: 'none' }}>
          {({ isActive }) => (
            <div className={`sidebar-item ${isActive ? 'active' : ''}`} style={{ position: 'relative' }}>
              <Bell size={16} />
              Notifications
              {unreadCount > 0 && (
                <span style={{
                  marginLeft: 'auto',
                  background: 'var(--ps-red)',
                  color: 'white',
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: 100,
                  lineHeight: 1.6,
                }}>
                  {unreadCount}
                </span>
              )}
            </div>
          )}
        </NavLink>
      </nav>

      {/* Bottom actions */}
      <div className="sidebar-bottom">
        {/* Connect repo shortcut */}
        <button onClick={() => navigate('/connect')} className="sidebar-new-project" title="Connect Repo">
          <Plus size={15} />
          Connect Repo
        </button>

        {/* Sync all */}
        <button
          onClick={() => syncMutation.mutate()}
          className="sidebar-item"
          disabled={syncMutation.isPending}
          title="Sync All Data From GitHub"
        >
          <RefreshCw size={15} className={syncMutation.isPending ? 'animate-spin' : ''} />
          {syncMutation.isPending ? 'Syncing…' : 'Sync GitHub'}
        </button>

        {/* Avatar + name */}
        {user && (
          <div className="sidebar-item" style={{ gap: 10, cursor: 'default' }}>
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="rounded-full"
                style={{ width: 22, height: 22, border: '1.5px solid var(--ps-border)', objectFit: 'cover', borderRadius: '50%' }}
              />
            ) : (
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--ps-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                {user.name?.[0]?.toUpperCase()}
              </div>
            )}
            <span style={{ fontSize: 12, color: 'var(--ps-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.name}
            </span>
          </div>
        )}

        {/* Logout */}
        <button onClick={handleLogout} className="sidebar-item" title="Sign out">
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
