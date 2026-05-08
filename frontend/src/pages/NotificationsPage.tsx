import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Bell, GitPullRequest, CheckCheck, AlertCircle, AlertTriangle,
  ArrowLeft, CheckSquare, Trash2, ExternalLink, Zap, Calendar
} from 'lucide-react';
import { useNotifStore } from '../store';
import type { LiveNotification } from '../store';
import api from '../lib/api';

// ─── Notification builders ──────────────────────────────────────────────────

function prAlertNotif(pr: any): LiveNotification {
  return {
    id: parseInt((pr._id ?? '').toString().slice(-8), 16) || Math.random() * 1e9 | 0,
    category: 'PR Alert',
    title: `PR #${pr.number} is stalled`,
    body: `${pr.title} — has had no reviewer activity. ${pr.stallReason ? `Reason: ${pr.stallReason}.` : ''}`,
    color: '#f85149',
    time: new Date(pr.lastActivityAt ?? pr.openedAt).toLocaleString(),
    date: 'From GitHub',
    read: false,
    timestamp: pr.lastActivityAt ?? pr.openedAt,
    // Extra PR metadata for deep linking
    prNumber: pr.number,
    repoFullName: pr.repoFullName,
    prUrl: pr.htmlUrl ?? `https://github.com/${pr.repoFullName}/pull/${pr.number}`,
  } as LiveNotification & { prNumber: number; repoFullName: string; prUrl: string };
}

function prMergeNotif(pr: any): LiveNotification {
  return {
    id: parseInt((pr._id ?? '').toString().slice(-6), 16) + 1 || Math.random() * 1e9 | 0,
    category: 'Merge',
    title: `PR #${pr.number} successfully merged`,
    body: `${pr.title} — was merged into the main branch.`,
    color: '#3fb950',
    time: new Date(pr.mergedAt).toLocaleString(),
    date: 'From GitHub',
    read: false,
    timestamp: pr.mergedAt,
    prNumber: pr.number,
    repoFullName: pr.repoFullName,
    prUrl: pr.htmlUrl ?? `https://github.com/${pr.repoFullName}/pull/${pr.number}`,
  } as any;
}

function reviewWarningNotif(prs: any[]): LiveNotification | null {
  if (prs.length === 0) return null;
  const stalledOpen = prs.filter(p => p.state === 'open' && !p.requestedReviewers?.length);
  if (stalledOpen.length === 0) return null;
  return {
    id: 900001,
    category: 'Warning',
    title: 'High review latency detected',
    body: `${stalledOpen.length} open PR${stalledOpen.length > 1 ? 's' : ''} have been waiting for a first review for more than 24 hours. Reviewer load may be unbalanced.`,
    color: '#d29922',
    time: 'Auto-detected',
    date: 'From Metrics',
    read: false,
    timestamp: new Date().toISOString(),
  };
}

function sprintNotif(dashboard: any): LiveNotification | null {
  if (!dashboard) return null;
  const open = dashboard.openPRs ?? 0;
  const merged7d = dashboard.throughput7d ?? 0;
  if (open === 0) return null;
  const eta = merged7d > 0 ? Math.ceil(open / merged7d * 7) : null;
  return {
    id: 900002,
    category: 'Sprint',
    title: eta ? `Sprint estimate: ${eta} day${eta !== 1 ? 's' : ''} to clear backlog` : 'Sprint in progress',
    body: `${open} open PRs remain. At current velocity (${merged7d} merged/week), ${eta ? `backlog clears in ~${eta} days.` : 'estimate unavailable.'}`,
    color: '#a855f7',
    time: 'Real-time estimate',
    date: 'From Dashboard',
    read: false,
    timestamp: new Date().toISOString(),
  };
}

