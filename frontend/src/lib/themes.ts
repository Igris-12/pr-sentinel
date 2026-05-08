export interface Theme {
  id: string;
  label: string;
  accent: string;
  bg: string;
  sidebarBg: string;
  card: string;
  cardHover: string;
  border: string;
  borderActive: string;
  text: string;
  textMuted: string;
  textDim: string;
  preview: [string, string, string];
  isLight?: boolean;
}

export const THEMES: Theme[] = [
  {
    id: 'ethereal', label: 'Ethereal Dark', accent: '#6577f3',
    bg: '#0d1117', sidebarBg: '#161b27', card: '#1c2333', cardHover: '#212d40',
    border: 'rgba(255,255,255,0.07)', borderActive: 'rgba(101,119,243,0.5)',
    text: '#e6edf3', textMuted: '#8b949e', textDim: '#484f58',
    preview: ['#0d1117', '#161b27', '#6577f3'],
  },
  {
    id: 'midnight', label: 'Midnight Blue', accent: '#3b82f6',
    bg: '#0a0f1e', sidebarBg: '#0d1431', card: '#111d3f', cardHover: '#162450',
    border: 'rgba(255,255,255,0.07)', borderActive: 'rgba(59,130,246,0.5)',
    text: '#e8eef8', textMuted: '#7d8fb3', textDim: '#3d4f73',
    preview: ['#0a0f1e', '#0d1431', '#3b82f6'],
  },
  {
    id: 'forest', label: 'Forest Dark', accent: '#10b981',
    bg: '#0a1a12', sidebarBg: '#0f2418', card: '#142e20', cardHover: '#1a3a28',
    border: 'rgba(255,255,255,0.07)', borderActive: 'rgba(16,185,129,0.5)',
    text: '#e8f5ee', textMuted: '#6e9e80', textDim: '#3a5a48',
    preview: ['#0a1a12', '#0f2418', '#10b981'],
  },
  {
    id: 'rose', label: 'Rose Nebula', accent: '#f43f5e',
    bg: '#1a0a0f', sidebarBg: '#2a0f18', card: '#301420', cardHover: '#3a1a28',
    border: 'rgba(255,255,255,0.07)', borderActive: 'rgba(244,63,94,0.5)',
    text: '#fde8ef', textMuted: '#c47a93', textDim: '#7a4560',
    preview: ['#1a0a0f', '#2a0f18', '#f43f5e'],
  },
  {
    id: 'amber', label: 'Amber Dusk', accent: '#f59e0b',
    bg: '#1a1200', sidebarBg: '#261a00', card: '#2e2000', cardHover: '#382800',
    border: 'rgba(255,255,255,0.07)', borderActive: 'rgba(245,158,11,0.5)',
    text: '#fdf4e3', textMuted: '#b89060', textDim: '#786040',
    preview: ['#1a1200', '#261a00', '#f59e0b'],
  },
  {
    id: 'cyberpunk', label: 'Cyberpunk', accent: '#a855f7',
    bg: '#0d0a1a', sidebarBg: '#160f26', card: '#1c1432', cardHover: '#221a3e',
    border: 'rgba(255,255,255,0.07)', borderActive: 'rgba(168,85,247,0.5)',
    text: '#f0e8ff', textMuted: '#9070c0', textDim: '#504080',
    preview: ['#0d0a1a', '#160f26', '#a855f7'],
  },
  {
    id: 'light', label: 'Light Mode', accent: '#6577f3', isLight: true,
    bg: '#f8fafc', sidebarBg: '#ffffff', card: '#ffffff', cardHover: '#f1f5f9',
    border: 'rgba(0,0,0,0.08)', borderActive: 'rgba(101,119,243,0.4)',
    text: '#1a1f2e', textMuted: '#64748b', textDim: '#94a3b8',
    preview: ['#f8fafc', '#e2e8f0', '#6577f3'],
  },
];

export function applyThemeVars(t: Theme) {
  const root = document.documentElement;
  root.setAttribute('data-theme', t.id);
  root.style.setProperty('--dd-bg',            t.bg);
  root.style.setProperty('--dd-sidebar-bg',    t.sidebarBg);
  root.style.setProperty('--dd-card',          t.card);
  root.style.setProperty('--dd-card-hover',    t.cardHover);
  root.style.setProperty('--dd-border',        t.border);
  root.style.setProperty('--dd-border-active', t.borderActive);
  root.style.setProperty('--dd-accent',        t.accent);
  root.style.setProperty('--dd-accent-dim',    t.accent + '26');
  root.style.setProperty('--dd-text',          t.text);
  root.style.setProperty('--dd-text-muted',    t.textMuted);
  root.style.setProperty('--dd-text-dim',      t.textDim);
  root.style.setProperty('--dd-hover-overlay', t.isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)');
  root.style.setProperty('--dd-surface',       t.isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)');
  root.style.setProperty('--dd-surface-strong',t.isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.08)');
  document.body.style.background = t.bg;
  document.body.style.color = t.text;
  localStorage.setItem('devdeck-theme', t.id);
}

export function getStoredTheme(): Theme {
  const saved = localStorage.getItem('devdeck-theme');
  return THEMES.find(t => t.id === saved) ?? THEMES[0];
}
