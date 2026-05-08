import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Network, Search, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import api from '../lib/api';

// ─── Types ──────────────────────────────────────────────────────────────────
interface HeatmapCell {
  count: number;
  rubberStampRate: number;
  avgTimeHours: number;
  avgDepth: number;
  score: number;
}

interface HeatmapNode {
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

interface HeatmapData {
  nodes: HeatmapNode[];
  matrix: Record<string, Record<string, HeatmapCell>>;
  metrics?: {
    knowledgeDiffusion: number;
    insight: string;
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function getScoreColor(score: number): string {
  if (score > 0.7) return 'rgba(63, 185, 80, 0.2)'; // Green
  if (score >= 0.4) return 'rgba(210, 153, 34, 0.2)'; // Yellow
  return 'rgba(248, 81, 73, 0.2)'; // Red
}

function getScoreBorder(score: number): string {
  if (score > 0.7) return 'rgba(63, 185, 80, 0.8)';
  if (score >= 0.4) return 'rgba(210, 153, 34, 0.8)';
  return 'rgba(248, 81, 73, 0.8)';
}

function Avatar({ node, size = 28 }: { node: HeatmapNode; size?: number }) {
  if (node.avatarUrl) {
    return (
      <img
        src={node.avatarUrl}
        alt={node.username}
        style={{ width: size, height: size, borderRadius: '50%', border: '2px solid var(--ps-border)', objectFit: 'cover' }}
        onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${node.username}&background=6577f3&color=fff`; }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #6577f3, #00cba9)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: 700, color: 'white'
    }}>
      {node.username?.[0]?.toUpperCase()}
    </div>
  );
}

// ─── HeatmapPage ────────────────────────────────────────────────────────────
export default function HeatmapPage() {
  const [days, setDays] = useState(30);
  const [searchTerm, setSearchTerm] = useState('');
  const [hoveredCell, setHoveredCell] = useState<{ r: string; a: string } | null>(null);

  const { data, isLoading } = useQuery<HeatmapData>({
    queryKey: ['heatmap', days],
    queryFn: () => api.get(`/heatmap?days=${days}`).then(res => res.data.data),
    staleTime: 60_000,
  });

  const filteredNodes = useMemo(() => {
    if (!data) return [];
    return data.nodes.filter(n =>
      n.username.toLowerCase().includes(searchTerm.toLowerCase()) || 
      n.displayName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [data, searchTerm]);

  // Make sure we have a stable order for rows/cols
  const sortedNodes = [...filteredNodes].sort((a, b) => a.username.localeCompare(b.username));

  // Default skeleton nodes to show the UI even without database data
  const displayNodes = sortedNodes.length > 0 ? sortedNodes : [
    { username: 'dev1', displayName: 'Developer A', avatarUrl: null },
    { username: 'dev2', displayName: 'Developer B', avatarUrl: null },
    { username: 'dev3', displayName: 'Developer C', avatarUrl: null },
    { username: 'dev4', displayName: 'Developer D', avatarUrl: null },
    { username: 'dev5', displayName: 'Developer E', avatarUrl: null },
  ];
  const displayMatrix = data?.matrix || {};

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', paddingBottom: 60 }}>
      {/* ── Header ── */}
      <div className="page-header animate-fade-in">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ padding: '6px 8px', borderRadius: 10, background: 'var(--ps-cyan-dim)', display: 'inline-flex' }}>
              <Network size={20} style={{ color: 'var(--ps-cyan)' }} />
            </div>
            Team Review Heatmap
          </h1>
          <p className="page-subtitle">A visual matrix of who reviews whose code and the health of those interactions.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ps-text-muted)' }} />
            <input
              type="text"
              placeholder="Filter developers..."
              className="input-field"
              style={{ width: 220, paddingLeft: 34, paddingRight: 12, height: 36, borderRadius: 100 }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', background: 'var(--ps-surface)', padding: 4, borderRadius: 10, border: '1px solid var(--ps-border)' }}>
            {[
              { value: 1, label: '1 Day' },
              { value: 7, label: '1 Week' },
              { value: 30, label: '1 Month' },
              { value: 365, label: '1 Year' }
            ].map(f => (
              <button
                key={f.value}
                onClick={() => setDays(f.value)}
                style={{
                  padding: '4px 12px', fontSize: 13, fontWeight: 500,
                  borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: days === f.value ? 'var(--ps-cyan-dim)' : 'transparent',
                  color: days === f.value ? 'var(--ps-cyan)' : 'var(--ps-text-muted)',
                  transition: 'all 0.2s',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Loading / Empty states ── */}
      {isLoading && (
        <div style={{ padding: 40, background: 'var(--ps-text-dim)', borderRadius: 16, border: '1px solid var(--ps-border)', height: 500, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div className="spinner" style={{ width: 32, height: 32, borderTopColor: 'var(--ps-cyan)' }} />
        </div>
      )}

      {/* ── Team Health Insight (Knowledge Diffusion) ── */}
      {!isLoading && (
        <div className="ps-card animate-fade-in" style={{ padding: '16px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ 
            width: 54, height: 54, borderRadius: '50%', border: '4px solid', 
            borderColor: data?.metrics?.knowledgeDiffusion >= 0.7 ? 'var(--ps-green)' : data?.metrics?.knowledgeDiffusion >= 0.4 ? 'var(--ps-amber)' : 'var(--ps-red)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 700, color: 'var(--ps-text)'
          }}>
            {data?.metrics ? Math.round(data.metrics.knowledgeDiffusion * 100) : 0}<span style={{ fontSize: 10, color: 'var(--ps-text-muted)' }}>%</span>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ps-text)', marginBottom: 2 }}>Knowledge Diffusion Score</div>
            <div style={{ fontSize: 13, color: 'var(--ps-text-muted)' }}>
              {data.metrics?.insight || 'Connect a repository to analyze knowledge diffusion.'}
            </div>
          </div>
        </div>
      )}

      {/* ── Empty State ── */}
      {!isLoading && (!data || sortedNodes.length === 0) && (
        <div className="ps-card" style={{ padding: '24px 20px', textAlign: 'center', marginBottom: 24 }}>
          <Network size={28} style={{ color: 'var(--ps-cyan)', margin: '0 auto 8px' }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ps-text)', marginBottom: 4 }}>Example Heatmap Matrix</div>
          <div style={{ fontSize: 13, color: 'var(--ps-text)', maxWidth: 500, margin: '0 auto' }}>
            We need at least one developer synced to generate real data. Below is the structural layout of the Team Review Heatmap.
          </div>
        </div>
      )}

      {/* ── Matrix Output ── */}
      {!isLoading && (
        <div className="ps-card animate-fade-in-up" style={{ padding: '24px', overflowX: 'auto' }}>
          
          {/* Legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24, padding: '12px 16px', background: 'var(--ps-hover-overlay)', borderRadius: 10, border: '1px solid var(--ps-border-active)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ps-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Health Key</div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 14, height: 14, borderRadius: 4, background: getScoreColor(0.9), border: `1px solid ${getScoreBorder(0.9)}` }} />
              <span style={{ fontSize: 13, color: 'var(--ps-text)' }}>Healthy</span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 14, height: 14, borderRadius: 4, background: getScoreColor(0.5), border: `1px solid ${getScoreBorder(0.5)}` }} />
              <span style={{ fontSize: 13, color: 'var(--ps-text)' }}>Average</span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 14, height: 14, borderRadius: 4, background: getScoreColor(0.2), border: `1px solid ${getScoreBorder(0.2)}` }} />
              <span style={{ fontSize: 13, color: 'var(--ps-text)' }}>Risky / Bottleneck</span>
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ fontSize: 12, color: 'var(--ps-text-muted)' }}>Hover over a cell to see interaction details</div>
          </div>

          <div style={{ display: 'inline-block', minWidth: '100%' }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: 4, width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ padding: '0 12px 12px 0', textAlign: 'left', borderBottom: '1px solid var(--ps-border)', minWidth: 200 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ps-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Reviewers ↓</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ps-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Authors →</div>
                  </th>
                  {displayNodes.map(author => (
                    <th key={`col-${author.username}`} style={{ padding: '0 4px 12px', borderBottom: '1px solid var(--ps-border)', textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <Avatar node={author} size={28} />
                        <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--ps-text)', maxWidth: 60, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={author.username}>
                          {author.displayName.split(' ')[0]}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayNodes.map(reviewer => (
                  <tr key={`row-${reviewer.username}`}>
                    {/* Row Header */}
                    <td style={{ padding: '8px 12px 8px 0', borderRight: '1px solid var(--ps-border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar node={reviewer} size={28} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ps-text)' }}>
                          {reviewer.displayName}
                        </span>
                      </div>
                    </td>
                    
                    {/* Matrix Cells */}
                    {displayNodes.map(author => {
                      const isSelf = reviewer.username === author.username;
                      const cell = displayMatrix[reviewer.username]?.[author.username];
                      const isHovered = hoveredCell?.r === reviewer.username && hoveredCell?.a === author.username;

                      return (
                        <td 
                          key={`cell-${reviewer.username}-${author.username}`}
                          onMouseEnter={() => setHoveredCell({ r: reviewer.username, a: author.username })}
                          onMouseLeave={() => setHoveredCell(null)}
                          style={{ 
                            padding: 0, 
                            height: 44, 
                            minWidth: 44, 
                            borderRadius: 6,
                            background: isSelf ? 'transparent' : cell ? getScoreColor(cell.score) : 'var(--ps-surface)',
                            border: `1px solid ${isSelf ? 'transparent' : cell ? getScoreBorder(cell.score) : 'var(--ps-border)'}`,
                            position: 'relative',
                            transition: 'all 0.1s ease',
                            cursor: cell ? 'pointer' : 'default',
                            opacity: (hoveredCell && hoveredCell.r === reviewer.username) || (hoveredCell && hoveredCell.a === author.username) ? 1 : hoveredCell ? 0.4 : 1,
                            transform: isHovered && cell ? 'scale(1.08)' : 'scale(1)',
                            zIndex: isHovered ? 10 : 1
                          }}
                        >
                          {isSelf && <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ps-text-muted)' }}>—</div>}
                          {cell && (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--ps-text)' }}>
                              {cell.count}
                            </div>
                          )}

                          {/* Tooltip */}
                          {isHovered && cell && (
                            <div className="ps-card" style={{
                              position: 'absolute',
                              bottom: 'calc(100% + 8px)',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              width: 260,
                              padding: '16px',
                              zIndex: 100,
                              boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
                              pointerEvents: 'none',
                              backdropFilter: 'blur(20px)'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, fontSize: 13, fontWeight: 600, color: 'var(--ps-text)', paddingBottom: 10, borderBottom: '1px solid var(--ps-border)' }}>
                                <span style={{ color: 'var(--ps-cyan)' }}>{reviewer.displayName}</span>
                                <span style={{ color: 'var(--ps-text-muted)' }}>→</span>
                                <span style={{ color: 'var(--ps-accent)' }}>{author.displayName}</span>
                              </div>
                              
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                                  <span style={{ color: 'var(--ps-text-muted)' }}>Total Reviews</span>
                                  <span style={{ fontWeight: 600, color: 'var(--ps-text)' }}>{cell.count}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                                  <span style={{ color: 'var(--ps-text-muted)' }}>Rubber Stamp Rate</span>
                                  <span style={{ fontWeight: 600, color: cell.rubberStampRate > 0.4 ? 'var(--ps-red)' : 'var(--ps-text)' }}>
                                    {(cell.rubberStampRate * 100).toFixed(0)}%
                                  </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                                  <span style={{ color: 'var(--ps-text-muted)' }}>Avg Time to Review</span>
                                  <span style={{ fontWeight: 600, color: 'var(--ps-text)' }}>
                                    {cell.avgTimeHours}h
                                  </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                                  <span style={{ color: 'var(--ps-text-muted)' }}>Avg Review Depth</span>
                                  <span style={{ fontWeight: 600, color: cell.avgDepth < 0.2 ? 'var(--ps-amber)' : 'var(--ps-text)' }}>
                                    {(cell.avgDepth * 100).toFixed(0)}%
                                  </span>
                                </div>
                              </div>

                              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--ps-border)' }}>
                                {cell.score > 0.7 && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ps-green)', fontSize: 12, fontWeight: 500 }}>
                                    <CheckCircle size={12} /> Extremely healthy interactions
                                  </div>
                                )}
                                {cell.score <= 0.7 && cell.score >= 0.4 && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ps-amber)', fontSize: 12, fontWeight: 500 }}>
                                    <Info size={12} /> Standard mix of deep & quick reviews
                                  </div>
                                )}
                                {cell.score < 0.4 && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ps-red)', fontSize: 12, fontWeight: 500 }}>
                                    <AlertTriangle size={12} /> High risk of rubber stamping or bias
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
