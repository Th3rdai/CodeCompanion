/**
 * ConfirmRunModal.jsx
 *
 * Modal shown when the AI agent wants to run a terminal command and
 * `agentTerminal.confirmBeforeRun` is enabled. Presents the full command
 * and lets the user approve or reject before execution begins.
 *
 * Props:
 *   pending  — { id, command, args: string[], cwd } | null
 *   onDone   — called after the user acts (clears modal state)
 */

import { apiFetch } from "../lib/api-fetch";

export default function ConfirmRunModal({ pending, onDone }) {
  if (!pending) return null;

  const { id, command, args = [], cwd } = pending;
  const fullCmd = [command, ...args].join(" ");

  async function respond(approved) {
    try {
      await apiFetch("/api/chat/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, approved }),
      });
    } catch {
      /* server may already have timed out — ignore */
    }
    onDone();
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass rounded-2xl border border-yellow-500/30 shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 bg-yellow-500/10 border-b border-yellow-500/20">
          <span className="text-yellow-400 text-lg">⚠</span>
          <div>
            <h2 className="text-sm font-semibold text-yellow-300">
              Confirm command execution
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              The AI agent wants to run a terminal command
            </p>
          </div>
        </div>

        {/* Command */}
        <div className="px-5 py-4 space-y-3">
          <div>
            <p className="text-xs text-slate-400 mb-1 font-mono uppercase tracking-wide">
              Command
            </p>
            <pre className="bg-slate-900/80 rounded-lg px-3 py-2 text-sm font-mono text-slate-100 whitespace-pre-wrap break-all">
              {fullCmd}
            </pre>
          </div>
          {cwd && (
            <div>
              <p className="text-xs text-slate-400 mb-1 font-mono uppercase tracking-wide">
                Working directory
              </p>
              <p className="text-xs font-mono text-slate-300 bg-slate-900/60 rounded px-2 py-1 break-all">
                {cwd}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-slate-700/50">
          <button
            onClick={() => respond(false)}
            className="px-4 py-2 text-sm rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
          >
            Deny
          </button>
          <button
            onClick={() => respond(true)}
            className="px-4 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors font-medium"
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  );
}
