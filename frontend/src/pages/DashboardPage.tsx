
import { useQuery } from '@tanstack/react-query';
import { AreaChart, Area, BarChart, Bar, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';
import { TrendingUp, TrendingDown, GitPullRequest, Clock, RotateCcw, Activity, AlertTriangle, Cpu, Users } from 'lucide-react';
import api from '../lib/api';
import { useSocket } from '../hooks/useSocket';
import { useFilterStore, usePrefsStore } from '../store';

/* ---------- Sprint Health Score Radial Gauge ---------- */
function SprintHealthScore({ score }: { score: number | null }) {
  const size = 160;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = score != null ? circumference - (score / 100) * circumference : circumference;
  const color = score == null ? '#475569' : score >= 75 ? '#10b981' : score >= 45 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="health-score-ring"
          style={{ filter: `drop-shadow(0 0 8px ${color})` }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="font-display" style={{ fontSize: '2rem', fontWeight: 700, color, lineHeight: 1 }}>
          {score ?? '–'}
        </div>
        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: 2 }}>SPRINT SCORE</div>
      </div>
    </div>
  );
}

/* ---------- KPI Card ---------- */
function KPICard({ label, value, unit, trend, icon: Icon, delay = 0 }: any) {
  const isPositiveTrend = trend === 'up';
  return (
    <div className={`glass-card p-5 animate-fade-in-up`} style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 rounded-lg" style={{ background: 'rgba(124,58,237,0.12)' }}>
          <Icon size={16} style={{ color: 'var(--color-accent-1)' }} />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium`}
            style={{ color: isPositiveTrend ? 'var(--color-healthy)' : 'var(--color-danger)' }}>
            {isPositiveTrend ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          </div>
        )}
      </div>
      <div className="kpi-value" style={{ fontSize: '1.75rem' }}>{value ?? '–'}</div>
      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: 2 }}>
        {unit && <span style={{ color: 'var(--color-text-secondary)' }}>{unit} </span>}
        {label}
      </div>
    </div>
  );
}

/* ---------- WIP Stage Bar ---------- */
function WIPGauge({ wipByStage, total }: { wipByStage: any, total: number }) {
  const stages = [
    { key: 'draft', label: 'Draft', color: '#475569' },
    { key: 'waitingForReviewer', label: 'Waiting', color: '#f59e0b' },
    { key: 'inReview', label: 'In Review', color: '#7c3aed' },
  ];
  return (
    <div className="glass-card p-5 animate-fade-in-up delay-300" style={{ gridColumn: 'span 5' }}>
      <div className="flex items-center gap-2 mb-4">
        <Activity size={16} style={{ color: 'var(--color-accent-1)' }} />
        <h3 className="font-medium text-sm">WIP Distribution</h3>
        <span className="badge badge-accent ml-auto">{total} open</span>
      </div>
      {/* Stacked bar */}
      <div className="flex h-4 rounded-full overflow-hidden mb-4" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
        {stages.map(({ key, color }) => {
          const count = wipByStage?.[key] || 0;
          const pct = total > 0 ? (count / total) * 100 : 0;
          return pct > 0 ? (
            <div key={key} style={{ width: `${pct}%`, background: color, transition: 'width 1s ease', boxShadow: `0 0 8px ${color}55` }} />
          ) : null;
        })}
      </div>
      <div className="flex gap-4">
        {stages.map(({ key, label, color }) => (
          <div key={key} className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            <div className="w-2 h-2 rounded-full" style={{ background: color }} />
            {label}: <strong style={{ color: 'var(--color-text-primary)' }}>{wipByStage?.[key] ?? 0}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Throughput Sparkline ---------- */
function ThroughputSparkline({ data }: { data: any[] }) {
  return (
    <div className="glass-card p-5 animate-fade-in-up delay-400" style={{ gridColumn: 'span 7' }}>
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={16} style={{ color: 'var(--color-accent-2)' }} />
        <h3 className="font-medium text-sm">Throughput (14d)</h3>
        <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }} className="ml-auto">PRs merged / day</span>
      </div>
      <div style={{ height: 100 }}>
        <ResponsiveContainer>
          <AreaChart data={data || []} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="throughputGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" hide />
            <RechartsTooltip
              contentStyle={{ background: 'rgba(10,15,35,0.9)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#94a3b8' }}
              itemStyle={{ color: '#06b6d4' }}
              formatter={(v: any) => [v, 'Merged']}
            />
            <Area type="monotone" dataKey="merged" stroke="#06b6d4" fill="url(#throughputGrad)"
              strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ---------- Connection Badge ---------- */
function ConnectionBadge({ status }: { status: string }) {
  const labels: any = {
    live: 'Live updates',
    polling: 'Polling fallback',
    offline: 'Offline',
  };
  return (
    <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
      <span className={`connection-dot ${status}`} />
      {labels[status] || 'Offline'}
    </div>
  );
}

/* ---------- Dashboard Page ---------- */
export default function DashboardPage() {
  const { days } = useFilterStore();
  const { autoRefresh } = usePrefsStore();
  const { status } = useSocket();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', days],
    queryFn: () => api.get(`/metrics/dashboard?days=${days}`).then(r => r.data.data),
    refetchInterval: autoRefresh ? 60_000 : false,
  });

  const kpis = [
    { label: 'Avg Cycle Time', value: data?.avgCycleTimeHours, unit: 'hrs', icon: Clock, trend: null, delay: 100 },
    { label: 'Review Latency', value: data?.avgReviewLatencyHours, unit: 'hrs', icon: AlertTriangle, trend: null, delay: 200 },
    { label: 'PRs Merged (7d)', value: data?.throughput7d, unit: '', icon: GitPullRequest, trend: 'up', delay: 300 },
    { label: 'Churn Rate', value: data?.avgChurnRate, unit: '', icon: RotateCcw, trend: null, delay: 400 },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8 animate-fade-in">
        <div>
          <h1 className="font-display text-3xl font-bold">Dashboard</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginTop: 4 }}>
            Engineering intelligence · last {days} days
          </p>
        </div>
        <ConnectionBadge status={status} />
      </div>

      {isLoading ? (
        <div className="bento-grid">
          {[...Array(8)].map((_, i) => <div key={i} className="skeleton h-32" style={{ gridColumn: 'span 3' }} />)}
        </div>
      ) : (
        // Bento grid — unconventional layout
        <div className="bento-grid">
          {/* Sprint Health Score - large anchor card */}
          <div className="glass-card p-6 flex flex-col items-center justify-center animate-scale-in" style={{ gridColumn: 'span 4', gridRow: 'span 2' }}>
            <SprintHealthScore score={data?.sprintHealthScore ?? null} />
            <h3 className="font-display font-bold mt-4 text-lg">Sprint Health</h3>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Composite score across 5 weighted metrics</p>
          </div>

          {/* KPI cards - 4 across the remaining 8 columns staggered */}
          {kpis.map((kpi) => (
            <div key={kpi.label} style={{ gridColumn: 'span 2' }}>
              <KPICard {...kpi} />
            </div>
          ))}

          {/* PR counts */}
          <div className="glass-card p-5 animate-fade-in-up delay-500" style={{ gridColumn: 'span 4' }}>
            <div className="flex items-center gap-2 mb-3">
              <GitPullRequest size={16} style={{ color: 'var(--color-accent-1)' }} />
              <h3 className="font-medium text-sm">PR Overview</h3>
            </div>
            <div className="flex gap-6">
              {[
                { label: 'Open', val: data?.openPRs, color: 'var(--color-accent-1)' },
                { label: 'Merged', val: data?.mergedPRs, color: 'var(--color-healthy)' },
                { label: 'Total', val: data?.totalPRs, color: 'var(--color-text-secondary)' },
              ].map(({ label, val, color }) => (
                <div key={label}>
                  <div className="font-display" style={{ fontSize: '1.5rem', fontWeight: 700, color }}>{val ?? 0}</div>
                  <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* WIP */}
          <WIPGauge wipByStage={data?.wipByStage} total={data?.openPRs || 0} />

          {/* AI Insight Bar */}
          <div className="glass-card p-5 animate-fade-in-up delay-400 flex items-center gap-4 bg-gradient-to-r from-blue-900/40 to-purple-900/20 border-l-[3px] border-blue-500" style={{ gridColumn: 'span 12' }}>
            <div className="p-3 bg-blue-500/20 text-blue-400 rounded-full">
              <Cpu size={20} />
            </div>
            <div>
              <h3 className="font-display font-medium text-blue-300">AI Deep Insight</h3>
              <p className="text-sm text-slate-300">
                PR delays are currently caused by <strong>reviewer overload</strong>, not code complexity! 
                You have {data?.stuckPRsCount} PRs completely stuck without active reviews.
              </p>
            </div>
          </div>

          {/* Overloaded Reviewers */}
          <div className="glass-card p-5 animate-fade-in-up delay-600" style={{ gridColumn: 'span 6' }}>
            <div className="flex items-center gap-2 mb-4">
              <Users size={16} style={{ color: 'var(--color-danger)' }} />
              <h3 className="font-medium text-sm">Top Overloaded Reviewers</h3>
              <span className="badge badge-danger ml-auto">Bottlenecks</span>
            </div>
            <div className="space-y-4 mt-4">
              {(data?.overloadedReviewers && data.overloadedReviewers.length > 0) ? data.overloadedReviewers.map((r: any, idx: number) => (
                <div key={r.username} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-white border border-white/10">{idx + 1}</div>
                    <span className="text-sm font-medium">{r.username}</span>
                  </div>
                  <span className="text-sm font-bold text-red-400">{r.count} PRs assigned</span>
                </div>
              )) : (
                <div className="text-sm text-slate-500 text-center py-4">No reviewers are currently overloaded.</div>
              )}
            </div>
          </div>

          {/* Delay by Size (Bar Chart) */}
          <div className="glass-card p-5 animate-fade-in-up delay-700" style={{ gridColumn: 'span 6' }}>
             <div className="flex items-center gap-2 mb-4">
               <Clock size={16} style={{ color: 'var(--color-accent-2)' }} />
               <h3 className="font-medium text-sm">Average Delay by PR Size</h3>
             </div>
             <div style={{ height: 160, minWidth: 0 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={data?.delayBySizeChart || []}>
                    <XAxis dataKey="size" stroke="#475569" fontSize={12} />
                    <RechartsTooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '8px' }} />
                    <Bar dataKey="avgDelayHours" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
             </div>
          </div>

        </div>
      )}
    </div>
  );
}
