
import { useQuery } from '@tanstack/react-query';
import { Users, GitPullRequest, Eye } from 'lucide-react';
import api from '../lib/api';

function LoadBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const color = pct < 40 ? '#10b981' : pct < 75 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--glass-bg)' }}>
        <div className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${pct}%`, background: color, boxShadow: `0 0 6px ${color}` }} />
      </div>
      <span className="text-xs font-mono w-8 text-right" style={{ color }}>{value}</span>
    </div>
  );
}

export default function TeamPage() {
  const activeRepo = localStorage.getItem('prsentinel_activeRepo');

  const { data: teamData, isLoading } = useQuery({
    queryKey: ['team', activeRepo],
    queryFn: () => {
      let url = '/team';
      if (activeRepo) url += `?repoFullName=${encodeURIComponent(activeRepo)}`;
      return api.get(url).then(r => r.data.data);
    },
    refetchInterval: 60_000,
  });

  const maxLoad = Math.max(...(teamData || []).map((c: any) => c.openReviewRequests || 0), 1);

  return (
    <div>
      <div className="flex items-center gap-3 mb-8 animate-fade-in">
        <div className="p-2 rounded-xl" style={{ background: 'rgba(124,58,237,0.15)' }}>
          <Users size={20} style={{ color: 'var(--color-accent-1)' }} />
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold">Team</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>Reviewer load · Quality signals</p>
        </div>
        <span className="badge badge-accent ml-auto">{teamData?.length ?? 0} contributors</span>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="skeleton h-20" />)}</div>
      ) : !teamData?.length ? (
        <div className="glass-card p-12 text-center">
          <Users size={40} className="mx-auto mb-4" style={{ opacity: 0.3, color: 'var(--color-text-muted)' }} />
          <p style={{ color: 'var(--color-text-muted)' }}>No contributors found. Connect a repo and sync to see team data.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(teamData || []).map((c: any, idx: number) => (
            <div key={c._id} className={`glass-card p-5 animate-fade-in-up`} style={{ animationDelay: `${idx * 50}ms` }}>
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="relative">
                  <img src={c.avatarUrl || `https://ui-avatars.com/api/?name=${c.username}&background=7c3aed&color=fff`}
                    alt={c.username} className="rounded-full"
                    style={{ width: 44, height: 44, border: '2px solid var(--glass-border)', objectFit: 'cover' }}
                    onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${c.username}&background=7c3aed&color=fff`; }}
                  />
                  {c.reviewerLoadIndex > 2 && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                      style={{ background: '#ef4444', fontSize: '8px', fontWeight: 'bold' }}>!</div>
                  )}
                </div>

                {/* Name + stats */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{c.displayName || c.username}</span>
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>@{c.username}</span>
                  </div>
                  <div className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
                    Review Load:
                  </div>
                  <LoadBar value={c.openReviewRequests || 0} max={maxLoad} />
                </div>

                {/* Metrics */}
                <div className="flex gap-6 text-center flex-shrink-0">
                  <div>
                    <div className="font-display font-bold" style={{ fontSize: '1.25rem', color: 'var(--color-accent-1)' }}>
                      {c.openReviewRequests ?? 0}
                    </div>
                    <div className="text-xs flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
                      <Eye size={10} /> Reviews
                    </div>
                  </div>
                  <div>
                    <div className="font-display font-bold" style={{ fontSize: '1.25rem', color: 'var(--color-accent-2)' }}>
                      {c.openPRsAuthored ?? 0}
                    </div>
                    <div className="text-xs flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
                      <GitPullRequest size={10} /> Open PRs
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div className="font-display font-bold" style={{ fontSize: '1.25rem', color: (c.reviewQualityScore || 0) > 0.6 ? '#10b981' : '#f59e0b' }}>
                      {c.reviewQualityScore ? (c.reviewQualityScore * 100).toFixed(0) : '–'}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Quality</div>
                  </div>
                </div>

                {/* Load badge */}
                {c.reviewerLoadIndex > 2 ? (
                  <span className="badge badge-danger">Load &gt; 2.0</span>
                ) : c.openReviewRequests > maxLoad * 0.75 ? (
                  <span className="badge badge-danger">Overloaded</span>
                ) : c.openReviewRequests > 0 ? (
                  <span className="badge badge-warning">Active</span>
                ) : (
                  <span className="badge badge-healthy">Available</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
