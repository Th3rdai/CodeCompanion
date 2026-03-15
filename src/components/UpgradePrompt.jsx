import { useState } from 'react';

/**
 * UpgradePrompt — friendly modal shown when clicking a locked Pro mode.
 * Handles license key activation, trial start, and purchase links.
 */
export default function UpgradePrompt({ mode, licenseInfo, onClose, onActivate, onStartTrial, onToast }) {
  const [key, setKey] = useState('');
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState(null);
  const [startingTrial, setStartingTrial] = useState(false);

  const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron;
  const trialAvailable = licenseInfo?.trialAvailable !== false;

  async function handleActivate() {
    if (!key.trim()) return;
    setActivating(true);
    setError(null);
    try {
      const res = await fetch('/api/license/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: key.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        onActivate?.(data);
        onToast?.('Pro activated! All modes unlocked.');
        onClose();
      } else {
        setError(data.error || 'Invalid license key');
      }
    } catch (err) {
      setError(err.message);
    }
    setActivating(false);
  }

  async function handleStartTrial() {
    setStartingTrial(true);
    setError(null);
    try {
      const res = await fetch('/api/license/trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        onStartTrial?.(data);
        onToast?.(`Trial started! ${data.trialDaysLeft} days of Pro access.`);
        onClose();
      } else {
        setError(data.error || 'Could not start trial');
      }
    } catch (err) {
      setError(err.message);
    }
    setStartingTrial(false);
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose} role="presentation">
      <div className="glass-heavy rounded-2xl w-full max-w-md p-6 neon-border" onClick={e => e.stopPropagation()} role="dialog" aria-label="Upgrade to Pro" aria-modal="true">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-100 neon-text">Ready to level up?</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl transition-colors" aria-label="Close">
            ✕
          </button>
        </div>

        {/* What you're unlocking */}
        {mode && (
          <div className="glass rounded-lg p-3 mb-4 flex items-center gap-3">
            <span className="text-2xl">{mode.icon}</span>
            <div>
              <p className="text-sm font-medium text-slate-200">{mode.label}</p>
              <p className="text-xs text-slate-400">{mode.desc}</p>
            </div>
            <span className="ml-auto text-xs font-bold text-indigo-400 bg-indigo-500/20 px-2 py-1 rounded-full">PRO</span>
          </div>
        )}

        {/* Pro features list */}
        <div className="mb-5">
          <p className="text-sm text-slate-300 mb-2">Code Companion Pro unlocks:</p>
          <ul className="space-y-1.5 text-xs text-slate-400">
            <li className="flex items-center gap-2"><span className="text-indigo-400">&#10003;</span> Prompting — craft and score AI prompts with TACHES</li>
            <li className="flex items-center gap-2"><span className="text-indigo-400">&#10003;</span> Skillz — build Claude Code skills with scoring</li>
            <li className="flex items-center gap-2"><span className="text-indigo-400">&#10003;</span> Agentic — design AI agents with CrewAI + LangGraph</li>
            <li className="flex items-center gap-2"><span className="text-indigo-400">&#10003;</span> Create — project scaffolding and generation</li>
            <li className="flex items-center gap-2"><span className="text-slate-500">+</span> Future premium features included</li>
          </ul>
        </div>

        {/* Trial button */}
        {trialAvailable && (
          <button
            onClick={handleStartTrial}
            disabled={startingTrial}
            className="w-full mb-3 py-2.5 rounded-lg text-sm font-medium transition-colors bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white disabled:opacity-50"
          >
            {startingTrial ? 'Starting...' : 'Start 14-Day Free Trial'}
          </button>
        )}

        {/* License key input */}
        <div className="mb-4">
          <label className="block text-xs text-slate-400 mb-1.5">Have a license key?</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={key}
              onChange={e => setKey(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleActivate()}
              placeholder="CC-PRO-..."
              className="flex-1 input-glow text-slate-100 rounded-lg px-3 py-2 outline-none font-mono text-xs"
            />
            <button
              onClick={handleActivate}
              disabled={activating || !key.trim()}
              className="btn-neon disabled:opacity-50 text-white rounded-lg px-4 py-2 text-xs font-medium whitespace-nowrap"
            >
              {activating ? '...' : 'Activate'}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-3 p-2.5 rounded-lg text-xs bg-red-500/10 border border-red-500/30 text-red-400">
            {error}
          </div>
        )}

        {/* Purchase link */}
        {isElectron ? (
          <button
            onClick={() => window.electronAPI?.purchasePro?.()}
            className="w-full py-2 rounded-lg text-xs text-slate-400 glass hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors border border-slate-600"
          >
            Purchase in App Store
          </button>
        ) : (
          <p className="text-center text-xs text-slate-500">
            Get a license key at <span className="text-indigo-400">th3rdai.com</span>
          </p>
        )}
      </div>
    </div>
  );
}
