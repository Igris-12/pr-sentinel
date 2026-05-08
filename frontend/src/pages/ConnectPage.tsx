import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { GitBranch, RefreshCw, CheckCircle2, ArrowRight, Key, Search, Save } from 'lucide-react';
import api from '../lib/api';
import { useAuthStore } from '../store';
import toast from 'react-hot-toast';

const steps = ['Connect GitHub', 'Select Repos', 'Done'];

export default function ConnectPage() {
  const navigate = useNavigate();
  const { user, setAuth } = useAuthStore();
  const [step, setStep] = useState(user?.githubUsername ? 1 : 0);
  const [pat, setPat] = useState('');
  const [patError, setPatError] = useState('');
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(new Set());
  const [addingRepos, setAddingRepos] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [publicRepoUrl, setPublicRepoUrl] = useState('');

  // Connect PAT
  const connectPAT = useMutation({
    mutationFn: (p: string) => api.post('/github/connect-pat', { pat: p }),
    onSuccess: (res) => {
      if (res.data.success) {
        // Update local user state with github username
        if (user) setAuth({ ...user, githubUsername: res.data.githubUsername }, localStorage.getItem('prsentinel_token') || '');
        setStep(1);
        setPatError('');
      }
    },
    onError: (err: any) => setPatError(err.response?.data?.message || 'Failed to connect'),
  });

  // Connect Public Repo
  const handlePublicRepoSubmit = async () => {
    try {
      let owner = '';
      let name = '';
      let url = publicRepoUrl.trim();
      if (url.includes('github.com')) {
        const parts = url.split('/');
        const ghIndex = parts.findIndex(p => p.includes('github.com'));
        owner = parts[ghIndex + 1];
        name = parts[ghIndex + 2]?.replace('.git', '');
      } else if (url.includes('/')) {
        [owner, name] = url.split('/');
      } else {
        throw new Error('Invalid format. Use owner/repo or paste the URL.');
      }
      if (!owner || !name) throw new Error('Could not parse owner and name.');

      toast.loading('Syncing public repository...', { id: 'public-repo' });
      await api.post('/github/aps-repo', { owner, name, fullName: `${owner}/${name}` });
      toast.success(`Connected ${owner}/${name}! Data is syncing in the background.`, { id: 'public-repo' });
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to connect public repo', { id: 'public-repo' });
    }
  };

  // List available repos
  const { data: reposData, isLoading: reposLoading } = useQuery({
    queryKey: ['github-repos'],
    queryFn: () => api.get('/github/repos').then(r => r.data.repos),
    enabled: step === 1,
  });

  // Fetch already connected repos to pre-select them
  const { data: connectedRepos } = useQuery({
    queryKey: ['connected-repos'],
    queryFn: () => api.get('/github/connected-repos').then(r => r.data.repos || []),
    enabled: step === 1,
  });

  // Pre-populate selectedRepos with already connected repos
  useEffect(() => {
    if (connectedRepos && connectedRepos.length > 0) {
      setSelectedRepos((prev) => {
        const next = new Set(prev);
        connectedRepos.forEach((repo: any) => {
          if (repo.fullName) next.add(repo.fullName);
        });
        return next;
      });
    }
  }, [connectedRepos]);

  // Filter repos by search query
  const filteredRepos = (reposData || []).filter((repo: any) =>
    repo.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Set of already-connected repo fullNames for visual distinction
  const connectedSet = new Set(
    (connectedRepos || []).map((r: any) => r.fullName)
  );

  const handleSaveRepos = async () => {
    setAddingRepos(true);
    try {
      // Only add repos that aren't already connected
      const newRepos = [...selectedRepos].filter(r => !connectedSet.has(r));
      for (const fullName of newRepos) {
        const [owner, name] = fullName.split('/');
        await api.post('/github/aps-repo', { owner, name, fullName });
      }
      toast.success(`Saved ${newRepos.length > 0 ? newRepos.length + ' new' : ''} repo selection`);
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save repos');
    } finally {
      setAddingRepos(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        {/* Step indicator */}
        <div className="flex items-center gap-3 mb-10">
          {steps.map((s, i) => (
            <React.Fragment key={s}>
              <div className={`flex items-center gap-2 text-sm font-medium ${i <= step ? 'gradient-text' : ''}`}
                style={{ color: i > step ? 'var(--color-text-muted)' : undefined }}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: i <= step ? 'var(--color-accent-gradient)' : 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
                  {i < step ? <CheckCircle2 size={12} /> : i + 1}
                </div>
                {s}
              </div>
              {i < steps.length - 1 && <div className="flex-1 h-px" style={{ background: 'var(--glass-border)' }} />}
            </React.Fragment>
          ))}
        </div>

        {/* Step 0: PAT Input */}
        {step === 0 && (
          <div className="glass-card p-8 animate-scale-in">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-xl" style={{ background: 'rgba(124,58,237,0.15)' }}>
                <Key size={20} style={{ color: 'var(--color-accent-1)' }} />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold">Connect GitHub</h2>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>Enter a Personal Access Token (PAT)</p>
              </div>
            </div>

            <div className="mb-6 p-4 rounded-xl" style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)' }}>
              <p className="text-sm mb-2" style={{ color: 'var(--color-text-secondary)' }}>Create a PAT at:</p>
              <a href="https://github.com/settings/tokens/new" target="_blank" rel="noreferrer"
                className="text-sm font-medium" style={{ color: 'var(--color-accent-2)' }}>
                github.com/settings/tokens/new ↗
              </a>
              <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
                Scopes needed: <code className="px-1 rounded" style={{ background: 'var(--glass-bg)' }}>repo</code>, <code className="px-1 rounded" style={{ background: 'var(--glass-bg)' }}>read:user</code>
              </p>
            </div>

            <div className="mb-4">
              <input
                type="password"
                value={pat}
                onChange={(e) => setPat(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxx"
                className="w-full px-4 py-3 rounded-xl text-sm font-mono"
                style={{
                  background: 'var(--glass-bg)',
                  border: `1px solid ${patError ? 'var(--color-danger)' : 'var(--glass-border)'}`,
                  color: 'var(--color-text-primary)',
                  outline: 'none',
                }}
              />
              {patError && <p className="text-xs mt-2" style={{ color: 'var(--color-danger)' }}>{patError}</p>}
            </div>

            <button
              onClick={() => connectPAT.mutate(pat)}
              disabled={!pat || connectPAT.isPending}
              className="btn-magnetic w-full"
            >
              {connectPAT.isPending ? 'Verifying...' : 'Connect GitHub PAT'}
              <ArrowRight size={16} />
            </button>
            <div className="my-6 flex items-center justify-center">
              <div className="h-px w-full bg-slate-800 absolute" style={{ zIndex: 0 }} />
              <div className="bg-[#0b101e] px-4 text-xs font-semibold tracking-widest text-slate-500 uppercase z-10">
                OR ADD PUBLIC REPO
              </div>
            </div>
            
            <div className="mt-6 p-6 rounded-2xl border border-white/5 bg-white/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl" />
              <h3 className="font-display font-medium text-white mb-2">Analyze any public repository</h3>
              <p className="text-sm text-slate-400 mb-4">No PAT needed. Just paste the repo URL or owner/name.</p>
              
              <div className="flex gap-3">
                <input
                  type="text"
                  value={publicRepoUrl}
                  onChange={(e) => setPublicRepoUrl(e.target.value)}
                  placeholder="e.g. microsoft/vscode"
                  className="w-full px-4 py-2.5 rounded-xl text-sm font-mono flex-1 bg-black/40 border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
                  onKeyDown={(e) => e.key === 'Enter' && handlePublicRepoSubmit()}
                />
                <button
                  onClick={handlePublicRepoSubmit}
                  disabled={!publicRepoUrl}
                  className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-blue-500 text-white font-medium rounded-xl transition-colors shadow-[0_0_15px_rgba(59,130,246,0.3)] flex items-center gap-2 text-sm whitespace-nowrap"
                >
                  <Search size={16} />
                  Analyze
                </button>
              </div>
            </div>
            
            <div className="flex justify-center mt-6">
               <button onClick={() => setStep(1)} className="btn-ghost text-xs">Skip to Repos List →</button>
            </div>
          </div>
        )}

        {/* Step 1: Repo Selection */}
        {step === 1 && (
          <div className="glass-card p-8 animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl" style={{ background: 'rgba(124,58,237,0.15)' }}>
                  <GitBranch size={20} style={{ color: 'var(--color-accent-1)' }} />
                </div>
                <div>
                  <h2 className="font-display text-xl font-bold">Select Repositories</h2>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>Choose repos to track</p>
                </div>
              </div>
              <span className="badge badge-accent">{selectedRepos.size} selected</span>
            </div>

            {/* Search Bar */}
            <div className="mb-4" style={{ position: 'relative' }}>
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-text-muted)',
                  pointerEvents: 'none',
                }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search repositories..."
                className="w-full py-2.5 rounded-xl text-sm"
                style={{
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--color-text-primary)',
                  outline: 'none',
                  paddingLeft: 36,
                  paddingRight: 16,
                }}
              />
            </div>

            {reposLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-14 w-full" />)}
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto mb-6">
                {filteredRepos.length === 0 ? (
                  <div
                    className="text-center py-8"
                    style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}
                  >
                    {searchQuery ? `No repos matching "${searchQuery}"` : 'No repositories found'}
                  </div>
                ) : (
                  filteredRepos.map((repo: any) => {
                    const isSelected = selectedRepos.has(repo.fullName);
                    const isAlreadyConnected = connectedSet.has(repo.fullName);
                    return (
                      <button
                        key={repo.fullName}
                        onClick={() => {
                          const s = new Set(selectedRepos);
                          isSelected ? s.delete(repo.fullName) : s.add(repo.fullName);
                          setSelectedRepos(s);
                        }}
                        className="w-full text-left px-4 py-3 rounded-xl transition-all"
                        style={{
                          background: isSelected ? 'rgba(124,58,237,0.12)' : 'var(--glass-bg)',
                          border: `1px solid ${isSelected ? 'rgba(124,58,237,0.4)' : 'var(--glass-border)'}`,
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium text-sm">{repo.fullName}</span>
                            {repo.language && (
                              <span className="ml-2 text-xs px-2 py-0.5 rounded" style={{ background: 'var(--glass-bg)', color: 'var(--color-text-muted)' }}>
                                {repo.language}
                              </span>
                            )}
                            {isAlreadyConnected && (
                              <span className="ml-2 text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
                                Connected
                              </span>
                            )}
                          </div>
                          {isSelected && <CheckCircle2 size={16} style={{ color: 'var(--color-accent-1)' }} />}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={handleSaveRepos} disabled={selectedRepos.size === 0 || addingRepos} className="btn-magnetic flex-1">
                {addingRepos ? <><RefreshCw size={16} className="animate-spin" /> Saving...</> : <><Save size={16} /> Save & Continue</>}
              </button>
              <button onClick={() => navigate('/dashboard')} className="btn-ghost">
                Skip
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Done */}
        {step === 2 && (
          <div className="glass-card p-8 animate-scale-in text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse-glow"
              style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)' }}>
              <CheckCircle2 size={32} style={{ color: 'var(--color-healthy)' }} />
            </div>
            <h2 className="font-display text-2xl font-bold mb-3">You're all set!</h2>
            <p className="mb-8" style={{ color: 'var(--color-text-secondary)' }}>
              GitHub sync started. PRs, reviews and metrics will appear on your dashboard in a few moments.
            </p>
            <button onClick={() => navigate('/dashboard')} className="btn-magnetic">
              Open Dashboard <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
