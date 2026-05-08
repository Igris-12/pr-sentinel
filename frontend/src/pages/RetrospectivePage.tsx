import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, History, Save, Sparkles } from 'lucide-react';
import api from '../lib/api';
import { openAlertBox } from '../lib/toast';

function toInputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default function RetrospectivePage() {
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState(toInputDate(new Date(Date.now() - 13 * 24 * 3600 * 1000)));
  const [endDate, setEndDate] = useState(toInputDate(new Date()));
  const [title, setTitle] = useState('Sprint Retrospective');
  const [content, setContent] = useState('# Sprint Retrospective\n\nGenerate a draft to begin.\n');

  const retroHistory = useQuery({
    queryKey: ['retrospectives'],
    queryFn: async () => {
      const res = await api.get('/ai/retrospectives');
      return res.data.data;
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/ai/generate-retro', { startDate, endDate });
      return res.data.data;
    },
    onSuccess: (data) => {
      setContent(data.draft);
      setTitle(`Sprint Retro ${startDate} to ${endDate}`);
      openAlertBox('success', data.aiEnabled ? 'AI retrospective draft generated.' : 'Fallback retrospective draft generated.');
    },
    onError: (err: any) => openAlertBox('error', err.response?.data?.message || 'Failed to generate retrospective'),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/ai/retrospectives', {
        title,
        sprintStart: startDate,
        sprintEnd: endDate,
        content,
      });
      return res.data.data;
    },
    onSuccess: () => {
      openAlertBox('success', 'Retrospective saved.');
      queryClient.invalidateQueries({ queryKey: ['retrospectives'] });
    },
    onError: (err: any) => openAlertBox('error', err.response?.data?.message || 'Failed to save retrospective'),
  });

  const sortedHistory = useMemo(() => retroHistory.data || [], [retroHistory.data]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-8 animate-fade-in">
        <div className="p-2 rounded-xl" style={{ background: 'rgba(124,58,237,0.15)' }}>
          <ClipboardList size={20} style={{ color: 'var(--color-accent-1)' }} />
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold">Sprint Retro</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
            Draft a retrospective from sprint metrics, stall patterns, and churn outliers
          </p>
        </div>
        <span className="badge badge-accent ml-auto flex items-center gap-1">
          <Sparkles size={10} /> Gemini Flash
        </span>
      </div>

      <div className="bento-grid">
        <div className="glass-card p-6" style={{ gridColumn: 'span 4' }}>
          <h3 className="font-medium text-sm mb-4">Draft Controls</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-4 py-3 rounded-xl text-sm"
                style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--color-text-primary)' }} />
            </div>
            <div>
              <label className="block text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>Sprint start</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-4 py-3 rounded-xl text-sm"
                style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--color-text-primary)' }} />
            </div>
            <div>
              <label className="block text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>Sprint end</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-4 py-3 rounded-xl text-sm"
                style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--color-text-primary)' }} />
            </div>
            <button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending} className="btn-magnetic w-full">
              {generateMutation.isPending ? 'Generating...' : 'Generate Draft'}
            </button>
            <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !content.trim()} className="btn-ghost w-full flex items-center justify-center gap-2">
              <Save size={14} /> {saveMutation.isPending ? 'Saving...' : 'Save Retro'}
            </button>
          </div>
        </div>

        <div className="glass-card p-6" style={{ gridColumn: 'span 8' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-sm">Editable Draft</h3>
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Team can edit before saving</span>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full rounded-2xl p-4 text-sm"
            style={{ minHeight: 480, background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--color-text-primary)' }}
          />
        </div>

        <div className="glass-card p-6" style={{ gridColumn: 'span 12' }}>
          <div className="flex items-center gap-2 mb-4">
            <History size={16} style={{ color: 'var(--color-accent-2)' }} />
            <h3 className="font-medium text-sm">Past Retrospectives</h3>
          </div>
          {!sortedHistory.length ? (
            <p style={{ color: 'var(--color-text-muted)' }}>No saved retrospectives yet.</p>
          ) : (
            <div className="space-y-3">
              {sortedHistory.map((retro: any) => (
                <button
                  key={retro._id}
                  onClick={() => {
                    setTitle(retro.title);
                    setStartDate(String(retro.sprintStart).slice(0, 10));
                    setEndDate(String(retro.sprintEnd).slice(0, 10));
                    setContent(retro.content);
                  }}
                  className="w-full text-left rounded-2xl p-4"
                  style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
                >
                  <div className="font-medium">{retro.title}</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                    {String(retro.sprintStart).slice(0, 10)} to {String(retro.sprintEnd).slice(0, 10)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
