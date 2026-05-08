import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Settings, Command, GitPullRequest, LogOut, User } from 'lucide-react';
import { useAuthStore, useNotifStore } from '../store';
import { THEMES, applyThemeVars, getStoredTheme } from '../lib/themes';

const Panel = ({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{
    position: 'absolute', top: '100%', right: 0, marginTop: 8, zIndex: 200,
    background: 'var(--dd-card)', border: '1px solid var(--dd-border)',
    borderRadius: 12, boxShadow: '0 16px 48px rgba(0,0,0,0.4)', minWidth: 280, ...style,
  }}>
    {children}
  </div>
);

export default function TopBar({ title }: { title?: string }) {
  const { user, clearAuth } = useAuthStore();
  const { readIds, dismissedIds, liveNotifs } = useNotifStore();
  const navigate = useNavigate();

  const [activeTheme, setActiveTheme] = useState(() => getStoredTheme().id);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const shortcutsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = getStoredTheme();
    applyThemeVars(t);
    setActiveTheme(t.id);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (shortcutsRef.current && !shortcutsRef.current.contains(e.target as Node)) setShowShortcuts(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleApplyTheme = (t: typeof THEMES[0]) => {
    applyThemeVars(t);
    setActiveTheme(t.id);
  };

  // Unread = live notifs that haven't been read/dismissed
  const liveUnread = liveNotifs.filter(n => !readIds.includes(n.id) && !dismissedIds.includes(n.id)).length;

  return (
    <header className="topbar">
      {/* Left: title breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--dd-text)' }}>Flow<span style={{ color: '#00e88a' }}>Metric</span></span>
        {title && (
          <>
            <span style={{ color: 'var(--dd-text-dim)', fontSize: 12 }}>/</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--dd-accent)', background: 'var(--dd-accent-dim)', padding: '3px 12px', borderRadius: 100, border: '1px solid var(--dd-border-active)' }}>
              {title}
            </span>
          </>
        )}
      </div>

      {/* Right: actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>

        {/* ⌘K Theme Switcher */}
        <div ref={shortcutsRef} style={{ position: 'relative' }}>
          <button
            className="topbar-icon-btn"
            title="Theme Switcher (⌘K)"
            onClick={() => { setShowShortcuts(v => !v); setShowProfile(false); }}
            style={{ gap: 4, width: 'auto', padding: '0 10px', color: showShortcuts ? 'var(--dd-accent)' : undefined }}
          >
            <Command size={13} />
            <span style={{ fontSize: 11, fontWeight: 600 }}>Theme</span>
          </button>
          {showShortcuts && (
            <Panel style={{ minWidth: 300 }}>
              <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid var(--dd-border)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', color: 'var(--dd-text-muted)', textTransform: 'uppercase' }}>Choose Theme</div>
              </div>
              {THEMES.map((t) => (
                <div key={t.id} onClick={() => { handleApplyTheme(t); setShowShortcuts(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid var(--dd-border)', background: activeTheme === t.id ? 'var(--dd-accent-dim)' : 'transparent', transition: 'background 0.12s' }}
                  onMouseEnter={e => e.currentTarget.style.background = activeTheme === t.id ? 'var(--dd-accent-dim)' : 'var(--dd-hover-overlay)'}
                  onMouseLeave={e => e.currentTarget.style.background = activeTheme === t.id ? 'var(--dd-accent-dim)' : 'transparent'}
                >
                  {/* Colour preview */}
                  <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', width: 48, height: 18, flexShrink: 0, border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ flex: 1, background: t.preview[0] }} />
                    <div style={{ width: 14, background: t.preview[1] }} />
                    <div style={{ width: 6, background: t.preview[2] }} />
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--dd-text)', flex: 1 }}>{t.label}</span>
                  {activeTheme === t.id && (
                    <span style={{ fontSize: 10, color: t.accent, fontWeight: 700, background: t.accent + '22', padding: '2px 8px', borderRadius: 100 }}>Active</span>
                  )}
                </div>
              ))}
            </Panel>
          )}
        </div>

        {/* Bell → /notifications */}
        <button className="topbar-icon-btn" title="Notifications" onClick={() => { navigate('/notifications'); setShowShortcuts(false); setShowProfile(false); }} style={{ position: 'relative' }}>
          <Bell size={15} />
          {liveUnread > 0 && (
            <span style={{ position: 'absolute', top: 4, right: 4, minWidth: 8, height: 8, background: 'var(--dd-red)', borderRadius: '50%', border: '2px solid var(--dd-sidebar-bg)', fontSize: 9, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 2px' }}>
              {liveUnread > 9 ? '9+' : liveUnread || ''}
            </span>
          )}
        </button>

        {/* Gear → /settings */}
        <button className="topbar-icon-btn" title="Settings" onClick={() => { navigate('/settings'); setShowProfile(false); setShowShortcuts(false); }}>
          <Settings size={15} />
        </button>

        {/* Avatar Profile dropdown */}
        <div ref={profileRef} style={{ position: 'relative' }}>
          <button onClick={() => { setShowProfile(v => !v); setShowShortcuts(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
            {user?.avatar
              ? <img src={user.avatar} alt={user?.name} className="topbar-avatar" style={{ outline: showProfile ? '2px solid var(--dd-accent)' : undefined }} />
              : <div className="topbar-avatar-placeholder" style={{ outline: showProfile ? '2px solid var(--dd-accent)' : undefined }}>{user?.name?.[0]?.toUpperCase() ?? 'U'}</div>
            }
          </button>
          {showProfile && (
            <Panel>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--dd-border)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dd-text)' }}>{user?.name}</div>
                <div style={{ fontSize: 11, color: 'var(--dd-text-muted)', marginTop: 2 }}>{user?.email}</div>
              </div>
              {[
                { icon: User, label: 'Profile', action: () => { navigate('/profile'); setShowProfile(false); } },
                { icon: GitPullRequest, label: 'PR Health', action: () => { navigate('/prs'); setShowProfile(false); } },
                { icon: Settings, label: 'Settings', action: () => { navigate('/settings'); setShowProfile(false); } },
              ].map(({ icon: Icon, label, action }) => (
                <div key={label} onClick={action} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid var(--dd-border)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--dd-hover-overlay)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <Icon size={14} style={{ color: 'var(--dd-text-muted)' }} />
                  <span style={{ fontSize: 13, color: 'var(--dd-text)' }}>{label}</span>
                </div>
              ))}
              <div onClick={() => { clearAuth(); navigate('/'); }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--dd-red-dim)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <LogOut size={14} style={{ color: 'var(--dd-red)' }} />
                <span style={{ fontSize: 13, color: 'var(--dd-red)' }}>Sign out</span>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </header>
  );
}
