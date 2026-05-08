import { useEffect, useRef, useState } from 'react';
import { Bot, Send, Sparkles, User } from 'lucide-react';
import api from '../lib/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const QUICK_PROMPTS = [
  'Why is our sprint score dropping?',
  'Which PRs are at risk this week?',
  'Who should review the latest PRs?',
  'What are the top blockers right now?',
];

const DEFAULT_MESSAGE: Message = {
  role: 'assistant',
  content: 'I am your FlowMetric AI assistant. I use sprint state, stalled PRs, reviewer loads, and recent conversation history to surface process signals grounded in live PR data.',
  timestamp: new Date(),
};

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([DEFAULT_MESSAGE]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [loadError, setLoadError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadLatestSession() {
      try {
        const { data } = await api.get('/ai/session/latest');
        if (cancelled || !data?.data) return;

        setSessionId(data.data.sessionId);
        if (data.data.messages?.length) {
          setMessages(data.data.messages.map((msg: { role: 'user' | 'assistant'; content: string; createdAt?: string }) => ({
            role: msg.role,
            content: msg.content,
            timestamp: msg.createdAt ? new Date(msg.createdAt) : new Date(),
          })));
        }
      } catch (err: any) {
        if (!cancelled) setLoadError(err.response?.data?.message || 'Failed to load AI conversation history');
      }
    }

    loadLatestSession();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  async function streamChat(text: string) {
    const token = localStorage.getItem('devdeck_token');
    const response = await fetch('/api/ai/chat/stream', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        message: text,
        sessionId,
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`AI request failed with status ${response.status}`);
    }

    setMessages((prev) => [...prev, { role: 'assistant', content: '', timestamp: new Date() }]);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';

      for (const event of events) {
        const line = event.split('\n').find((entry) => entry.startsWith('data: '));
        if (!line) continue;

        const payload = JSON.parse(line.slice(6));
        if (payload.type === 'session' && payload.sessionId) {
          setSessionId(payload.sessionId);
          continue;
        }

        if (payload.type === 'chunk') {
          setMessages((prev) => {
            const next = [...prev];
            const lastIndex = next.length - 1;
            if (lastIndex >= 0 && next[lastIndex].role === 'assistant') {
              next[lastIndex] = {
                ...next[lastIndex],
                content: next[lastIndex].content + payload.content,
              };
            }
            return next;
          });
          continue;
        }

        if (payload.type === 'error') {
          throw new Error(payload.message || 'Streaming request failed');
        }
      }
    }
  }

  const handleSend = async (msg?: string) => {
    const text = msg || input.trim();
    if (!text || isStreaming) return;

    setMessages((prev) => [...prev, { role: 'user', content: text, timestamp: new Date() }]);
    setInput('');
    setIsStreaming(true);
    setLoadError('');

    try {
      await streamChat(text);
    } catch (err: any) {
      setMessages((prev) => {
        const next = [...prev];
        if (next[next.length - 1]?.role === 'assistant' && next[next.length - 1]?.content === '') {
          next.pop();
        }
        return [...next, {
          role: 'assistant',
          content: err.message || 'The assistant request failed.',
          timestamp: new Date(),
        }];
      });
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div style={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
      <div className="flex items-center gap-3 mb-6 animate-fade-in flex-shrink-0">
        <div className="p-2 rounded-xl animate-pulse-glow" style={{ background: 'rgba(124,58,237,0.15)' }}>
          <Bot size={20} style={{ color: 'var(--color-accent-1)' }} />
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold">AI Assistant</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
            Grounded in sprint state, stalled PRs, reviewer loads, and recent conversation history
          </p>
        </div>
        <span className="badge badge-accent ml-auto flex items-center gap-1">
          <Sparkles size={10} /> Gemini Flash
        </span>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 flex-shrink-0 animate-fade-in delay-100">
        {QUICK_PROMPTS.map((q) => (
          <button key={q} onClick={() => handleSend(q)} className="btn-ghost text-xs" style={{ padding: '6px 14px' }}>
            {q}
          </button>
        ))}
      </div>

      {loadError && (
        <div className="glass-card mb-4 px-4 py-3 text-sm" style={{ color: '#f59e0b' }}>
          {loadError}
        </div>
      )}

      <div className="glass-card flex-1 overflow-y-auto p-6 space-y-4" style={{ minHeight: 0 }}>
        {messages.map((msg, i) => (
          <div key={`${msg.role}-${i}-${msg.timestamp.toISOString()}`} className={`flex gap-3 animate-fade-in-up ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                background: msg.role === 'assistant' ? 'rgba(124,58,237,0.2)' : 'rgba(6,182,212,0.2)',
                border: '1px solid var(--glass-border)',
              }}
            >
              {msg.role === 'assistant'
                ? <Bot size={14} style={{ color: 'var(--color-accent-1)' }} />
                : <User size={14} style={{ color: 'var(--color-accent-2)' }} />}
            </div>
            <div
              className={`max-w-2xl px-4 py-3 rounded-2xl text-sm leading-relaxed ${msg.role === 'user' ? 'rounded-tr-none' : 'rounded-tl-none'}`}
              style={{
                background: msg.role === 'user' ? 'rgba(6,182,212,0.1)' : 'var(--glass-bg)',
                border: `1px solid ${msg.role === 'user' ? 'rgba(6,182,212,0.2)' : 'var(--glass-border)'}`,
                whiteSpace: 'pre-wrap',
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isStreaming && (
          <div className="flex gap-3 animate-fade-in">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.2)' }}>
              <Bot size={14} style={{ color: 'var(--color-accent-1)' }} />
            </div>
            <div className="px-4 py-3 rounded-2xl rounded-tl-none flex gap-1 items-center" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-2 h-2 rounded-full" style={{ background: 'var(--color-accent-1)', animation: `pulse-glow 1.2s ${i * 0.2}s ease-in-out infinite` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-3 mt-4 flex-shrink-0 animate-fade-in delay-200">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="Ask about sprint health, blockers, reviewer recommendations..."
          className="flex-1 px-4 py-3 rounded-xl text-sm"
          style={{
            background: 'var(--glass-bg)',
            border: '1px solid var(--glass-border)',
            color: 'var(--color-text-primary)',
            outline: 'none',
          }}
        />
        <button onClick={() => handleSend()} disabled={!input.trim() || isStreaming} className="btn-magnetic" style={{ padding: '12px 20px' }}>
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
