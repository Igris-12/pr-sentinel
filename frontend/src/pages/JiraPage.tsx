import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  ScatterChart, Scatter, ZAxis, CartesianGrid
} from 'recharts';
import { 
  ClipboardList, AlertTriangle, Users, TrendingUp, Clock, CheckCircle2, Circle
} from 'lucide-react';
import React from 'react';

export default function JiraPage() {
  const { data: jiraResp, isLoading } = useQuery({
    queryKey: ['jira-dashboard'],
    queryFn: () => api.get('/jira/dashboard').then(r => r.data),
    refetchInterval: 60_000
  });

  const data = jiraResp?.data;

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center animate-pulse-glow">
        <div className="text-[var(--ps-accent)] flex items-center gap-2 font-semibold">
          <TrendingUp className="animate-spin" /> Fetching Project Analytics...
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col h-[80vh] items-center justify-center text-center animate-fade-in gap-4 max-w-sm mx-auto">
        <div className="w-16 h-16 rounded-full bg-[var(--ps-surface)] border border-[var(--ps-border)] flex items-center justify-center text-[var(--ps-text-muted)]">
          <ClipboardList size={28} />
        </div>
        <h2 className="text-xl font-display font-semibold text-[var(--ps-text)]">No Project Data Available</h2>
        <p className="text-[var(--ps-text-muted)] text-sm">
          It looks like your workspace isn't fully connected to Jira yet, or the synchronization hasn't run.
        </p>
      </div>
    );
  }

  const { totalIssues, statusCounts, devWorkload, idleCount, idleTickets, delayData } = data;

  // Colors based on Status categories
  const STATUS_COLORS = {
    todo: 'var(--ps-text-muted)',
    inProgress: 'var(--ps-accent)',
    done: 'var(--ps-green)'
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Project Tracking</h1>
          <p className="page-subtitle">Jira Issue Analytics, Dev Workload, and Ticket Stagnation</p>
        </div>
      </div>

      <div className="bento-grid mb-6">
        {/* KPI: Total Tickets */}
        <div className="col-span-12 md:col-span-3 ps-card p-6 flex flex-col justify-between">
          <div className="flex items-center gap-3 text-[var(--ps-text-muted)] mb-4">
            <ClipboardList size={18} />
            <h3 className="font-semibold text-sm">Total Tracked Issues</h3>
          </div>
          <div className="kpi-value text-[var(--ps-text)]">
            {totalIssues}
          </div>
        </div>

        {/* KPI: Status Breakdown */}
        <div className="col-span-12 md:col-span-6 ps-card p-6">
           <h3 className="flex items-center gap-3 text-[var(--ps-text-muted)] font-semibold text-sm mb-6">
             <TrendingUp size={18} /> Current Sprint Progress
           </h3>
           <div className="flex items-center justify-between px-4">
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 text-xs font-semibold text-[var(--ps-text-muted)] mb-2 uppercase tracking-wide">
                  <Circle size={12} fill="currentColor" stroke="none" /> To Do
                </div>
                <div className="text-3xl font-display font-bold text-[var(--ps-text)]">{statusCounts.todo}</div>
              </div>
              <div className="h-10 w-px bg-[var(--ps-border)]"></div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 text-xs font-semibold text-[var(--ps-accent)] mb-2 uppercase tracking-wide">
                  <Clock size={12} /> In Progress
                </div>
                <div className="text-3xl font-display font-bold text-[var(--ps-accent)]">{statusCounts.inProgress}</div>
              </div>
              <div className="h-10 w-px bg-[var(--ps-border)]"></div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 text-xs font-semibold text-[var(--ps-green)] mb-2 uppercase tracking-wide">
                  <CheckCircle2 size={12} /> Done
                </div>
                <div className="text-3xl font-display font-bold text-[var(--ps-text)]">{statusCounts.done}</div>
              </div>
           </div>
        </div>

        {/* KPI: Idle Tickets */}
        <div className="col-span-12 md:col-span-3 ps-card p-6 flex flex-col justify-between" style={{ borderColor: idleCount > 5 ? 'var(--ps-red)' : '' }}>
          <div className="flex items-center gap-3 text-[var(--ps-red)] mb-4">
            <AlertTriangle size={18} />
            <h3 className="font-semibold text-sm">Idle Tickets (&gt;7 Days)</h3>
          </div>
          <div className="kpi-value text-[var(--ps-text)] flex items-end gap-2">
            {idleCount} <span className="text-sm font-normal text-[var(--ps-text-muted)] mb-1">stagnant</span>
          </div>
        </div>
      </div>

      <div className="bento-grid">
        {/* Dev Workload Chart */}
        <div className="col-span-12 lg:col-span-7 ps-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="flex items-center gap-3 text-[var(--ps-text)] font-semibold text-[15px]">
              <Users size={18} className="text-[var(--ps-accent)]" /> Active Workload by Developer
            </h3>
            <span className="badge badge-gray text-xs">Tickets in Progress</span>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={devWorkload} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} layout="vertical">
                <XAxis type="number" axisLine={false} tickLine={false} tick={{fill: 'var(--ps-text-muted)', fontSize: 12}} />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: 'var(--ps-text)', fontSize: 12, fontWeight: 500}} width={120} />
                <Tooltip 
                  cursor={{fill: 'var(--ps-surface)'}}
                  contentStyle={{ backgroundColor: 'var(--ps-card)', border: '1px solid var(--ps-border)', borderRadius: '8px' }}
                />
                <Bar dataKey="count" name="Active Tickets" radius={[0, 4, 4, 0]} barSize={24}>
                  {devWorkload.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? 'var(--ps-red)' : index === 1 ? 'var(--ps-amber)' : 'var(--ps-accent)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Idle Tickets List */}
        <div className="col-span-12 lg:col-span-5 ps-card p-0 flex flex-col h-[360px] overflow-hidden">
          <div className="p-5 border-b border-[var(--ps-border)] flex items-center justify-between bg-[var(--ps-surface)] rounded-t-xl">
            <h3 className="font-semibold text-[15px] text-[var(--ps-text)]">Severely Idle Tickets</h3>
            <span className="badge badge-red">{idleTickets.length} Found</span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2">
            {idleTickets.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-[var(--ps-text-muted)] text-sm">
                <CheckCircle2 size={32} className="mb-2 text-[var(--ps-green)] opacity-50" />
                No severely idle tickets!
              </div>
            ) : (
              idleTickets.sort((a: any, b: any) => b.daysStalled - a.daysStalled).map((ticket: any, idx: number) => (
                <div key={idx} className="flex flex-col gap-2 p-4 hover:bg-[var(--ps-hover-overlay)] transition-colors border-b border-[var(--ps-border)] last:border-0 rounded-lg">
                  <div className="flex items-start justify-between">
                    <span className="text-xs font-semibold text-[var(--ps-accent)] bg-[var(--ps-accent-dim)] px-2 py-0.5 rounded uppercase tracking-wider">{ticket.issueKey}</span>
                    <span className="text-xs text-[var(--ps-red)] font-semibold">{ticket.daysStalled} days idle</span>
                  </div>
                  <p className="text-sm text-[var(--ps-text)] font-medium leading-tight">{ticket.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {ticket.assigneeAvatar ? (
                      <img src={ticket.assigneeAvatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-[var(--ps-text-dim)] flex items-center justify-center text-[9px] text-white font-bold">{ticket.assigneeName?.[0] || 'U'}</div>
                    )}
                    <span className="text-[13px] text-[var(--ps-text-muted)]">{ticket.assigneeName || 'Unassigned'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      
    </div>
  );
}
