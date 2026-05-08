import { useEffect } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth, googleProvider } from '../lib/firebase';
import { useAuthStore } from '../store';
import api from '../lib/api';
import { Activity, GitPullRequest, Users, Zap, BarChart2 } from 'lucide-react';

export default function LandingPage() {
  const { setAuth, user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/dashboard');
  }, [user, navigate]);

  const handleGoogleSignIn = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();
      const { data } = await api.post('/auth/firebase', { idToken });
      if (data.success) {
        setAuth(data.user, data.accessToken);
        navigate(data.user.githubUsername ? '/dashboard' : '/connect');
      }
    } catch (err) {
      console.error('Sign-in failed', err);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      {/* Floating orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full" 
        style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)', filter: 'blur(40px)', animation: 'meshPulse 8s ease-in-out infinite alternate' }} />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)', filter: 'blur(60px)', animation: 'meshPulse 10s ease-in-out infinite alternate-reverse' }} />

      {/* Hero Content */}
      <div className="relative z-10 text-center max-w-4xl px-6">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 badge badge-accent mb-8 animate-fade-in">
          <Zap size={12} />
          <span>Live GitHub Intelligence Platform</span>
        </div>

        {/* Display title */}
        <h1 className="font-display mb-6 animate-fade-in-up delay-100" style={{ fontSize: 'clamp(3rem, 8vw, 7rem)', fontWeight: 700, lineHeight: 1, letterSpacing: '-0.03em' }}>
          Dev<span className="gradient-text">Deck</span>
        </h1>

        <p className="text-xl mb-3 animate-fade-in-up delay-200" style={{ color: 'var(--color-text-secondary)', maxWidth: '600px', margin: '0 auto 12px' }}>
          Team Velocity & Code Health Dashboard
        </p>

        <p className="mb-10 animate-fade-in-up delay-300" style={{ color: 'var(--color-text-muted)', fontSize: '16px', maxWidth: '520px', margin: '0 auto 40px', lineHeight: 1.7 }}>
          Transform raw GitHub activity into signals that matter. Cycle time, review latency, PR churn — in real time.
        </p>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-3 mb-12 animate-fade-in-up delay-400">
          {[
            { icon: GitPullRequest, label: 'PR Bubble Matrix' },
            { icon: Activity, label: 'Real-time Webhooks' },
            { icon: BarChart2, label: 'Sprint Health Score' },
            { icon: Users, label: 'Reviewer Load Index' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="btn-ghost" style={{ fontSize: '13px', padding: '8px 16px' }}>
              <Icon size={14} />
              {label}
            </div>
          ))}
        </div>

        {/* Google Sign In */}
        <div className="flex flex-col items-center gap-4 animate-fade-in-up delay-500">
          <button onClick={handleGoogleSignIn} className="btn-magnetic text-base" style={{ padding: '16px 36px', fontSize: '16px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Sign in with Google
          </button>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>
            Connect your GitHub repo after sign-in
          </p>
        </div>
      </div>

      {/* Bottom stats strip */}
      <div className="absolute bottom-12 left-0 right-0 flex justify-center gap-12 animate-fade-in delay-600">
        {[
          { label: 'Metrics Tracked', value: '12+' },
          { label: 'Real-time via', value: 'Socket.IO' },
          { label: 'Data Source', value: 'GitHub API' },
        ].map(({ label, value }) => (
          <div key={label} className="text-center">
            <div className="font-display gradient-text" style={{ fontSize: '1.5rem', fontWeight: 700 }}>{value}</div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
