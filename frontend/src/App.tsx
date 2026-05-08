import React, { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { applyThemeVars, getStoredTheme } from './lib/themes';
import { useSocket } from './hooks/useSocket';
import SplashScreen from './components/SplashScreen';

import { useAuthStore } from './store';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';

import LandingPage from './pages/LandingPage';
import ConnectPage from './pages/ConnectPage';
import DashboardPage from './pages/DashboardPage';
import PRHealthPage from './pages/PRHealthPage';
import TeamPage from './pages/TeamPage';
import AIAssistantPage from './pages/AIAssistantPage';
import ChangelogPage from './pages/ChangelogPage';
import RetrospectivePage from './pages/RetrospectivePage';
import { SettingsPage } from './pages/SettingsPage';
import CycleTimePage from './pages/CycleTimePage';
import NotificationsPage from './pages/NotificationsPage';
import ProfilePage from './pages/ProfilePage';
import ScorecardPage from './pages/ScorecardPage';
import HeatmapPage from './pages/HeatmapPage';
import JiraPage from './pages/JiraPage';
import JiraDashboardPage from './pages/JiraDashboardPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

/* ─── Custom Cursor ─────────────────────────────────────────────────────── */
function CustomCursor() {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const pos = useRef({ x: 0, y: 0 });
  const ringPos = useRef({ x: 0, y: 0 });
  const animFrame = useRef<number | undefined>(undefined);

  useEffect(() => {
    const onMove = (e: MouseEvent) => { pos.current = { x: e.clientX, y: e.clientY }; };
    document.addEventListener('mousemove', onMove);
    const animate = () => {
      if (dot.current) { dot.current.style.left = `${pos.current.x}px`; dot.current.style.top = `${pos.current.y}px`; }
      if (ring.current) {
        ringPos.current.x += (pos.current.x - ringPos.current.x) * 0.15;
        ringPos.current.y += (pos.current.y - ringPos.current.y) * 0.15;
        ring.current.style.left = `${ringPos.current.x}px`;
        ring.current.style.top = `${ringPos.current.y}px`;
      }
      animFrame.current = requestAnimationFrame(animate);
    };
    animFrame.current = requestAnimationFrame(animate);
    return () => { document.removeEventListener('mousemove', onMove); if (animFrame.current) cancelAnimationFrame(animFrame.current); };
  }, []);

  return (<><div id="cursor-dot" ref={dot} /><div id="cursor-ring" ref={ring} /></>);
}

/* ─── Protected route ───────────────────────────────────────────────────── */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  return user ? <>{children}</> : <Navigate to="/" replace />;
}

/* ─── Inner layout — must be inside QueryClientProvider so useSocket can use useQueryClient ── */
function AppLayout({ children, title }: { children: React.ReactNode; title?: string }) {
  useSocket(); // establishes and keeps alive the socket connection for ALL protected pages
  return (
    <div className="app-layout">
      <div className="mesh-bg" />
      <Sidebar />
      <div className="main-content" style={{ display: 'flex', flexDirection: 'column' }}>
        <TopBar title={title} />
        <div className="page-content">{children}</div>
      </div>
    </div>
  );
}

/* ─── Public layout ─────────────────────────────────────────────────────── */
function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      <div className="mesh-bg" />
      {children}
    </div>
  );
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const handleSplashDone = useCallback(() => setShowSplash(false), []);

  // Apply saved theme on first render
  useEffect(() => { applyThemeVars(getStoredTheme()); }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {showSplash && <SplashScreen onDone={handleSplashDone} />}
        <CustomCursor />
        <Toaster
          position="bottom-right"
          toastOptions={{ style: { background: 'var(--ps-card, #1c2333)', color: 'var(--ps-text, #e6edf3)', border: '1px solid var(--ps-border, rgba(255,255,255,0.07))' } }}
        />
        <Routes>
          <Route path="/" element={<PublicLayout><LandingPage /></PublicLayout>} />

       
          {/* ── Protected + AppLayout (socket active) ── */}
          <Route path="/dashboard" element={<ProtectedRoute><AppLayout title="Dashboard"><DashboardPage /></AppLayout></ProtectedRoute>} />
          <Route path="/prs" element={<ProtectedRoute><AppLayout title="PR Health"><PRHealthPage /></AppLayout></ProtectedRoute>} />
          <Route path="/team" element={<ProtectedRoute><AppLayout title="Team"><TeamPage /></AppLayout></ProtectedRoute>} />
          <Route path="/ai" element={<ProtectedRoute><AppLayout title="AI Assistant"><AIAssistantPage /></AppLayout></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><AppLayout title="Settings"><SettingsPage /></AppLayout></ProtectedRoute>} />
          <Route path="/cycle-time" element={<ProtectedRoute><AppLayout title="Cycle Time"><CycleTimePage /></AppLayout></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><AppLayout title="Notifications"><NotificationsPage /></AppLayout></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><AppLayout title="Profile"><ProfilePage /></AppLayout></ProtectedRoute>} />
          <Route path="/scorecard" element={<ProtectedRoute><AppLayout title="Scorecard"><ScorecardPage /></AppLayout></ProtectedRoute>} />
          <Route path="/heatmap" element={<ProtectedRoute><AppLayout title="Review Heatmap"><HeatmapPage /></AppLayout></ProtectedRoute>} />
          <Route path="/jira" element={<ProtectedRoute><AppLayout title="Project Tracking"><JiraPage /></AppLayout></ProtectedRoute>} />
          <Route path="/jira" element={<ProtectedRoute><AppLayout title="Jira Manager"><JiraDashboardPage /></AppLayout></ProtectedRoute>} />
          <Route path="/connect" element={<ProtectedRoute><PublicLayout><ConnectPage /></PublicLayout></ProtectedRoute>} />
          <Route path="/changelog" element={<ProtectedRoute><AppLayout><ChangelogPage /></AppLayout></ProtectedRoute>}/>
          <Route path="/retro" element={<ProtectedRoute><AppLayout><RetrospectivePage /></AppLayout></ProtectedRoute>} />
          <Route path="/connect" element={<ProtectedRoute><PublicLayout><ConnectPage /></PublicLayout></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
