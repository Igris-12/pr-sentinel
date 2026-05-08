import { useState, useEffect, Fragment, type FC } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  UserCheck, AlertTriangle, CheckCircle, Info, ChevronDown,
  GitPullRequest, Eye, Zap, Shield, Users, BarChart3,
  ArrowLeftRight, Clock, TrendingUp, Activity,
} from 'lucide-react';
import api from '../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────
interface Insight {
  type: 'positive' | 'warning' | 'info';
  text: string;
}

interface RadarData {
  reviewQuality: number;
  fairness: number;
  collaboration: number;
  riskAwareness: number;
  loadBalance: number;
  speed: number;
}

interface Scorecard {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  totalPRsAuthored: number;
  totalReviewsGiven: number;
  avgPRSize: number;
  avgCycleTimeHours: number;
  avgReviewDepthScore: number;
  avgTimeToReviewHours: number;
  rubberStampRate: number;
  rubberStampCount: number;
  cliqueScore: number;
  topReviewTarget: string | null;
  topReviewTargetPct: number;
  uniqueReviewers: number;
  uniqueAuthorsReviewed: number;
  uniqueCollaborators: number;
  knowledgeDiffusionScore: number;
  highRiskApprovals: number;
  riskContributionScore: number;
  avgRiskWeight: number;
  activeReviewLoad: number;
  speedQualityLabel: string;
  radar: RadarData;
  insights: Insight[];
}

// ─── Radar Chart (pure SVG) ───────────────────────────────────────────────
const RADAR_AXES = [
  { key: 'reviewQuality', label: 'Review Quality' },
  { key: 'fairness', label: 'Fairness' },
  { key: 'collaboration', label: 'Collaboration' },
  { key: 'riskAwareness', label: 'Risk Awareness' },
  { key: 'loadBalance', label: 'Load Balance' },
  { key: 'speed', label: 'Speed' },
] as const;

