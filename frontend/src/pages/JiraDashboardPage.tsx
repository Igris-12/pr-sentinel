import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Kanban, Clock, Zap, AlertTriangle, 
  RefreshCw, TrendingUp, Users, Activity, ExternalLink, Ghost
} from 'lucide-react';
import api from '../lib/api';
import { openAlertBox } from '../lib/toast';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, YAxis } from 'recharts';

export default function JiraDashboardPage() {
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  const { data: dashboardData, isLoading, refetch } = useQuery({
    queryKey: ['jira_dashboard'],
    queryFn: () => api.get('/jira/dashboard').then(r => r.data?.data)
  });

  const syncMutation = useMutation({
    mutationFn: () => api.post('/jira/sync'),
    onMutate: () => setSyncing(true),
    onSuccess: (res) => {
      openAlertBox('success', res.data.message || 'Jira Sync Complete');
      refetch();
    },
    onError: (err: any) => {
      openAlertBox('error', err.response?.data?.message || 'Sync failed');
    },
    onSettled: () => setSyncing(false)
  });

  if (isLoading) {
    return (
      <div className="bento-grid">
        {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-32" style={{ gridColumn: 'span 4' }} />)}
      </div>
    );
  }

  // Handle empty state
  if (!dashboardData || !dashboardData.totalIssues) {
    return (
      <div className="glass-card flex flex-col items-center justify-center p-10 h-96 text-center animate-fade-in">
        <div className="p-4 rounded-full mb-4 bg-purple-500/10 border border-purple-500/20">
          <Kanban size={32} className="text-purple-400" />
        </div>
        <h2 className="font-display text-xl font-bold mb-2">No Jira Data Found</h2>
        <p className="text-slate-400 max-w-sm mb-6">
          Connect your Jira account and sync issues to see workflow analytics, dev workload, and sprint velocity.
        </p>
        <button 
          onClick={() => syncMutation.mutate()} 
          disabled={syncing}
          className="btn-primary flex items-center gap-2"
        >
          <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Syncing...' : 'Sync Jira Now'}
        </button>
      </div>
    );
  }

  const { totalIssues, statusCounts, devWorkload, idleCount, idleTickets, delayData } = dashboardData;
  const maxStoryPoints = Math.max(...devWorkload.map((w: any) => w.points || 0), 1);
  const totalPoints = devWorkload.reduce((sum: number, w: any) => sum + (w.points || 0), 0);
  
  return (
    <div className="animate-fade-in space-y-6 pb-20">
      
      {/* Header Actions */}
      <div className="flex justify-between items-center bg-black/20 p-4 rounded-xl border border-white/5 shadow-2xl backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400 rounded-lg border border-indigo-500/10">
            <Kanban size={22} className="drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
          </div>
          <div>
            <h2 className="font-display font-medium text-lg text-slate-100">Jira Command Center</h2>
            <p className="text-xs text-slate-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Live Tracking {totalIssues} Issues
            </p>
          </div>
        </div>
        <button 
          onClick={() => syncMutation.mutate()} 
          disabled={syncing}
          className="px-4 py-2 hover:bg-white/10 rounded-lg text-sm flex items-center gap-2 border border-white/5 transition-all text-slate-300 hover:text-white"
        >
          <RefreshCw size={14} className={syncing ? 'animate-spin text-indigo-400' : 'text-indigo-400'} />
          {syncing ? 'Syncing Jira...' : 'Force Sync'}
        </button>
      </div>

      <div className="bento-grid">
        
        {/* KPI: Overview */}
        <div className="glass-card p-5 group flex flex-col justify-between hover:border-indigo-500/30 transition-all duration-300 relative overflow-hidden" style={{ gridColumn: 'span 4' }}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
          <div className="flex items-center gap-2 mb-6 text-slate-300">
            <Activity size={16} className="text-indigo-400" />
            <h3 className="font-medium text-sm">Sprint Progress</h3>
          </div>
          <div className="space-y-4 relative z-10">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">To Do</span>
                <span className="text-white font-mono">{statusCounts.todo}</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-slate-500 rounded-full" style={{ width: `${(statusCounts.todo / totalIssues) * 100}%` }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-blue-400">In Progress</span>
                <span className="text-white font-mono">{statusCounts.inProgress}</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.6)]" style={{ width: `${(statusCounts.inProgress / totalIssues) * 100}%` }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-emerald-400">Done</span>
                <span className="text-white font-mono">{statusCounts.done}</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.6)]" style={{ width: `${(statusCounts.done / totalIssues) * 100}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* KPI: Idle Tickets */}
        <div className="glass-card p-5 group hover:border-amber-500/30 transition-all duration-300 relative overflow-hidden flex flex-col justify-between" style={{ gridColumn: 'span 4' }}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
          <div className="flex items-center justify-between mb-4 text-slate-300 relative z-10">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-amber-400" />
              <h3 className="font-medium text-sm">Critical Stalls</h3>
            </div>
            {idleCount > 0 && <AlertTriangle size={14} className="text-amber-400 animate-pulse" />}
          </div>
          <div className="relative z-10">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold font-display text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.4)]">{idleCount}</span>
              <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">Tickets</span>
            </div>
            <div className="text-xs text-slate-400 mt-2">Stalled for &gt; 7 days without code commits</div>
          </div>
        </div>

        {/* KPI: Dev Efficiency */}
        <div className="glass-card p-5 group hover:border-cyan-500/30 transition-all duration-300 relative overflow-hidden flex flex-col justify-between" style={{ gridColumn: 'span 4' }}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
          <div className="flex items-center gap-2 text-slate-300 relative z-10">
            <Zap size={16} className="text-cyan-400" />
            <h3 className="font-medium text-sm">Sprint Velocity</h3>
          </div>
          <div className="relative z-10">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold font-display text-cyan-400 drop-shadow-[0_0_12px_rgba(34,211,238,0.4)]">{totalPoints}</span>
              <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">Points</span>
            </div>
            <div className="text-xs text-slate-400 mt-2">Total Story Points In-Flight</div>
          </div>
        </div>

        {/* ACTION BLOCK: Ghost Tickets Table */}
        <div className="glass-card flex flex-col overflow-hidden" style={{ gridColumn: 'span 8', gridRow: 'span 2' }}>
           <div className="p-5 border-b border-white/5 flex items-center justify-between bg-black/20">
             <div className="flex items-center gap-2">
                <Ghost size={16} className="text-amber-400" />
                <h3 className="font-medium text-sm text-slate-200">Actionable Ghost Tickets</h3>
             </div>
             <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold bg-slate-800 px-2 py-1 rounded-md">Requires Intervention</span>
           </div>
           <div className="flex-1 overflow-y-auto max-h-[300px] p-2 custom-scrollbar">
              {(!idleTickets || idleTickets.length === 0) ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500">
                  <CheckCircle size={24} className="text-emerald-500/50 mb-2" />
                  <p className="text-sm">No stalled tickets found. Great job!</p>
                </div>
              ) : (
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="text-[10px] uppercase text-slate-500 bg-black/10">
                    <tr>
                      <th className="px-4 py-3 font-medium rounded-tl-lg">Ticket</th>
                      <th className="px-4 py-3 font-medium">Assignee</th>
                      <th className="px-4 py-3 font-medium rounded-tr-lg text-right">Stalled</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {idleTickets.map((ticket: any) => (
                      <tr key={ticket.issueKey} className="hover:bg-white/5 transition-colors group">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                             <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">{ticket.issueKey}</span>
                             <span className="text-slate-300 truncate max-w-[200px]" title={ticket.title}>{ticket.title}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {ticket.assigneeAvatar ? (
                              <img src={ticket.assigneeAvatar} className="w-5 h-5 rounded-full" alt="avatar" />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-[9px] text-white">
                                {ticket.assigneeName?.[0] || '?'}
                              </div>
                            )}
                            <span className="text-slate-400 text-xs">{ticket.assigneeName || 'Unassigned'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${ticket.daysStalled > 14 ? 'text-red-400 bg-red-500/10 border border-red-500/20' : 'text-amber-400 bg-amber-500/10 border border-amber-500/20'}`}>
                            {ticket.daysStalled} days
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
           </div>
        </div>

        {/* ACTION BLOCK: Resource Workload */}
        <div className="glass-card p-5" style={{ gridColumn: 'span 4', gridRow: 'span 2' }}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-emerald-400" />
              <h3 className="font-medium text-sm text-slate-200">Resource Allocation</h3>
            </div>
            <span className="text-xs text-slate-500">Max: {maxStoryPoints} pts</span>
          </div>
          <div className="space-y-5">
            {devWorkload.slice(0, 6).map((dev: any) => {
              const workloadPercentage = (dev.points / maxStoryPoints) * 100;
              // Determine color based on workload magnitude
              let barColor = 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]';
              if (workloadPercentage > 80) barColor = 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.5)]';
              else if (workloadPercentage > 50) barColor = 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]';

              return (
                <div key={dev.name} className="group">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {dev.avatar ? (
                        <img src={dev.avatar} alt={dev.name} className="w-5 h-5 rounded-full" />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-[9px] font-bold text-slate-300">
                          {dev.name[0]}
                        </div>
                      )}
                      <span className="text-xs text-slate-300 group-hover:text-white transition-colors">{dev.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-mono">
                      <span className="text-slate-500">{dev.count} tkts</span>
                      <span className="text-slate-300 font-bold">{dev.points} pts</span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800/80 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${barColor} transition-all duration-1000 ease-out`} style={{ width: `${workloadPercentage}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chart: PR Delay vs Ticket Priority */}
        <div className="glass-card p-5" style={{ gridColumn: 'span 12' }}>
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp size={16} className="text-pink-400" />
            <h3 className="font-medium text-sm text-slate-200">Delivery Lead Time (Jira Created → PR Open)</h3>
          </div>
          {delayData && delayData.length > 0 ? (
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={delayData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="delayColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f472b6" stopOpacity={0.6}/>
                      <stop offset="95%" stopColor="#f472b6" stopOpacity={0.05}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="issueKey" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)' }}
                    itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                    labelStyle={{ color: '#94a3b8', fontSize: '10px', marginBottom: '4px' }}
                    cursor={{ stroke: 'rgba(244,114,182,0.3)', strokeWidth: 1, strokeDasharray: '4 4' }}
                  />
                  <Area type="monotone" dataKey="delayDays" name="Days Delayed" stroke="#ec4899" strokeWidth={2} fillOpacity={1} fill="url(#delayColor)" activeDot={{ r: 6, fill: '#ec4899', stroke: '#fff', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-slate-500 border border-dashed border-slate-700/50 rounded-xl bg-slate-800/10">
              <Activity size={32} className="text-slate-600 mb-3" />
              <p className="text-sm">Not enough mapped PR+Jira data to generate analytics yet.</p>
              <p className="text-xs mt-1 text-slate-600">Ensure Jira Issue Keys are present in PR titles.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