function riskNotif(prs: any[]): LiveNotification | null {
  const highRisk = prs.filter(p =>
    p.state === 'open' && (p.stallProbability > 0.65 || p.complexityLabel === 'high')
  );
  if (highRisk.length === 0) return null;
  return {
    id: 900003,
    category: 'Risk',
    title: `${highRisk.length} high-risk PR${highRisk.length > 1 ? 's' : ''} detected`,
    body: `${highRisk.map((p: any) => `#${p.number}`).join(', ')} ha${highRisk.length > 1 ? 've' : 's'} a high stall probability or complexity. Consider re-prioritising reviews.`,
    color: '#fb923c',
    time: 'Auto-detected',
    date: 'From AI Engine',
    read: false,
    timestamp: new Date().toISOString(),
    prNumber: highRisk[0]?.number,
    repoFullName: highRisk[0]?.repoFullName,
    prUrl: highRisk[0]?.htmlUrl ?? `https://github.com/${highRisk[0]?.repoFullName}/pull/${highRisk[0]?.number}`,
  } as any;
}

// Icon for each category
const CATEGORY_META: Record<string, { icon: any; color: string }> = {
  'PR Alert': { icon: AlertCircle, color: '#f85149' },
  'Merge':    { icon: CheckCheck,  color: '#3fb950' },
  'Warning':  { icon: AlertTriangle, color: '#d29922' },
  'Sprint':   { icon: Calendar,    color: '#a855f7' },
  'Risk':     { icon: Zap,         color: '#fb923c' },
  'Sync':     { icon: Zap,         color: '#00cba9' },
  'default':  { icon: GitPullRequest, color: '#6577f3' },
};

function categoryMeta(cat: string) {
  return CATEGORY_META[cat] ?? CATEGORY_META['default'];
}