function RadarChart({ data, compare }: { data: RadarData; compare?: RadarData }) {
  const cx = 160, cy = 160, r = 110;
  const n = RADAR_AXES.length;

  const angleFor = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;

  const point = (val: number, i: number) => ({
    x: cx + r * val * Math.cos(angleFor(i)),
    y: cy + r * val * Math.sin(angleFor(i)),
  });

  const toPath = (d: RadarData) =>
    RADAR_AXES.map(({ key }, i) => point(d[key as keyof RadarData], i))
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ') + ' Z';

  const gridLevels = [0.25, 0.5, 0.75, 1.0];

  return (
    <svg viewBox="0 0 320 320" width="100%" style={{ maxWidth: 320, margin: '0 auto', display: 'block' }}>
      {/* Grid rings */}
      {gridLevels.map((lvl) => (
        <polygon
          key={lvl}
          points={RADAR_AXES.map((_, i) => {
            const p = point(lvl, i);
            return `${p.x},${p.y}`;
          }).join(' ')}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={1}
        />
      ))}

      {/* Axis lines */}
      {RADAR_AXES.map((_, i) => {
        const p = point(1.0, i);
        return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />;
      })}

      {/* Compare polygon (behind) */}
      {compare && (
        <path
          d={toPath(compare)}
          fill="rgba(0,203,169,0.12)"
          stroke="rgba(0,203,169,0.5)"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
      )}

      {/* Main polygon */}
      <path
        d={toPath(data)}
        fill="rgba(101,119,243,0.18)"
        stroke="var(--dd-accent)"
        strokeWidth={2}
      />

      {/* Dots on main */}
      {RADAR_AXES.map(({ key }, i) => {
        const p = point(data[key as keyof RadarData], i);
        return (
          <circle
            key={key}
            cx={p.x} cy={p.y} r={4}
            fill="var(--dd-accent)"
            stroke="var(--dd-card)"
            strokeWidth={2}
          />
        );
      })}

      {/* Labels */}
      {RADAR_AXES.map(({ label }, i) => {
        const p = point(1.3, i);
        return (
          <text
            key={label}
            x={p.x} y={p.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={10}
            fill="var(--dd-text-muted)"
            fontFamily="Inter, sans-serif"
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}

// ─── Score Bar ────────────────────────────────────────────────────────────
function ScoreBar({ value, max = 1, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div style={{ height: 5, borderRadius: 99, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
      <div
        style={{
          height: '100%', width: `${pct}%`, borderRadius: 99,
          background: color, transition: 'width 1s cubic-bezier(0.22,1,0.36,1)',
          boxShadow: `0 0 6px ${color}`,
        }}
      />
    </div>
  );
}

// ─── Insight Card ─────────────────────────────────────────────────────────
function InsightCard({ insight }: { insight: Insight }) {
  const cfg = {
    positive: { icon: CheckCircle, color: 'var(--dd-green)', bg: 'var(--dd-green-dim)', border: 'rgba(63,185,80,0.25)' },
    warning:  { icon: AlertTriangle, color: 'var(--dd-amber)', bg: 'var(--dd-amber-dim)', border: 'rgba(210,153,34,0.25)' },
    info:     { icon: Info, color: 'var(--dd-text-muted)', bg: 'rgba(255,255,255,0.04)', border: 'var(--dd-border)' },
  }[insight.type];
  const Icon = cfg.icon;
  return (
    <div
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '10px 14px', borderRadius: 10,
        background: cfg.bg, border: `1px solid ${cfg.border}`,
      }}
    >
      <Icon size={14} style={{ color: cfg.color, flexShrink: 0, marginTop: 1 }} />
      <span style={{ fontSize: 13, color: 'var(--dd-text)', lineHeight: 1.5 }}>{insight.text}</span>
    </div>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────
function Avatar({ username, avatarUrl, size = 44 }: { username: string; avatarUrl?: string | null; size?: number }) {
  return avatarUrl ? (
    <img
      src={avatarUrl} alt={username}
      style={{ width: size, height: size, borderRadius: '50%', border: '2px solid var(--dd-border)', objectFit: 'cover', flexShrink: 0 }}
      onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${username}&background=6577f3&color=fff`; }}
    />
  ) : (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #6577f3, #00cba9)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 700, color: 'white', flexShrink: 0,
    }}>
      {username?.[0]?.toUpperCase()}
    </div>
  );
}

// ─── Developer Selector Dropdown ──────────────────────────────────────────
function DevSelector({
  scorecards, selected, onSelect, label,
}: {
  scorecards: Scorecard[];
  selected: string;
  onSelect: (u: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = scorecards.find((s) => s.username === selected);
  const isEmpty = scorecards.length === 0;
  return (
    <div style={{ position: 'relative', minWidth: 200 }}>
      {label && <div style={{ fontSize: 11, color: 'var(--dd-text-muted)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>}
      <button
        onClick={() => { if (!isEmpty) setOpen((v) => !v); }}
        disabled={isEmpty}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, width: '100%',
          padding: '8px 12px', borderRadius: 9,
          background: 'var(--dd-surface)', border: '1px solid var(--dd-border)',
          color: isEmpty ? 'var(--dd-text-muted)' : 'var(--dd-text)',
          cursor: isEmpty ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500,
          transition: 'all 0.15s', opacity: isEmpty ? 0.6 : 1,
        }}
      >
        {current && <Avatar username={current.username} avatarUrl={current.avatarUrl} size={24} />}
        <span style={{ flex: 1, textAlign: 'left' }}>
          {isEmpty ? 'None' : (current?.displayName || current?.username || 'Select developer')}
        </span>
        {!isEmpty && <ChevronDown size={14} style={{ color: 'var(--dd-text-muted)' }} />}
      </button>
      {open && !isEmpty && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
          background: 'var(--dd-card)', border: '1px solid var(--dd-border)',
          borderRadius: 10, zIndex: 9999, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          maxHeight: 260, overflowY: 'auto',
        }}>
          {scorecards.map((s) => (
            <button
              key={s.username}
              onClick={() => { onSelect(s.username); setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '9px 12px', background: s.username === selected ? 'var(--dd-accent-dim)' : 'none',
                border: 'none', color: 'var(--dd-text)', cursor: 'pointer', fontSize: 13,
                borderBottom: '1px solid var(--dd-border)', transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => { if (s.username !== selected) (e.currentTarget as HTMLButtonElement).style.background = 'var(--dd-hover-overlay)'; }}
              onMouseLeave={(e) => { if (s.username !== selected) (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
            >
              <Avatar username={s.username} avatarUrl={s.avatarUrl} size={24} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 500 }}>{s.displayName || s.username}</div>
                <div style={{ fontSize: 11, color: 'var(--dd-text-muted)' }}>@{s.username}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Metric Item ──────────────────────────────────────────────────────────
function MetricRow({
  icon: Icon, label, value, color, bar, max,
}: {
  icon: FC<{ size?: number; className?: string; style?: object }>;
  label: string;
  value: string;
  color: string;
  bar?: number;
  max?: number;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 14px', borderRadius: 10, background: 'var(--dd-surface)', border: '1px solid var(--dd-border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Icon size={13} style={{ color }} />
          <span style={{ fontSize: 12, color: 'var(--dd-text-muted)', fontWeight: 500 }}>{label}</span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color, fontFamily: 'Clash Display, Inter, sans-serif' }}>{value}</span>
      </div>
      {bar !== undefined && <ScoreBar value={bar} max={max ?? 1} color={color} />}
    </div>
  );
}

// ─── Scorecard Panel ──────────────────────────────────────────────────────
function ScorecardPanel({ card, compareCard, accentColor = 'var(--dd-accent)' }: {
  card: Scorecard;
  compareCard?: Scorecard;
  accentColor?: string;
}) {

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div className="dd-card" style={{ padding: '20px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <Avatar username={card.username} avatarUrl={card.avatarUrl} size={52} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Clash Display, Inter, sans-serif', color: 'var(--dd-text)' }}>
              {card.displayName || card.username}
            </div>
            <div style={{ fontSize: 12, color: 'var(--dd-text-muted)', marginTop: 2 }}>@{card.username}</div>
            <div style={{ marginTop: 6 }}>
              <span className="badge badge-gray" style={{ fontSize: 11 }}>{card.speedQualityLabel}</span>
            </div>
          </div>
        </div>

        {/* Activity Strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {[
            { label: 'PRs Authored', value: card.totalPRsAuthored, icon: GitPullRequest, color: accentColor },
            { label: 'Reviews Given', value: card.totalReviewsGiven, icon: Eye, color: 'var(--dd-cyan)' },
            { label: 'Active Load', value: card.activeReviewLoad, icon: Activity, color: card.activeReviewLoad > 7 ? 'var(--dd-amber)' : 'var(--dd-green)' },
            { label: 'Collaborators', value: card.uniqueCollaborators, icon: Users, color: 'var(--dd-green)' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} style={{ textAlign: 'center', padding: '10px 6px', borderRadius: 8, background: 'var(--dd-surface-strong)' }}>
              <Icon size={14} style={{ color, margin: '0 auto 4px' }} />
              <div style={{ fontSize: 20, fontWeight: 700, color, fontFamily: 'Clash Display, Inter, sans-serif', lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 10, color: 'var(--dd-text-muted)', marginTop: 2, fontWeight: 500 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Radar Chart */}
      <div className="dd-card" style={{ padding: '20px 22px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dd-text)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <BarChart3 size={14} style={{ color: accentColor }} />
          Behavioral Dimensions
          {compareCard && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 2, background: 'var(--dd-accent)', display: 'inline-block', borderRadius: 1 }} />
                {card.username}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 2, background: 'var(--dd-cyan)', display: 'inline-block', borderRadius: 1, borderTop: '2px dashed var(--dd-cyan)' }} />
                {compareCard.username}
              </span>
            </div>
          )}
        </div>
        <RadarChart data={card.radar} compare={compareCard?.radar} />
      </div>

      {/* Metrics Grid */}
      <div className="dd-card" style={{ padding: '20px 22px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dd-text)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrendingUp size={14} style={{ color: 'var(--dd-accent)' }} />
          Key Metrics
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <MetricRow
            icon={Zap}
            label="Review Depth"
            value={card.avgReviewDepthScore > 0 ? `${(card.avgReviewDepthScore * 100).toFixed(0)}%` : '—'}
            color={card.avgReviewDepthScore > 0.6 ? 'var(--dd-green)' : card.avgReviewDepthScore > 0.3 ? 'var(--dd-amber)' : 'var(--dd-red)'}
            bar={card.avgReviewDepthScore}
          />
          <MetricRow
            icon={Clock}
            label="Time to Review"
            value={card.avgTimeToReviewHours > 0 ? `${card.avgTimeToReviewHours}h` : '—'}
            color={card.avgTimeToReviewHours < 2 ? 'var(--dd-green)' : card.avgTimeToReviewHours < 8 ? 'var(--dd-amber)' : 'var(--dd-red)'}
            bar={card.avgTimeToReviewHours > 0 ? Math.max(0, 1 - card.avgTimeToReviewHours / 24) : 0}
          />
          <MetricRow
            icon={AlertTriangle}
            label="Rubber Stamp Rate"
            value={`${(card.rubberStampRate * 100).toFixed(0)}%`}
            color={card.rubberStampRate < 0.2 ? 'var(--dd-green)' : card.rubberStampRate < 0.4 ? 'var(--dd-amber)' : 'var(--dd-red)'}
            bar={1 - card.rubberStampRate}
          />
          <MetricRow
            icon={Shield}
            label="Clique Score"
            value={card.cliqueScore > 0 ? card.cliqueScore.toFixed(2) : '—'}
            color={card.cliqueScore < 0.4 ? 'var(--dd-green)' : card.cliqueScore < 0.65 ? 'var(--dd-amber)' : 'var(--dd-red)'}
            bar={card.cliqueScore > 0 ? 1 - card.cliqueScore : 0}
          />
          <MetricRow
            icon={Users}
            label="Diffusion Score"
            value={card.knowledgeDiffusionScore > 0 ? card.knowledgeDiffusionScore.toFixed(2) : '—'}
            color={card.knowledgeDiffusionScore > 0.6 ? 'var(--dd-green)' : card.knowledgeDiffusionScore > 0.3 ? 'var(--dd-amber)' : 'var(--dd-red)'}
            bar={card.knowledgeDiffusionScore}
          />
          <MetricRow
            icon={GitPullRequest}
            label="High-Risk Approved"
            value={String(card.highRiskApprovals)}
            color={card.highRiskApprovals === 0 ? 'var(--dd-green)' : card.highRiskApprovals < 4 ? 'var(--dd-amber)' : 'var(--dd-red)'}
            bar={Math.max(0, 1 - card.highRiskApprovals / 10)}
          />
        </div>
      </div>

      {/* Insights */}
      <div className="dd-card" style={{ padding: '20px 22px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dd-text)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <UserCheck size={14} style={{ color: 'var(--dd-accent)' }} />
          Behavioral Insights
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {card.insights.map((ins, i) => <InsightCard key={i} insight={ins} />)}
        </div>
      </div>
    </div>
  );
}

// ─── Compare Table ────────────────────────────────────────────────────────
function CompareTable({ a, b }: { a: Scorecard; b: Scorecard }) {
  const rows = [
    { label: 'PRs Authored', av: a.totalPRsAuthored, bv: b.totalPRsAuthored, higherBetter: true, fmt: (v: number) => String(v) },
    { label: 'Reviews Given', av: a.totalReviewsGiven, bv: b.totalReviewsGiven, higherBetter: true, fmt: (v: number) => String(v) },
    { label: 'Depth Score', av: a.avgReviewDepthScore, bv: b.avgReviewDepthScore, higherBetter: true, fmt: (v: number) => v > 0 ? `${(v * 100).toFixed(0)}%` : '—' },
    { label: 'Rubber Stamp', av: a.rubberStampRate, bv: b.rubberStampRate, higherBetter: false, fmt: (v: number) => `${(v * 100).toFixed(0)}%` },
    { label: 'Clique Score', av: a.cliqueScore, bv: b.cliqueScore, higherBetter: false, fmt: (v: number) => v > 0 ? v.toFixed(2) : '—' },
    { label: 'Diffusion', av: a.knowledgeDiffusionScore, bv: b.knowledgeDiffusionScore, higherBetter: true, fmt: (v: number) => v > 0 ? v.toFixed(2) : '—' },
    { label: 'Time to Review', av: a.avgTimeToReviewHours, bv: b.avgTimeToReviewHours, higherBetter: false, fmt: (v: number) => v > 0 ? `${v}h` : '—' },
    { label: 'Active Load', av: a.activeReviewLoad, bv: b.activeReviewLoad, higherBetter: false, fmt: (v: number) => String(v) },
    { label: 'High-Risk Approved', av: a.highRiskApprovals, bv: b.highRiskApprovals, higherBetter: false, fmt: (v: number) => String(v) },
  ];

  const winColor = 'var(--dd-green)';
  const loseColor = 'var(--dd-amber)';
  const neutralColor = 'var(--dd-text-muted)';

  const cellColor = (av: number, bv: number, higherBetter: boolean, mine: 'a' | 'b') => {
    if (av === bv || (av === 0 && bv === 0)) return neutralColor;
    const aWins = higherBetter ? av > bv : av < bv;
    return (mine === 'a' ? aWins : !aWins) ? winColor : loseColor;
  };

  return (
    <div className="dd-card" style={{ padding: '20px 22px' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dd-text)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <ArrowLeftRight size={14} style={{ color: 'var(--dd-accent)' }} />
        Side-by-Side Comparison
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 0 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--dd-border)' }}>
          <Avatar username={a.username} avatarUrl={a.avatarUrl} size={22} />
          <span style={{ fontSize: 12, fontWeight: 600 }}>{a.displayName || a.username}</span>
        </div>
        <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--dd-border)', textAlign: 'center', fontSize: 10, color: 'var(--dd-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Metric</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--dd-border)' }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>{b.displayName || b.username}</span>
          <Avatar username={b.username} avatarUrl={b.avatarUrl} size={22} />
        </div>

        {rows.map(({ label, av, bv, higherBetter, fmt }) => (
          <Fragment key={label}>
            <div style={{ padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'left', fontSize: 13, fontWeight: 700, fontFamily: 'Clash Display, Inter, sans-serif', color: cellColor(av, bv, higherBetter, 'a') }}>
              {fmt(av)}
            </div>
            <div style={{ padding: '9px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'center', fontSize: 11, color: 'var(--dd-text-muted)', fontWeight: 500 }}>
              {label}
            </div>
            <div style={{ padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'right', fontSize: 13, fontWeight: 700, fontFamily: 'Clash Display, Inter, sans-serif', color: cellColor(av, bv, higherBetter, 'b') }}>
              {fmt(bv)}
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────
export default function ScorecardPage() {
  const [selectedDev, setSelectedDev] = useState<string>('');
  const [compareDev, setCompareDev] = useState<string>('');
  const [compareMode, setCompareMode] = useState(false);
  const [days, setDays] = useState(30);

  const { data: allCards = [], isLoading } = useQuery<Scorecard[]>({
    queryKey: ['scorecard', days],
    queryFn: () => api.get(`/scorecard?days=${days}`).then((r) => r.data.data),
    staleTime: 60_000,
  });

  // Auto-select first dev on load
  useEffect(() => {
    if (allCards.length > 0 && !selectedDev) setSelectedDev(allCards[0].username);
  }, [allCards, selectedDev]);

  const currentCard = allCards.find((c) => c.username === selectedDev);
  const compareCard = allCards.find((c) => c.username === compareDev);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* ── Page Header ── */}
      <div className="page-header animate-fade-in">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ padding: '6px 8px', borderRadius: 10, background: 'var(--dd-accent-dim)', display: 'inline-flex' }}>
              <UserCheck size={20} style={{ color: 'var(--dd-accent)' }} />
            </div>
            Developer Scorecard
          </h1>
          <p className="page-subtitle">Behavioral intelligence — how developers contribute to code quality, collaboration &amp; risk</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Days filter */}
          {[7, 14, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={days === d ? 'btn-primary' : 'btn-secondary'}
              style={{ padding: '6px 14px', fontSize: 12 }}
            >
              {d}d
            </button>
          ))}
          <button
            onClick={() => { setCompareMode((v) => !v); if (!compareMode) setCompareDev(''); }}
            className={compareMode ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '6px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <ArrowLeftRight size={13} />
            Compare
          </button>
        </div>
      </div>

      {/* ── Dev selectors ── */}
      <div
        className="dd-card animate-fade-in-up"
        style={{ padding: '16px 20px', marginBottom: 24, display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', overflow: 'visible', position: 'relative', zIndex: 50 }}
      >
        <DevSelector scorecards={allCards} selected={selectedDev} onSelect={setSelectedDev} label="Developer" />
        {compareMode && (
          <>
            <div style={{ fontSize: 18, color: 'var(--dd-text-muted)', paddingBottom: 2 }}>vs</div>
            <DevSelector
              scorecards={allCards.filter((c) => c.username !== selectedDev)}
              selected={compareDev}
              onSelect={setCompareDev}
              label="Compare With"
            />
          </>
        )}
      </div>

      {/* ── Loading ── */}
      {isLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: compareMode ? '1fr 1fr' : '1fr', gap: 20 }}>
          {[0, 1].slice(0, compareMode ? 2 : 1).map((i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="skeleton" style={{ height: 180 }} />
              <div className="skeleton" style={{ height: 300 }} />
              <div className="skeleton" style={{ height: 260 }} />
            </div>
          ))}
        </div>
      )}

      {/* ── No data ── */}
      {!isLoading && allCards.length === 0 && (
        <div className="dd-card" style={{ padding: 48, textAlign: 'center' }}>
          <UserCheck size={40} style={{ color: 'var(--dd-text-dim)', margin: '0 auto 16px' }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--dd-text)', marginBottom: 6 }}>No contributor data yet</div>
          <div style={{ fontSize: 13, color: 'var(--dd-text-muted)' }}>Connect a repository and sync GitHub data to see developer scorecards.</div>
        </div>
      )}

      {/* ── Scorecard(s) ── */}
      {!isLoading && currentCard && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: compareMode && compareCard ? '1fr 1fr' : '1fr', gap: 20 }}>
            <div className="animate-fade-in-up">
              <ScorecardPanel card={currentCard} compareCard={compareMode && compareCard ? compareCard : undefined} />
            </div>
            {compareMode && compareCard && (
              <div className="animate-fade-in-up" style={{ animationDelay: '60ms' }}>
                <ScorecardPanel card={compareCard} compareCard={currentCard} accentColor="var(--dd-cyan)" />
              </div>
            )}
          </div>

          {/* Compare table */}
          {compareMode && compareCard && (
            <div className="animate-fade-in-up" style={{ animationDelay: '120ms' }}>
              <CompareTable a={currentCard} b={compareCard} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
