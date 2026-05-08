import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Palette, Bell, User, Shield, Monitor,
  ArrowLeft, Check, GitBranch, LogOut,
} from 'lucide-react';
import { useAuthStore, usePrefsStore } from '../store';
import { THEMES, applyThemeVars, getStoredTheme } from '../lib/themes';
import api from '../lib/api';
import toast from 'react-hot-toast';

const SECTIONS = [
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'account', label: 'Account', icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'integrations', label: 'Integrations', icon: GitBranch },
  { id: 'security', label: 'Security', icon: Shield },
];

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} style={{
      width: 40, height: 22, borderRadius: 11, cursor: 'pointer', border: 'none',
      background: on ? 'var(--dd-accent)' : 'rgba(255,255,255,0.1)',
      position: 'relative', transition: 'background 0.2s', flexShrink: 0,
    }}>
      <div style={{
        position: 'absolute', top: 4, left: on ? 20 : 4,
        width: 14, height: 14, borderRadius: '50%', background: 'white',
        transition: 'left 0.2s',
      }} />
    </button>
  );
}

function Row({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--dd-text)' }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: 'var(--dd-text-muted)', marginTop: 3 }}>{desc}</div>}
      </div>
      <div style={{ flexShrink: 0, marginLeft: 24 }}>{children}</div>
    </div>
  );
}

