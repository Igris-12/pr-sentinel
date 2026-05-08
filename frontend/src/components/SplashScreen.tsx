import { useEffect, useState } from 'react';
import { FlowMetricLogo } from './FlowMetricLogo';

/**
 * SplashScreen — shows on first app load, fades out after 2.2s.
 */
export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in');

  useEffect(() => {
    // Phase: fade in (0.5s) → hold (1.2s) → fade out (0.5s) → done
    const t1 = setTimeout(() => setPhase('hold'), 500);
    const t2 = setTimeout(() => setPhase('out'), 1700);
    const t3 = setTimeout(() => onDone(), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: '#0d1117',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 32,
        opacity: phase === 'out' ? 0 : 1,
        transition: phase === 'in' ? 'opacity 0.5s ease' : phase === 'out' ? 'opacity 0.5s ease' : 'none',
        pointerEvents: phase === 'out' ? 'none' : 'all',
      }}
    >
      {/* Ambient glow behind logo */}
      <div style={{
        position: 'absolute',
        width: 400, height: 400,
        borderRadius: '50%',
        background: 'radial-gradient(ellipse, rgba(0,232,138,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Logo — animates in from slightly below */}
      <div style={{
        transform: phase === 'in' ? 'translateY(16px)' : 'translateY(0)',
        opacity: phase === 'in' ? 0 : 1,
        transition: 'all 0.6s cubic-bezier(0.22,1,0.36,1)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24,
      }}>
        <FlowMetricLogo size="lg" />

        {/* Loading dots */}
        <div style={{ display: 'flex', gap: 6 }}>
          {[0, 1, 2].map(i => (
            <div
              key={i}
              style={{
                width: 6, height: 6,
                borderRadius: '50%',
                background: '#00e88a',
                opacity: 0.3,
                animation: `splashDot 1.2s ${i * 0.2}s ease-in-out infinite`,
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes splashDot {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          50%       { opacity: 1;   transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
