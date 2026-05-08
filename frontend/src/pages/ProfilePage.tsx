import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  ArrowLeft, GitPullRequest, GitMerge, Clock, Users,
  ExternalLink, Edit2, Check, X, GitBranch as GithubIcon, Link2
} from 'lucide-react';
import { useAuthStore } from '../store';
import api from '../lib/api';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const navigate = useNavigate();
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(user?.name ?? '');

  // Fetch real user PR stats
  const { data: dashData } = useQuery({
    queryKey: ['dashboard', 30],
    queryFn: () => api.get('/metrics/dashboard?days=30').then(r => r.data.data),
  });

  // Fetch connected repos
  const { data: reposData } = useQuery({
    queryKey: ['connected-repos'],
    queryFn: () => api.get('/github/repos').then(r => r.data.data ?? []),
  });

  const repoCount = Array.isArray(reposData) ? reposData.length : 0;

  const saveName = useMutation({
    mutationFn: (name: string) => api.put('/users/me', { name }),
    onSuccess: (res) => {
      if (res.data.success) {
        setUser({ ...user!, name: nameVal.trim() });
        toast.success('Name updated');
      }
      setEditingName(false);
    },
    onError: () => { toast.error('Save failed'); setEditingName(false); },
  });

  const stats = [
    { label: 'Open PRs',       value: dashData?.openPRs   ?? '—', color: 'var(--ps-accent)', icon: GitPullRequest },
    { label: 'Merged (30d)',   value: dashData?.mergedPRs  ?? '—', color: 'var(--ps-green)',  icon: GitMerge },
    { label: 'Avg Cycle Time', value: dashData?.avgCycleTimeHours ? `${dashData.avgCycleTimeHours}h` : '—', color: 'var(--ps-amber)', icon: Clock },
    { label: 'Repos Connected',value: repoCount,            color: 'var(--ps-cyan)',  icon: Users },
  ];

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
            <h1 className="page-title">Profile</h1>
            <p className="page-subtitle">Your account details and engineering stats.</p>
          </div>
        </div>
        <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => navigate('/settings')}>
          Edit in Settings <ExternalLink size={11} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start' }}>

        {/* Left: Profile card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="ps-card" style={{ padding: '28px 24px', textAlign: 'center' }}>
            {/* Avatar */}
            <div style={{ position: 'relative', display: 'inline-block', marginBottom: 16 }}>
              {user?.avatar
                ? <img src={user.avatar} alt={user.name} style={{ width: 88, height: 88, borderRadius: '50%', border: '3px solid var(--ps-border)' }} />
                : <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'linear-gradient(135deg,#6577f3,#00cba9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 700, color: 'white', margin: '0 auto' }}>
                    {user?.name?.[0]?.toUpperCase()}
                  </div>
              }
              <div style={{ position: 'absolute', bottom: 2, right: 2, width: 14, height: 14, background: 'var(--ps-green)', borderRadius: '50%', border: '2px solid var(--ps-card)' }} />
            </div>

            {/* Name (editable inline) */}
            {editingName ? (
              <div style={{ display: 'flex', gap: 6, marginBottom: 6, justifyContent: 'center' }}>
                <input
                  value={nameVal}
                  onChange={e => setNameVal(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveName.mutate(nameVal.trim()); if (e.key === 'Escape') setEditingName(false); }}
                  style={{ background: 'var(--ps-surface)', border: '1px solid var(--ps-border-active)', borderRadius: 6, padding: '5px 10px', color: 'var(--ps-text)', fontSize: 15, fontWeight: 600, textAlign: 'center', outline: 'none', width: 160 }}
                  autoFocus
                />
                <button onClick={() => saveName.mutate(nameVal.trim())} style={{ background: 'none', border: 'none', color: 'var(--ps-green)', cursor: 'pointer' }}><Check size={16} /></button>
                <button onClick={() => setEditingName(false)} style={{ background: 'none', border: 'none', color: 'var(--ps-text-muted)', cursor: 'pointer' }}><X size={16} /></button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--ps-text)' }}>{user?.name}</span>
                <button onClick={() => { setNameVal(user?.name ?? ''); setEditingName(true); }}
                  style={{ background: 'none', border: 'none', color: 'var(--ps-text-muted)', cursor: 'pointer', padding: 2 }}>
                  <Edit2 size={13} />
                </button>
              </div>
            )}

            <div style={{ fontSize: 13, color: 'var(--ps-text-muted)', marginBottom: 12 }}>{user?.email}</div>

            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
              {user?.role && <span className="badge badge-accent">{user.role}</span>}
              {user?.githubUsername && (
                <a href={`https://github.com/${user.githubUsername}`} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                  <span className="badge badge-gray">@{user.githubUsername} <ExternalLink size={9} style={{ display: 'inline', verticalAlign: 'middle' }} /></span>
                </a>
              )}
            </div>
          </div>

          {/* GitHub Connection Status */}
          <div className="ps-card" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <GithubIcon size={14} style={{ color: 'var(--ps-text-muted)' }} />
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ps-text-muted)' }}>GitHub Integration</span>
            </div>
            {user?.githubUsername ? (
              <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#10b981' }}>Connected</span>
                </div>
                <a
                  href={`https://github.com/${user.githubUsername}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 12, color: 'var(--ps-text)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  @{user.githubUsername}
                  <ExternalLink size={10} style={{ color: 'var(--ps-text-muted)' }} />
                </a>
              </div>
            ) : (
              <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(248,81,73,0.06)', border: '1px solid rgba(248,81,73,0.15)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f85149' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#f85149' }}>Not Connected</span>
                </div>
                <button
                  onClick={() => navigate('/connect')}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    background: 'rgba(101,119,243,0.12)', border: '1px solid rgba(101,119,243,0.3)', color: 'var(--ps-accent)',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(101,119,243,0.2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(101,119,243,0.12)'}
                >
                  <Link2 size={13} /> Connect GitHub
                </button>
              </div>
            )}
          </div>

          {/* Quick links */}
          <div className="ps-card" style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ps-text-muted)', marginBottom: 12 }}>Quick Links</div>
            {[
              { label: 'PR Health',   path: '/prs',         color: 'var(--ps-accent)' },
              { label: 'Dashboard',   path: '/dashboard',   color: 'var(--ps-cyan)' },
              { label: 'Team',        path: '/team',        color: 'var(--ps-green)' },
              { label: 'Settings',    path: '/settings',    color: 'var(--ps-amber)' },
            ].map(({ label, path, color }) => (
              <button key={label} onClick={() => navigate(path)}
                style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', marginBottom: 4, borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid var(--ps-border)', color: 'var(--ps-text)', fontSize: 12, cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.color = color; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--ps-border)'; e.currentTarget.style.color = 'var(--ps-text)'; }}>
                {label} <ExternalLink size={11} />
              </button>
            ))}
          </div>
        </div>

        {/* Right: Stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
            {stats.map(({ label, value, color, icon: Icon }) => (
              <div key={label} className="ps-card animate-fade-in-up" style={{ padding: '20px 22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ps-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
                  <div style={{ padding: 7, borderRadius: 8, background: color + '18' }}>
                    <Icon size={13} style={{ color }} />
                  </div>
                </div>
                <div style={{ fontFamily: 'Clash Display, Inter, sans-serif', fontSize: 30, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Connected Repos */}
          <div className="ps-card" style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ps-text)', marginBottom: 16 }}>Connected Repositories</div>
            {!Array.isArray(reposData) || reposData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--ps-text-muted)', fontSize: 13 }}>
                No repositories connected yet.<br />
                <button className="btn-primary" style={{ marginTop: 12, fontSize: 12 }} onClick={() => navigate('/connect')}>Connect GitHub</button>
              </div>
            ) : (
              reposData.slice(0, 6).map((repo: any) => (
                <div key={repo._id ?? repo.fullName} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ps-green)' }} />
                    <span style={{ fontSize: 13, color: 'var(--ps-text)', fontFamily: 'monospace' }}>{repo.fullName ?? repo.name}</span>
                  </div>
                  <span className="badge badge-gray">{repo.language ?? 'repo'}</span>
                </div>
              ))
            )}
          </div>

          {/* Account info */}
          <div className="ps-card" style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ps-text)', marginBottom: 16 }}>Account Details</div>
            {[
              { label: 'User ID', value: user?.id ?? '—' },
              { label: 'Org ID', value: user?.orgId ?? '—' },
              { label: 'GitHub Username', value: user?.githubUsername ? `@${user.githubUsername}` : 'Not linked' },
              { label: 'Auth Method', value: 'Google OAuth' },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontSize: 12, color: 'var(--ps-text-muted)' }}>{label}</span>
                <span style={{ fontSize: 12, color: 'var(--ps-text)', fontFamily: 'monospace', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
