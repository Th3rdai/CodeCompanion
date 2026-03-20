import { useState } from 'react';
import { Terminal, Copy, Check, FolderOpen, Rocket, FileText, Search, CheckCircle } from 'lucide-react';
import { copyText } from '../lib/clipboard';

/**
 * ClaudeCodeHandoff — Copy-pasteable GSD slash commands for Claude Code / Cursor / Windsurf.
 * Shows contextual commands based on project state (phases, plans, completion).
 */
export default function ClaudeCodeHandoff({ project, projectData, onToast }) {
  const [copiedIdx, setCopiedIdx] = useState(null);

  if (!project?.path) return null;

  const phases = projectData?.roadmap?.phases;
  const hasPhases = Array.isArray(phases) && phases.length > 0;

  // Find the first incomplete phase
  const incompletePhase = hasPhases
    ? phases.find(p => p.status !== 'complete' && p.status !== 'completed')
    : null;
  const nextPhaseNum = incompletePhase?.number || incompletePhase?.phase || 1;

  // Determine if any phase has plans
  const hasPlans = hasPhases && phases.some(p =>
    (p.plans && p.plans.length > 0) || p.status === 'complete' || p.status === 'completed'
  );

  // Current phase (latest incomplete or last)
  const currentPhaseNum = incompletePhase
    ? (incompletePhase.number || incompletePhase.phase)
    : hasPhases
      ? (phases[phases.length - 1].number || phases[phases.length - 1].phase || phases.length)
      : 1;

  async function handleCopy(text, idx) {
    const ok = await copyText(text);
    if (ok) {
      setCopiedIdx(idx);
      onToast?.('Copied!');
      setTimeout(() => setCopiedIdx(null), 2000);
    } else {
      onToast?.('Copy failed — try selecting the text manually');
    }
  }

  // Build contextual commands
  const commands = [];

  // 1. Always show cd command
  commands.push({
    name: 'Open project directory',
    description: 'Navigate to your project folder',
    command: `cd ${project.path}`,
    icon: FolderOpen,
  });

  // 2. New project (no phases)
  if (!hasPhases) {
    commands.push({
      name: 'Start new project',
      description: 'Set up your project roadmap and requirements',
      command: '/gsd:new-project',
      icon: Rocket,
    });
  }

  // 3. Plan next phase (incomplete phases exist)
  if (incompletePhase) {
    commands.push({
      name: `Plan phase ${nextPhaseNum}`,
      description: 'Plan the next phase of development',
      command: `/gsd:plan-phase ${nextPhaseNum}`,
      icon: FileText,
    });
  }

  // 4. Execute phase (has plans)
  if (hasPlans && incompletePhase) {
    commands.push({
      name: `Execute phase ${currentPhaseNum}`,
      description: 'Execute the current phase plans',
      command: `/gsd:execute-phase ${currentPhaseNum}`,
      icon: Terminal,
    });
  }

  // 5. Verify work
  if (hasPlans) {
    commands.push({
      name: `Verify phase ${currentPhaseNum}`,
      description: 'Verify the current phase is complete',
      command: `/gsd:verify-work ${currentPhaseNum}`,
      icon: CheckCircle,
    });
  }

  // 6. Research phase
  if (incompletePhase) {
    commands.push({
      name: `Research phase ${nextPhaseNum}`,
      description: 'Deep research before planning a complex phase',
      command: `/gsd:research-phase ${nextPhaseNum}`,
      icon: Search,
    });
  }

  return (
    <div className="glass-neon rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Terminal className="w-5 h-5 text-indigo-400" />
        <h3 className="text-sm font-semibold text-slate-200">Open in Claude Code</h3>
      </div>

      <p className="text-xs text-slate-400">
        Copy these commands to continue building in Claude Code, Cursor, or Windsurf.
      </p>

      <div className="space-y-2">
        {commands.map((cmd, idx) => (
          <div key={idx} className="glass rounded-lg p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <cmd.icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-xs font-semibold text-slate-200 truncate">{cmd.name}</span>
              </div>
              <button
                onClick={() => handleCopy(cmd.command, idx)}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-300 px-2 py-1 rounded-lg hover:bg-indigo-500/10 transition-colors cursor-pointer shrink-0"
                aria-label={`Copy ${cmd.name} command`}
              >
                {copiedIdx === idx ? (
                  <><Check className="w-3 h-3 text-emerald-400" /><span className="text-emerald-400">Copied</span></>
                ) : (
                  <><Copy className="w-3 h-3" /><span>Copy</span></>
                )}
              </button>
            </div>
            <p className="text-xs text-slate-400 pl-5.5">{cmd.description}</p>
            <div className="bg-slate-900/60 rounded-lg px-4 py-2.5">
              <code className="font-mono text-sm text-indigo-300">{cmd.command}</code>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
