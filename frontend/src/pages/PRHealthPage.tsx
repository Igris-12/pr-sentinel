import { useEffect, useRef, useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import * as d3 from 'd3';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { GitPullRequest, Clock, AlertCircle, TrendingUp, GaugeCircle, GitBranch, UserPlus, Search, Info } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

type BubbleHealth = 'healthy' | 'at-risk' | 'stalled';
const healthColor: Record<BubbleHealth, string> = {
  healthy: '#10b981',
  'at-risk': '#f59e0b',
  stalled: '#ef4444',
};

interface PRBubble {
  id: string;
  number: number;
  title: string;
  repo: string;
  health: BubbleHealth;
  linesAdded: number;
  linesRemoved: number;
  complexity: string;
  shipProbability: number | null;
  stallReason: string | null;
  hasReviewer: boolean;
  reviewers: Array<{
    username: string;
    displayName: string;
    avatarUrl: string;
    assignmentMethod: string;
  }>;
}

// Nuance signal: human-readable labels and colours per stall reason.
// Culture problems get orange/red. Legitimate complexity gets blue/purple.
const STALL_META: Record<string, { label: string; color: string }> = {
  REVIEWER_INACTIVE: { label: 'Reviewer inactive', color: '#f59e0b' },
  NO_REVIEWER: { label: 'No reviewer assigned', color: '#f59e0b' },
  CHURNING: { label: 'High churn', color: '#ef4444' },
  COMPLEX_IN_REVIEW: { label: 'Complex and in review', color: '#06b6d4' },
  NEEDS_EXPERT: { label: 'Needs expert reviewer', color: '#8b5cf6' },
  STALLED: { label: 'Stalled', color: '#ef4444' },
};

/* ---------- D3 Bubble Matrix ---------- */
function BubbleMatrix({
  data,
  selectedId,
  onSelect,
}: {
  data: PRBubble[];
  selectedId: string | null;
  onSelect: (pr: PRBubble) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; pr: PRBubble | null }>({
    visible: false, x: 0, y: 0, pr: null,
  });

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !data.length) return;
    const width = containerRef.current.clientWidth;
    // Dynamic height: give more room as PR count increases
    const height = Math.max(480, Math.min(data.length * 55, 900));

    const svg = d3.select(svgRef.current)
      .attr('width', width).attr('height', height);
    svg.selectAll('*').remove();

    // Give bubbles more spread by increasing charge + stronger centering gravity
    const sizeExtent = d3.extent(data, (d: any) => d.size) as [number, number];
    const rScale = d3.scaleSqrt().domain([0, sizeExtent[1]]).range([8, 48]);

    const nodes = data.map((d: any) => ({ ...d, r: rScale(d.size || 1) }));

    const simulation = d3.forceSimulation(nodes as any)
      .force('charge', d3.forceManyBody().strength(-20))
      .force('center', d3.forceCenter(width / 2, height / 2).strength(0.08))
      .force('collision', d3.forceCollide().radius((d: any) => d.r + 6).strength(1))
      .stop();

    for (let i = 0; i < 200; i++) simulation.tick();

    const g = svg.append('g');

    // Draw bubbles
    const circles = g.selectAll('circle')
      .data(nodes).enter()
      .append('circle')
      .attr('class', 'pr-bubble')
      .attr('cx', (d: any) => Math.max(d.r, Math.min(width - d.r, d.x ?? width / 2)))
      .attr('cy', (d: any) => Math.max(d.r, Math.min(height - d.r, d.y ?? height / 2)))
      .attr('r', (d: any) => d.r)
      .attr('fill', (d: any) => healthColor[d.health as BubbleHealth] + (d.id === selectedId ? '45' : '30'))
      .attr('stroke', (d: any) => d.id === selectedId ? '#f8fafc' : healthColor[d.health as BubbleHealth])
      .attr('stroke-width', (d: any) => d.id === selectedId ? 2.5 : 1.5)
      .style('filter', (d: any) => `drop-shadow(0 0 8px ${healthColor[d.health as BubbleHealth]}60)`);

    // Labels
    g.selectAll('text.pr-number')
      .data(nodes.filter((d: any) => d.r > 20)).enter()
      .append('text')
      .attr('x', (d: any) => Math.max(d.r, Math.min(width - d.r, d.x ?? width / 2)))
      .attr('y', (d: any) => Math.max(d.r, Math.min(height - d.r, d.y ?? height / 2)))
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', '#e2e8f0')
      .attr('font-size', (d: any) => Math.min(d.r / 2.5, 14))
      .attr('font-weight', '600')
      .attr('font-family', 'Inter')
      .attr('pointer-events', 'none')
      .text((d: any) => `#${d.number}`);

    // Hover
    circles
      .on('mouseover', function (event: any, d: any) {
        d3.select(this).attr('fill', healthColor[d.health as BubbleHealth] + '55');
        const rect = containerRef.current!.getBoundingClientRect();
        setTooltip({ visible: true, x: event.clientX - rect.left, y: event.clientY - rect.top, pr: d });
      })
      .on('mousemove', function (event: any) {
        const rect = containerRef.current!.getBoundingClientRect();
        setTooltip((t) => ({ ...t, x: event.clientX - rect.left, y: event.clientY - rect.top }));
      })
      .on('mouseout', function (_: any, d: any) {
        d3.select(this).attr('fill', healthColor[d.health as BubbleHealth] + (d.id === selectedId ? '45' : '30'));
        setTooltip((t) => ({ ...t, visible: false }));
      })
      .on('click', function (_: any, d: any) {
        onSelect(d);
      });
  }, [data, onSelect, selectedId]);

  return (
    <div ref={containerRef} className="relative" style={{ width: '100%', overflowY: 'auto', maxHeight: 520 }}>
      <svg ref={svgRef} style={{ width: '100%', display: 'block' }} />
      {tooltip.visible && tooltip.pr && (
        <div className="glass-card pointer-events-none absolute z-10 p-3"
          style={{ left: tooltip.x + 12, top: tooltip.y - 40, minWidth: 220, fontSize: 12 }}>
          <div className="font-medium mb-1">PR #{tooltip.pr.number}</div>
          <div style={{ color: 'var(--color-text-secondary)' }} className="truncate mb-2">{tooltip.pr.title}</div>
          <div className="flex gap-2 flex-wrap mb-2">
            <span style={{ color: 'var(--color-healthy)' }}>+{tooltip.pr.linesAdded}</span>
            <span style={{ color: 'var(--color-danger)' }}>-{tooltip.pr.linesRemoved}</span>
            <span className={`badge badge-${tooltip.pr.health === 'healthy' ? 'healthy' : tooltip.pr.health === 'at-risk' ? 'warning' : 'danger'}`}>
              {tooltip.pr.health}
            </span>
            <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{tooltip.pr.complexity}</span>
          </div>
          {/* Nuance signal — the key PS-03 differentiator */}
          {tooltip.pr.stallReason && STALL_META[tooltip.pr.stallReason] && (
            <div style={{
              marginTop: 4,
              padding: '3px 8px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              background: STALL_META[tooltip.pr.stallReason].color + '22',
              color: STALL_META[tooltip.pr.stallReason].color,
              border: `1px solid ${STALL_META[tooltip.pr.stallReason].color}55`,
            }}>
              {STALL_META[tooltip.pr.stallReason].label}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- PR Health Page ---------- */
export default function PRHealthPage() {
  const [selectedPR, setSelectedPR] = useState<PRBubble | null>(null);
  const [bubblePage, setBubblePage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: bubbleResp, isLoading: bubbleLoading } = useQuery({
    queryKey: ['bubble-matrix', bubblePage],
    queryFn: () => api.get(`/prs/bubble-matrix?page=${bubblePage}`).then(r => r.data),
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
  });

  const bubbleData: PRBubble[] = bubbleResp?.data ?? [];
  const totalPages = bubbleResp?.totalPages ?? 1;
  const totalOpen  = bubbleResp?.total ?? 0;
  const autoAssignMutation = useMutation({
    mutationFn: (prId: string) => api.post(`/auto-assign/${prId}`),
    onSuccess: (res) => {
      const { data } = res.data;
      const methodLabel = data.method === 'github_assigned'
        ? 'Assigned via GitHub'
        : data.method === 'comment_tagged'
          ? 'Tagged via comment'
          : 'Notified via socket';
      toast.success(`✅ @${data.reviewer.username} — ${methodLabel}`);
      // Refresh bubble data from MongoDB so the reviewer card is populated from DB
      queryClient.invalidateQueries({ queryKey: ['bubble-matrix'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Auto-assign failed');
    },
  });

  const { data: histoData, isLoading: histoLoading } = useQuery({
    queryKey: ['latency-histogram'],
    queryFn: () => api.get('/prs/stats/latency-histogram').then(r => r.data.data),
  });

  const stalled = bubbleData?.filter((b: any) => b.health === 'stalled').length ?? 0;
  const atRisk = bubbleData?.filter((b: any) => b.health === 'at-risk').length ?? 0;
  const stallCounts = Object.entries(
    (bubbleData || []).reduce((acc: Record<string, number>, pr: any) => {
      if (pr.stallReason) acc[pr.stallReason] = (acc[pr.stallReason] || 0) + 1;
      return acc;
    }, {})
  );

  const filteredBubbleData = useMemo(() => {
    return (bubbleData || []).filter((pr: PRBubble) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase().replace('#', '').trim();
      return pr.title?.toLowerCase().includes(q) 
        || pr.author?.toLowerCase().includes(q) 
        || pr.number?.toString().includes(q);
    });
  }, [bubbleData, searchQuery]);

  useEffect(() => {
    if (!filteredBubbleData || filteredBubbleData.length === 0) {
      if (selectedPR !== null) setSelectedPR(null);
      return;
    }

    setSelectedPR((current: PRBubble | null) => {
      if (current) {
        const updated = filteredBubbleData.find((pr: PRBubble) => pr.id === current.id);
        if (updated) return updated;
      }
      return filteredBubbleData[0] || null;
    });
  }, [filteredBubbleData]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-8 animate-fade-in">
        <div className="p-2 rounded-xl" style={{ background: 'rgba(124,58,237,0.15)' }}>
          <GitPullRequest size={20} style={{ color: 'var(--color-accent-1)' }} />
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold">PR Health</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>Bubble = lines changed · Color = activity health</p>
        </div>
        
        {/* Search Bar */}
        <div className="ml-4 flex-1 max-w-md relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search PR title, author, or #..."
            className="ps-input w-full pl-9 py-2 text-sm bg-[var(--glass-bg)] border-[var(--glass-border)]"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="ml-auto flex gap-3">
          {[['healthy', '#10b981', 'Active'], ['at-risk', '#f59e0b', 'At Risk'], ['stalled', '#ef4444', 'Stalled']].map(([key, color, label]) => (
            <div key={key} className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              <div className="w-3 h-3 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Summary badges */}
      <div className="flex gap-3 mb-6 animate-fade-in delay-100">
        <div className="glass-card px-4 py-3 flex items-center gap-2">
          <GitPullRequest size={14} style={{ color: 'var(--color-accent-1)' }} />
          <span className="text-sm"><strong>{totalOpen}</strong> open PRs</span>
        </div>
        <div className="glass-card px-4 py-3 flex items-center gap-2">
          <AlertCircle size={14} style={{ color: 'var(--color-danger)' }} />
          <span className="text-sm"><strong>{stalled}</strong> stalled</span>
        </div>
        <div className="glass-card px-4 py-3 flex items-center gap-2">
          <AlertCircle size={14} style={{ color: 'var(--color-warning)' }} />
          <span className="text-sm"><strong>{atRisk}</strong> at risk</span>
        </div>
      </div>

      {stallCounts.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-6 animate-fade-in delay-100">
          {stallCounts.map(([reason, count]) => {
            const meta = STALL_META[reason];
            if (!meta) return null;
            return (
              <div
                key={reason}
                className="glass-card px-4 py-3 flex items-center gap-2"
                style={{ borderColor: `${meta.color}55` }}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: meta.color }} />
                <span className="text-sm" style={{ color: meta.color }}>
                  {meta.label}
                </span>
                <span className="badge badge-accent">{count as number}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="bento-grid">
        {/* D3 Bubble Matrix */}
        <div className="glass-card p-6 animate-scale-in" style={{ gridColumn: 'span 8' }}>
          <h3 className="font-medium text-sm mb-4">Open PR Bubble Matrix</h3>
          {bubbleLoading ? (
            <div className="skeleton" style={{ height: 480 }} />
          ) : filteredBubbleData?.length > 0 ? (
            <>
              <BubbleMatrix
                data={filteredBubbleData}
                selectedId={selectedPR?.id || null}
                onSelect={setSelectedPR}
              />
              {/* Pagination */}
              <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid var(--glass-border)' }}>
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  Showing page {bubblePage} of {totalPages} &bull; {totalOpen} open PRs total
                </span>
                <div className="flex gap-2">
                  {bubblePage > 1 && (
                    <button onClick={() => setBubblePage(p => p - 1)} className="btn-ghost" style={{ fontSize: 12, padding: '4px 12px' }}>
                      ← Prev
                    </button>
                  )}
                  {bubblePage < totalPages && (
                    <button onClick={() => setBubblePage(p => p + 1)} className="btn-magnetic" style={{ fontSize: 12, padding: '4px 14px' }}>
                      Load More →
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center" style={{ height: 380, color: 'var(--color-text-muted)' }}>
              <GitPullRequest size={40} className="mb-3" style={{ opacity: 0.3 }} />
              <p>No open PRs found</p>
              <p className="text-xs mt-1">Connect a GitHub repo to see data</p>
            </div>
          )}
        </div>

        <div className="glass-card p-6 animate-fade-in-up delay-150" style={{ gridColumn: 'span 4' }}>
          <div className="flex items-center gap-2 mb-4">
            <GitBranch size={14} style={{ color: 'var(--color-accent-1)' }} />
            <h3 className="font-medium text-sm">PR Detail</h3>
          </div>
          {selectedPR ? (
            <div className="space-y-4">
              <div>
                <div className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
                  {selectedPR.repo}
                </div>
                <div className="font-medium text-base">PR #{selectedPR.number}</div>
                <div className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                  {selectedPR.title}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl p-4" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <GaugeCircle size={14} style={{ color: 'var(--color-accent-2)' }} />
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Ship Probability</span>
                  </div>
                  <div
                    className="font-display text-2xl"
                    style={{
                      color: (selectedPR.shipProbability || 0) >= 75
                        ? '#10b981'
                        : (selectedPR.shipProbability || 0) >= 45
                          ? '#f59e0b'
                          : '#ef4444',
                    }}
                  >
                    {selectedPR.shipProbability ?? 0}%
                  </div>
                </div>

                <div className="rounded-xl p-4" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp size={14} style={{ color: 'var(--color-accent-1)' }} />
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Complexity</span>
                  </div>
                  <div className="font-display text-2xl" style={{ color: 'var(--color-text-primary)' }}>
                    {selectedPR.complexity}
                  </div>
                </div>
              </div>

              {/* Reviewer Status + Auto-Assign */}
              {(() => {
                // Read directly from MongoDB data (returned by bubble-matrix)
                const reviewers: Array<{ username: string; displayName: string; avatarUrl: string; assignmentMethod: string; }> = selectedPR.reviewers || [];
                const hasReviewer = selectedPR.hasReviewer || reviewers.length > 0;
                const latestReviewer = reviewers[reviewers.length - 1]; // most recently assigned
                return (
                  <div className="space-y-3">
                    <div className="flex gap-2 flex-wrap">
                      <span className={`badge badge-${selectedPR.health === 'healthy' ? 'healthy' : selectedPR.health === 'at-risk' ? 'warning' : 'danger'}`}>
                        {selectedPR.health}
                      </span>
                      {selectedPR.stallReason && STALL_META[selectedPR.stallReason] && (
                        <span className="badge" style={{ background: `${STALL_META[selectedPR.stallReason].color}22`, color: STALL_META[selectedPR.stallReason].color, border: `1px solid ${STALL_META[selectedPR.stallReason].color}55` }}>
                          {STALL_META[selectedPR.stallReason].label}
                        </span>
                      )}
                      {hasReviewer ? (
                        <span className="badge badge-healthy">✓ Reviewer Assigned</span>
                      ) : (
                        <span className="badge badge-warning">Needs reviewer</span>
                      )}
                    </div>

                    {/* Persistent reviewer card — reads from MongoDB, survives page refresh */}
                    {latestReviewer && (
                      <div className="rounded-xl p-4" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)' }}>
                        <div className="text-xs mb-3 font-semibold" style={{ color: '#10b981', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Assigned Reviewer</div>
                        <div className="flex items-center gap-3">
                          {latestReviewer.avatarUrl ? (
                            <img src={latestReviewer.avatarUrl} alt={latestReviewer.username} style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid rgba(16,185,129,0.5)' }} />
                          ) : (
                            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#7c3aed,#06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                              {latestReviewer.username[0].toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-sm">{latestReviewer.displayName || latestReviewer.username}</div>
                            <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>@{latestReviewer.username}</div>
                          </div>
                        </div>
                        <div className="mt-2 text-xs" style={{ color: '#10b981' }}>
                          ✓ {latestReviewer.assignmentMethod === 'github_assigned' ? 'Assigned via GitHub' : latestReviewer.assignmentMethod === 'comment_tagged' ? 'Tagged via comment' : 'Notified via socket'}
                        </div>
                      </div>
                    )}

                    {/* Auto-Assign Button — only when no reviewer yet */}
                    {!hasReviewer && (
                      <button
                        onClick={() => autoAssignMutation.mutate(selectedPR.id)}
                        disabled={autoAssignMutation.isPending}
                        className="w-full flex items-center justify-center gap-2 text-sm font-semibold rounded-xl py-3 transition-all"
                        style={{
                          background: autoAssignMutation.isPending ? 'var(--glass-bg)' : 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(6,182,212,0.2))',
                          border: '1px solid rgba(124,58,237,0.3)',
                          color: autoAssignMutation.isPending ? 'var(--color-text-muted)' : 'var(--color-accent-2)',
                          cursor: autoAssignMutation.isPending ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <UserPlus size={14} />
                        {autoAssignMutation.isPending ? 'Assigning...' : 'Auto-Assign Reviewer'}
                      </button>
                    )}
                  </div>
                );
              })()}


              <div className="rounded-xl p-4" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
                <div className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>Change Surface</div>
                <div className="flex gap-4 text-sm">
                  <span style={{ color: 'var(--color-healthy)' }}>+{selectedPR.linesAdded}</span>
                  <span style={{ color: 'var(--color-danger)' }}>-{selectedPR.linesRemoved}</span>
                </div>
              </div>

              {/* View Risk Analysis Link */}
              <button
                onClick={() => navigate(`/risk/${selectedPR.id}`)}
                className="w-full flex items-center justify-center gap-2 text-sm font-semibold rounded-xl py-3 mt-4 transition-all"
                style={{
                  background: 'rgba(6,182,212,0.1)',
                  border: '1px solid rgba(6,182,212,0.3)',
                  color: 'var(--color-accent-2)',
                }}
              >
                <Info size={14} />
                View Full AI Risk Analysis
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Select a PR bubble to inspect details
            </div>
          )}
        </div>

        {/* Review Latency Histogram */}
        <div className="glass-card p-6 animate-fade-in-up delay-200" style={{ gridColumn: 'span 4' }}>
          <div className="flex items-center gap-2 mb-4">
            <Clock size={14} style={{ color: 'var(--color-accent-2)' }} />
            <h3 className="font-medium text-sm">Review Latency Distribution</h3>
          </div>
          {histoLoading ? <div className="skeleton h-64" /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={histoData || []} layout="vertical" margin={{ left: 0, right: 10 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="label" width={50} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'rgba(10,15,35,0.9)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: any) => [v, 'PRs']}
                />
                <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={24}>
                  {(histoData || []).map((_: any, i: number) => (
                    <Cell key={i} fill={i < 2 ? '#10b981' : i < 4 ? '#f59e0b' : '#ef4444'}
                      style={{ filter: `drop-shadow(0 0 4px ${i < 2 ? '#10b98155' : i < 4 ? '#f59e0b55' : '#ef444455'})` }} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