// Relative time helper
function relativeTime(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return `${Math.floor(diff / 86400_000)}d ago`;
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { readIds, dismissedIds, liveNotifs, markRead, markAllRead, dismiss } = useNotifStore();

  const [statusFilter, setStatusFilter] = useState<'all' | 'unread'>('all');
  const [catFilter, setCatFilter] = useState('all');

  // Real data
  const { data: prData, isLoading: prsLoading } = useQuery({
    queryKey: ['prs', 30],
    queryFn: () => api.get('/prs?days=30').then(r => r.data.data ?? []),
  });

  const { data: dashboard } = useQuery({
    queryKey: ['dashboard', 30],
    queryFn: () => api.get('/metrics/dashboard?days=30').then(r => r.data.data),
  });

  const prs: any[] = Array.isArray(prData) ? prData : [];

  // Build all notifications from real data
  const derived: LiveNotification[] = [];

  // PR Alerts — stalled open PRs
  prs.filter(p => p.state === 'open' && p.stalledDays && p.stalledDays > 1)
     .slice(0, 5)
     .forEach(pr => derived.push(prAlertNotif(pr)));

  // Merges — recently merged
  prs.filter(p => p.state === 'merged')
     .sort((a, b) => new Date(b.mergedAt).getTime() - new Date(a.mergedAt).getTime())
     .slice(0, 5)
     .forEach(pr => derived.push(prMergeNotif(pr)));

  // Warning — review latency
  const warn = reviewWarningNotif(prs);
  if (warn) derived.push(warn);

  // Sprint — velocity based
  const spr = sprintNotif(dashboard);
  if (spr) derived.push(spr);

  // Risk — high stall probability
  const risk = riskNotif(prs);
  if (risk) derived.push(risk);

  // Combine live (socket) notifs + derived, deduplicate, remove dismissed
  const allRaw = [
    ...liveNotifs,
    ...derived.filter(n => !liveNotifs.find(l => l.id === n.id)),
  ].filter(n => !dismissedIds.includes(n.id))
   .map(n => ({ ...n, read: readIds.includes(n.id) }));

  const categories = ['all', ...Array.from(new Set(allRaw.map(n => n.category)))];
  const unreadCount = allRaw.filter(n => !n.read).length;
  const liveCount   = liveNotifs.filter(n => !dismissedIds.includes(n.id)).length;

  const visible = allRaw.filter(n => {
    if (statusFilter === 'unread' && n.read) return false;
    if (catFilter !== 'all' && n.category !== catFilter) return false;
    return true;
  });

  // Category counts for sidebar
  const catCounts: Record<string, number> = {};
  allRaw.forEach(n => { catCounts[n.category] = (catCounts[n.category] ?? 0) + 1; });

  if (prsLoading) {
    return (
      <div className="animate-fade-in">
        <div className="page-header"><h1 className="page-title">Notifications</h1></div>
        {[0, 1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 90, borderRadius: 12, marginBottom: 10 }} />)}
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={() => navigate(-1)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid var(--ps-border)', borderRadius: 8, color: 'var(--ps-text-muted)', fontSize: 13, cursor: 'pointer', padding: '7px 12px' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--ps-text)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--ps-text-muted)'; e.currentTarget.style.borderColor = 'var(--ps-border)'; }}>
            <ArrowLeft size={14} /> Back
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 className="page-title">Notifications</h1>
              {unreadCount > 0 && <span className="badge badge-red">{unreadCount} unread</span>}
              {liveCount > 0 && (
                <span className="badge badge-green" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span className="status-dot live" style={{ width: 5, height: 5 }} /> {liveCount} live
                </span>
              )}
            </div>
            <p className="page-subtitle">Real-time activity feed for your repositories and engineering metrics.</p>
          </div>
        </div>
        <button className="btn-ghost" onClick={() => markAllRead(allRaw.map(n => n.id))} style={{ fontSize: 12 }}>
          <CheckSquare size={13} /> Mark all read
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 20, alignItems: 'start' }}>

        {/* ── Feed ── */}
        <div>
          {/* Filter bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            {/* Status toggle */}
            <div style={{ display: 'flex', background: 'var(--ps-card)', border: '1px solid var(--ps-border)', borderRadius: 8, overflow: 'hidden' }}>
              {([['all', `All (${allRaw.length})`], ['unread', `Unread (${unreadCount})`]] as [string, string][]).map(([f, label]) => (
                <button key={f} onClick={() => setStatusFilter(f as any)} style={{
                  padding: '7px 14px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                  background: statusFilter === f ? 'var(--ps-accent)' : 'none',
                  color: statusFilter === f ? 'white' : 'var(--ps-text-muted)',
                  transition: 'all 0.15s',
                }}>{label}</button>
              ))}
            </div>

            {/* Category chips — matching screenshot: All / PR Alert / Merge / Warning / Sprint / Risk */}
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {categories.map(c => {
                const meta = c === 'all' ? null : categoryMeta(c);
                const isActive = catFilter === c;
                return (
                  <button key={c} onClick={() => setCatFilter(c)} style={{
                    padding: '5px 12px', borderRadius: 100, border: '1px solid var(--ps-border)',
                    background: isActive ? (meta ? meta.color + '28' : 'var(--ps-accent-dim)') : 'none',
                    color: isActive ? (meta?.color ?? 'var(--ps-accent)') : 'var(--ps-text-muted)',
                    borderColor: isActive ? (meta?.color ?? 'var(--ps-accent)') : 'var(--ps-border)',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                    textTransform: 'capitalize',
                  }}>{c === 'all' ? `All (${allRaw.length})` : c}</button>
                );
              })}
            </div>
          </div>

          {/* Date group header */}
          {visible.length > 0 && (
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ps-text-dim)', marginBottom: 10 }}>
              TODAY
            </div>
          )}

          {visible.length === 0 ? (
            <div className="ps-card" style={{ padding: '48px', textAlign: 'center' }}>
              <Bell size={32} style={{ color: 'var(--ps-text-dim)', margin: '0 auto 12px', display: 'block' }} />
              <div style={{ fontSize: 14, color: 'var(--ps-text-muted)' }}>No notifications match your filters.</div>
              <div style={{ fontSize: 12, color: 'var(--ps-text-dim)', marginTop: 6 }}>Sync your GitHub repos to populate more notifications.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {visible.map((notif) => {
                const n = notif as any;
                const meta = categoryMeta(n.category);
                const Icon = meta.icon;
                const isLive = !!liveNotifs.find(l => l.id === n.id);
                const hasPR = !!n.repoFullName && !!n.prNumber;
                const githubUrl = n.prUrl ?? (hasPR ? `https://github.com/${n.repoFullName}/pull/${n.prNumber}` : null);

                return (
                  <div key={n.id} className="ps-card animate-fade-in-up"
                    onClick={() => markRead(n.id)}
                    style={{
                      padding: '14px 18px', display: 'flex', gap: 14,
                      background: n.read ? 'var(--ps-card)' : `${meta.color}08`,
                      borderColor: n.read ? 'var(--ps-border)' : `${meta.color}33`,
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}>
                    {/* Unread dot */}
                    <div style={{ paddingTop: 5, width: 8, flexShrink: 0 }}>
                      {!n.read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ps-accent)' }} />}
                    </div>

                    {/* Icon */}
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: meta.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                      <Icon size={15} style={{ color: meta.color }} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: meta.color, background: meta.color + '18', padding: '2px 8px', borderRadius: 100 }}>{n.category}</span>
                        <span style={{ fontSize: 11, color: 'var(--ps-text-dim)' }}>
                          {n.timestamp ? relativeTime(n.timestamp) : n.time}
                        </span>
                        {isLive && <span className="badge badge-green" style={{ fontSize: 9, padding: '1px 6px' }}>LIVE</span>}
                      </div>

                      <div style={{ fontSize: 13, fontWeight: n.read ? 400 : 600, color: 'var(--ps-text)', marginBottom: 4 }}>{n.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--ps-text-muted)', lineHeight: 1.55 }}>{n.body}</div>

                      {/* ── Dual links ── */}
                      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                        {/* View in App (PR Health) */}
                        <button onClick={e => { e.stopPropagation(); navigate(hasPR ? `/prs?focus=${n.prNumber}` : '/prs'); }}
                          style={{ background: 'none', border: 'none', color: 'var(--ps-accent)', fontSize: 12, fontWeight: 500, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <GitPullRequest size={11} /> View PR ↗
                        </button>

                        {/* View on GitHub */}
                        {githubUrl && (
                          <a href={githubUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                            style={{ color: 'var(--ps-text-muted)', fontSize: 12, fontWeight: 500, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <ExternalLink size={10} /> View on GitHub
                          </a>
                        )}

                        {/* For non-PR categories — contextual links */}
                        {n.category === 'Warning' && (
                          <button onClick={e => { e.stopPropagation(); navigate('/cycle-time'); }}
                            style={{ background: 'none', border: 'none', color: 'var(--ps-amber)', fontSize: 12, fontWeight: 500, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                            View Health ↗
                          </button>
                        )}
                        {n.category === 'Sprint' && (
                          <button onClick={e => { e.stopPropagation(); navigate('/dashboard'); }}
                            style={{ background: 'none', border: 'none', color: '#a855f7', fontSize: 12, fontWeight: 500, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                            View Dashboard ↗
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Dismiss */}
                    <button onClick={e => { e.stopPropagation(); dismiss(n.id); }}
                      style={{ background: 'none', border: 'none', color: 'var(--ps-text-dim)', cursor: 'pointer', padding: 4, borderRadius: 6, flexShrink: 0, alignSelf: 'flex-start' }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--ps-red)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--ps-text-dim)'}
                      title="Dismiss">
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 24 }}>

          {/* Summary */}
          <div className="ps-card" style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ps-text-muted)', marginBottom: 14 }}>Summary</div>
            {[
              { label: 'Total',    value: allRaw.length, color: 'var(--ps-text)' },
              { label: 'Unread',   value: unreadCount,   color: 'var(--ps-accent)' },
              { label: 'PR Alerts',value: catCounts['PR Alert'] ?? 0, color: '#f85149' },
              { label: 'Merges',   value: catCounts['Merge'] ?? 0,    color: '#3fb950' },
              { label: 'Warnings', value: catCounts['Warning'] ?? 0,  color: '#d29922' },
              { label: 'Risks',    value: catCounts['Risk'] ?? 0,     color: '#fb923c' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 }}>
                <span style={{ fontSize: 12, color: 'var(--ps-text-muted)' }}>{label}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="ps-card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ps-text-muted)', marginBottom: 12 }}>Quick Actions</div>
            {[
              { label: 'Go to PR Health', path: '/prs',        color: 'var(--ps-accent)' },
              { label: 'View Dashboard',  path: '/dashboard',  color: 'var(--ps-cyan)' },
              { label: 'Cycle Time',      path: '/cycle-time', color: 'var(--ps-green)' },
            ].map(({ label, path, color }) => (
              <button key={label} onClick={() => navigate(path)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 10px', marginBottom: 5, borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--ps-border)', color: 'var(--ps-text)', fontSize: 12, cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.color = color; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--ps-border)'; e.currentTarget.style.color = 'var(--ps-text)'; }}>
                {label} <ExternalLink size={10} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