export function SettingsPage() {
  const { user, clearAuth, setUser } = useAuthStore();
  const { autoRefresh, soundNotifs, emailWeekly, emailAlerts, compactMode, reducedMotion, setPref } = usePrefsStore();
  const navigate = useNavigate();

  const [section, setSection] = useState('appearance');
  const [activeTheme, setActiveTheme] = useState(() => getStoredTheme().id);

  // Name/email editing
  const [editName, setEditName] = useState(false);
  const [nameVal, setNameVal] = useState(user?.name ?? '');
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    const t = getStoredTheme();
    applyThemeVars(t);
    setActiveTheme(t.id);
  }, []);

  // Apply compact mode globally
  useEffect(() => {
    document.documentElement.setAttribute('data-compact', compactMode ? '1' : '0');
  }, [compactMode]);

  // Apply reduced motion globally
  useEffect(() => {
    document.documentElement.setAttribute('data-reduced-motion', reducedMotion ? '1' : '0');
  }, [reducedMotion]);

  const handleTheme = (t: typeof THEMES[0]) => {
    applyThemeVars(t);
    setActiveTheme(t.id);
  };

  const saveName = async () => {
    if (!nameVal.trim() || nameVal === user?.name) { setEditName(false); return; }
    setSavingName(true);
    try {
      const res = await api.put('/users/me', { name: nameVal.trim() });
      if (res.data.success) {
        setUser({ ...user!, name: nameVal.trim() });
        toast.success('Name updated');
      }
    } catch {
      toast.error('Failed to update name');
    } finally {
      setSavingName(false);
      setEditName(false);
    }
  };

  const NavItem = ({ id, label, icon: Icon }: { id: string; label: string; icon: any }) => (
    <button onClick={() => setSection(id)} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
      background: section === id ? 'var(--dd-accent-dim)' : 'none',
      color: section === id ? 'var(--dd-text)' : 'var(--dd-text-muted)',
      fontSize: 13, fontWeight: section === id ? 600 : 400,
      textAlign: 'left', transition: 'all 0.15s', marginBottom: 2,
    }}
      onMouseEnter={e => { if (section !== id) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
      onMouseLeave={e => { if (section !== id) e.currentTarget.style.background = 'none'; }}
    >
      <Icon size={15} style={{ color: section === id ? 'var(--dd-accent)' : 'inherit' }} />
      {label}
    </button>
  );

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={() => navigate(-1)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid var(--dd-border)', borderRadius: 8, color: 'var(--dd-text-muted)', fontSize: 13, cursor: 'pointer', padding: '7px 12px' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--dd-text)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--dd-text-muted)'; e.currentTarget.style.borderColor = 'var(--dd-border)'; }}
          >
            <ArrowLeft size={14} /> Back
          </button>
          <div>
            <h1 className="page-title">Settings</h1>
            <p className="page-subtitle">Manage your account, appearance, and preferences.</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24, alignItems: 'start' }}>

        {/* Sidebar nav */}
        <div className="dd-card" style={{ padding: '8px', position: 'sticky', top: 24 }}>
          {SECTIONS.map(s => <NavItem key={s.id} {...s} />)}
          <div style={{ margin: '8px 0', borderTop: '1px solid var(--dd-border)' }} />
          <button onClick={() => { clearAuth(); navigate('/'); }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'none', color: 'var(--dd-red)', fontSize: 13, textAlign: 'left', transition: 'all 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,81,73,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}>
            <LogOut size={15} /> Sign out
          </button>
        </div>

        {/* Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── APPEARANCE ── */}
          {section === 'appearance' && (
            <>
              <div className="dd-card animate-fade-in" style={{ padding: '24px 28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                  <Palette size={16} style={{ color: 'var(--dd-accent)' }} />
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--dd-text)' }}>Theme</h3>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  {THEMES.map(t => (
                    <button key={t.id} onClick={() => handleTheme(t)} style={{
                      display: 'flex', flexDirection: 'column', gap: 10,
                      padding: '14px', borderRadius: 10, cursor: 'pointer',
                      background: activeTheme === t.id ? 'var(--dd-hover-overlay)' : 'var(--dd-surface)',
                      border: activeTheme === t.id ? `2px solid ${t.accent}` : '2px solid var(--dd-border)',
                      textAlign: 'left', transition: 'all 0.2s', position: 'relative',
                    }}>
                      {/* Mini preview bar */}
                      <div style={{ display: 'flex', gap: 4, height: 36, borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div style={{ flex: 1, background: t.preview[0] }} />
                        <div style={{ width: 40, background: t.preview[1] }} />
                        <div style={{ width: 10, background: t.preview[2] }} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--dd-text)' }}>{t.label}</div>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.accent, marginTop: 4, boxShadow: `0 0 6px ${t.accent}88` }} />
                        </div>
                        {activeTheme === t.id && (
                          <div style={{ width: 20, height: 20, borderRadius: '50%', background: t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Check size={11} color="white" />
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="dd-card animate-fade-in-up delay-100" style={{ padding: '24px 28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Monitor size={16} style={{ color: 'var(--dd-accent)' }} />
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--dd-text)' }}>Display</h3>
                </div>
                <Row label="Compact Mode" desc="Reduce padding and spacing across the UI">
                  <Toggle on={compactMode} onToggle={() => setPref('compactMode', !compactMode)} />
                </Row>
                <Row label="Reduced Motion" desc="Disable animations for better accessibility">
                  <Toggle on={reducedMotion} onToggle={() => setPref('reducedMotion', !reducedMotion)} />
                </Row>
                <Row label="Auto-refresh Data" desc="Automatically refresh metrics every 60 seconds">
                  <Toggle on={autoRefresh} onToggle={() => setPref('autoRefresh', !autoRefresh)} />
                </Row>
              </div>
            </>
          )}

          {/* ── ACCOUNT ── */}
          {section === 'account' && (
            <div className="dd-card animate-fade-in" style={{ padding: '24px 28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <User size={16} style={{ color: 'var(--dd-accent)' }} />
                <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--dd-text)' }}>Account</h3>
              </div>

              {/* Profile card */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, marginBottom: 20, border: '1px solid var(--dd-border)' }}>
                {user?.avatar
                  ? <img src={user.avatar} style={{ width: 56, height: 56, borderRadius: '50%', border: '2px solid var(--dd-border)' }} alt={user.name} />
                  : <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg,#6577f3,#00cba9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: 'white' }}>{user?.name?.[0]}</div>
                }
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--dd-text)' }}>{user?.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--dd-text-muted)', marginTop: 2 }}>{user?.email}</div>
                  <div style={{ marginTop: 6 }}><span className="badge badge-accent">{user?.role ?? 'Member'}</span></div>
                </div>
              </div>

              {/* Editable name */}
              <Row label="Display Name" desc={user?.name ?? ''}>
                {editName ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      value={nameVal}
                      onChange={e => setNameVal(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditName(false); }}
                      style={{ background: 'var(--dd-surface)', border: '1px solid var(--dd-border-active)', borderRadius: 6, padding: '5px 10px', color: 'var(--dd-text)', fontSize: 13, outline: 'none' }}
                      autoFocus
                    />
                    <button className="btn-primary" style={{ padding: '5px 12px', fontSize: 12 }} onClick={saveName} disabled={savingName}>
                      {savingName ? '…' : 'Save'}
                    </button>
                  </div>
                ) : (
                  <button className="btn-ghost" style={{ fontSize: 12, padding: '6px 14px' }} onClick={() => setEditName(true)}>Edit</button>
                )}
              </Row>
              <Row label="Email" desc={user?.email ?? ''}>
                <span style={{ fontSize: 12, color: 'var(--dd-text-muted)' }}>via Google</span>
              </Row>
              <Row label="GitHub Account" desc={user?.githubUsername ? `@${user.githubUsername}` : 'Not linked'}>
                <span className={user?.githubUsername ? 'badge badge-green' : 'badge badge-gray'}>{user?.githubUsername ? 'Connected' : 'Not linked'}</span>
              </Row>
              <Row label="Organization" desc="Linked GitHub Org">
                <button className="btn-ghost" style={{ fontSize: 12, padding: '6px 14px' }} onClick={() => navigate('/connect')}>Manage</button>
              </Row>

              <div style={{ marginTop: 24, padding: '16px', background: 'rgba(248,81,73,0.05)', border: '1px solid rgba(248,81,73,0.15)', borderRadius: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--dd-red)', marginBottom: 6 }}>Danger Zone</div>
                <div style={{ fontSize: 12, color: 'var(--dd-text-muted)', marginBottom: 12 }}>Sign out of all devices and clear local data.</div>
                <button onClick={() => { clearAuth(); navigate('/'); }}
                  style={{ background: 'rgba(248,81,73,0.12)', border: '1px solid rgba(248,81,73,0.3)', borderRadius: 8, color: 'var(--dd-red)', fontSize: 13, fontWeight: 600, padding: '8px 16px', cursor: 'pointer' }}>
                  Sign Out Everywhere
                </button>
              </div>
            </div>
          )}

          {/* ── NOTIFICATIONS ── */}
          {section === 'notifications' && (
            <div className="dd-card animate-fade-in" style={{ padding: '24px 28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Bell size={16} style={{ color: 'var(--dd-accent)' }} />
                <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--dd-text)' }}>Notifications</h3>
              </div>
              <div style={{ fontSize: 13, color: 'var(--dd-text-muted)', marginBottom: 20 }}>Choose how and when you receive alerts.</div>

              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', color: 'var(--dd-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Email</div>
              <Row label="Weekly Summary" desc="Receive a weekly digest of your engineering metrics">
                <Toggle on={emailWeekly} onToggle={() => setPref('emailWeekly', !emailWeekly)} />
              </Row>
              <Row label="PR Stall Alerts" desc="Get notified when PRs stall for more than 24 hours">
                <Toggle on={emailAlerts} onToggle={() => setPref('emailAlerts', !emailAlerts)} />
              </Row>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', color: 'var(--dd-text-muted)', textTransform: 'uppercase', marginTop: 20, marginBottom: 4 }}>In-App</div>
              <Row label="Sound Notifications" desc="Play a sound when important events occur">
                <Toggle on={soundNotifs} onToggle={() => setPref('soundNotifs', !soundNotifs)} />
              </Row>
              <Row label="Real-time Updates" desc="Get instant updates via WebSocket when data changes">
                <span className="badge badge-green">Always On</span>
              </Row>
            </div>
          )}

          {/* ── INTEGRATIONS ── */}
          {section === 'integrations' && (
            <div className="dd-card animate-fade-in" style={{ padding: '24px 28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <GitBranch size={16} style={{ color: 'var(--dd-accent)' }} />
                <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--dd-text)' }}>Integrations</h3>
              </div>
              {[
                { name: 'GitHub', desc: 'Pull request data, commits, and webhook events.', connected: !!user?.githubUsername, icon: '🐙', action: () => navigate('/connect') },
                { name: 'Slack', desc: 'Get alerts and summaries in your Slack workspace.', connected: false, icon: '💬', action: undefined },
                { name: 'Jira', desc: 'Sync sprint and issue data from Jira projects.', connected: false, icon: '📋', action: undefined },
                { name: 'PagerDuty', desc: 'Trigger incidents from critical pipeline failures.', connected: false, icon: '🚨', action: undefined },
              ].map(({ name, desc, connected, icon, action }) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--dd-border)', borderRadius: 10, marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{icon}</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--dd-text)' }}>{name}</div>
                      <div style={{ fontSize: 12, color: 'var(--dd-text-muted)', marginTop: 2 }}>{desc}</div>
                    </div>
                  </div>
                  {connected
                    ? <span className="badge badge-green">Connected</span>
                    : <button className="btn-ghost" style={{ fontSize: 12, padding: '6px 14px' }} onClick={action ?? undefined} disabled={!action}>{action ? 'Connect' : 'Coming Soon'}</button>
                  }
                </div>
              ))}
            </div>
          )}

          {/* ── SECURITY ── */}
          {section === 'security' && (
            <div className="dd-card animate-fade-in" style={{ padding: '24px 28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Shield size={16} style={{ color: 'var(--dd-accent)' }} />
                <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--dd-text)' }}>Security</h3>
              </div>
              <div style={{ fontSize: 13, color: 'var(--dd-text-muted)', marginBottom: 20 }}>Manage your account security and access.</div>
              <Row label="Google SSO" desc="Sign in via Google — no password required">
                <span className="badge badge-green">Active</span>
              </Row>
              <Row label="Active Sessions" desc="You have 1 active session on this device">
                <button className="btn-ghost" style={{ fontSize: 12, padding: '6px 14px' }}>View</button>
              </Row>
              <Row label="API Token" desc="Generate a personal API token for CI integrations">
                <button className="btn-ghost" style={{ fontSize: 12, padding: '6px 14px' }} onClick={async () => {
                  try {
                    const { data } = await api.post('/auth/token');
                    if (data.token) { navigator.clipboard.writeText(data.token); toast.success('Token copied to clipboard!'); }
                  } catch { toast.error('Not available yet'); }
                }}>Generate</button>
              </Row>
              <div style={{ marginTop: 20, padding: '14px 16px', background: 'rgba(0,203,169,0.05)', border: '1px solid rgba(0,203,169,0.15)', borderRadius: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--dd-text-muted)', lineHeight: 1.6 }}>
                  🔒 Your account is secured with Google OAuth. FlowMetric stores no passwords and never has write access to your GitHub repositories.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
