import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CalendarRange, Clipboard, Download, FileText, Sparkles } from 'lucide-react';
import api from '../lib/api';
import { openAlertBox } from '../lib/toast';

function toInputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function renderMarkdown(markdown: string) {
  const lines = markdown.split('\n');
  const html = lines.map((line) => {
    if (line.startsWith('### ')) return `<h3>${escapeHtml(line.slice(4))}</h3>`;
    if (line.startsWith('## ')) return `<h2>${escapeHtml(line.slice(3))}</h2>`;
    if (line.startsWith('# ')) return `<h1>${escapeHtml(line.slice(2))}</h1>`;
    if (line.startsWith('- ')) return `<li>${escapeInline(line.slice(2))}</li>`;
    if (!line.trim()) return '<br />';
    return `<p>${escapeInline(line)}</p>`;
  }).join('');

  return html.replace(/(<li>.*?<\/li>)/g, '<ul>$1</ul>').replace(/<\/ul><ul>/g, '');
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeInline(text: string) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

export default function ChangelogPage() {
  const [startDate, setStartDate] = useState(toInputDate(new Date(Date.now() - 13 * 24 * 3600 * 1000)));
  const [endDate, setEndDate] = useState(toInputDate(new Date()));
  const [markdown, setMarkdown] = useState('# Changelog\n\nGenerate a draft from merged PRs to preview it here.\n');

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/ai/generate-changelog', { startDate, endDate });
      return res.data.data;
    },
    onSuccess: (data) => {
      setMarkdown(data.markdown);
      openAlertBox('success', data.aiEnabled ? 'AI changelog generated.' : 'Fallback changelog generated.');
    },
    onError: (err: any) => openAlertBox('error', err.response?.data?.message || 'Failed to generate changelog'),
  });

  const renderedMarkdown = useMemo(() => renderMarkdown(markdown), [markdown]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(markdown);
    openAlertBox('success', 'Changelog copied to clipboard.');
  };

  const handleExport = () => {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'CHANGELOG.md';
    anchor.click();
    URL.revokeObjectURL(url);
    openAlertBox('success', 'CHANGELOG.md exported.');
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-8 animate-fade-in">
        <div className="p-2 rounded-xl" style={{ background: 'rgba(6,182,212,0.15)' }}>
          <FileText size={20} style={{ color: 'var(--color-accent-2)' }} />
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold">AI Changelog</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
            Generate Keep a Changelog markdown from merged PRs over a date range
          </p>
        </div>
        <span className="badge badge-accent ml-auto flex items-center gap-1">
          <Sparkles size={10} /> Gemini Flash
        </span>
      </div>

      <div className="bento-grid">
        <div className="glass-card p-6" style={{ gridColumn: 'span 4' }}>
          <div className="flex items-center gap-2 mb-4">
            <CalendarRange size={16} style={{ color: 'var(--color-accent-1)' }} />
            <h3 className="font-medium text-sm">Range</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>Start date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-4 py-3 rounded-xl text-sm"
                style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--color-text-primary)' }} />
            </div>
            <div>
              <label className="block text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>End date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-4 py-3 rounded-xl text-sm"
                style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--color-text-primary)' }} />
            </div>
            <button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending} className="btn-magnetic w-full">
              {generateMutation.isPending ? 'Generating...' : 'Generate Changelog'}
            </button>
            <div className="flex gap-3">
              <button onClick={handleCopy} className="btn-ghost flex-1 flex items-center justify-center gap-2">
                <Clipboard size={14} /> Copy
              </button>
              <button onClick={handleExport} className="btn-ghost flex-1 flex items-center justify-center gap-2">
                <Download size={14} /> Export
              </button>
            </div>
          </div>
        </div>

        <div className="glass-card p-6" style={{ gridColumn: 'span 8' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-sm">Rendered Markdown</h3>
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Keep a Changelog preview</span>
          </div>
          <div
            className="rounded-2xl p-6 prose prose-invert max-w-none"
            style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', minHeight: 420 }}
            dangerouslySetInnerHTML={{ __html: renderedMarkdown }}
          />
        </div>

        <div className="glass-card p-6" style={{ gridColumn: 'span 12' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-sm">Raw Markdown</h3>
            <span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>CHANGELOG.md</span>
          </div>
          <textarea
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            className="w-full rounded-2xl p-4 text-sm font-mono"
            style={{ minHeight: 280, background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--color-text-primary)' }}
          />
        </div>
      </div>
    </div>
  );
}
