import { useState, useCallback } from 'react';

// Must match lib/icm-scaffolder.js slugify — kept in sync manually
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

const TONE_PRESETS = [
  { id: 'professional', label: 'Professional', desc: 'Clear, formal, and authoritative' },
  { id: 'friendly',     label: 'Friendly',     desc: 'Warm, approachable, and conversational' },
  { id: 'technical',    label: 'Technical',    desc: 'Precise, detailed, and developer-facing' },
  { id: 'executive',    label: 'Executive',    desc: 'Concise, high-level, and decision-focused' },
  { id: 'custom',       label: 'Custom…',      desc: 'Describe your own tone' },
];

const DEFAULT_STAGES = [
  { name: 'Research',  purpose: 'Gather and organise source material',          trigger: '' },
  { name: 'Draft',     purpose: 'Create a first draft from research findings',  trigger: '' },
  { name: 'Review',    purpose: 'Quality check, edit, and produce the final version', trigger: '' },
];

const STEP_LABELS = [
  'Project Info',
  'Audience & Tone',
  'Stages',
  'Output Location',
  'Review & Create',
];

function StepIndicator({ step, total }) {
  return (
    <div className="flex items-center gap-0 mb-8" role="list" aria-label="Wizard steps">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex items-center flex-1 last:flex-none" role="listitem">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all
            ${i < step ? 'bg-indigo-600 text-white' :
              i === step ? 'bg-indigo-500/30 border-2 border-indigo-500 text-indigo-300' :
              'bg-slate-700/50 border border-slate-600 text-slate-500'}`}
            aria-current={i === step ? 'step' : undefined}>
            {i < step ? '✓' : i + 1}
          </div>
          {i < total - 1 && (
            <div className={`flex-1 h-0.5 mx-1 transition-all ${i < step ? 'bg-indigo-600' : 'bg-slate-700'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function FieldLabel({ children, htmlFor, required }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-300 mb-1.5">
      {children}{required && <span className="text-indigo-400 ml-0.5">*</span>}
    </label>
  );
}

const inputCls = 'w-full bg-slate-800/60 border border-slate-600/50 rounded-xl px-3.5 py-2.5 text-slate-100 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-indigo-500/50 transition-all';
const textareaCls = `${inputCls} resize-none`;

// ── Step components ─────────────────────────────────────────────────────────

function Step1({ data, onChange }) {
  return (
    <div className="space-y-5">
      <div>
        <FieldLabel htmlFor="wiz-name" required>Project Name</FieldLabel>
        <input id="wiz-name" type="text" value={data.name} maxLength={80}
          onChange={e => onChange('name', e.target.value)}
          placeholder="e.g. Product Launch Campaign"
          className={inputCls} aria-required="true" />
        {data.name && (
          <p className="mt-1 text-xs text-slate-500">Folder slug: <code className="text-indigo-400">{slugify(data.name) || '…'}</code></p>
        )}
      </div>
      <div>
        <FieldLabel htmlFor="wiz-desc">Description</FieldLabel>
        <textarea id="wiz-desc" rows={3} value={data.description}
          onChange={e => onChange('description', e.target.value)}
          placeholder="What is this project about? (optional — helps the AI understand context)"
          className={textareaCls} />
      </div>
      <div>
        <FieldLabel htmlFor="wiz-role" required>AI Role</FieldLabel>
        <textarea id="wiz-role" rows={2} value={data.role}
          onChange={e => onChange('role', e.target.value)}
          placeholder="e.g. You are a content strategist helping create product launch materials"
          className={textareaCls} aria-required="true" />
        <p className="mt-1 text-xs text-slate-500">Defines the AI's identity in CLAUDE.md for this project.</p>
      </div>
    </div>
  );
}

function Step2({ data, onChange }) {
  const isCustom = data.tonePreset === 'custom';
  return (
    <div className="space-y-5">
      <div>
        <FieldLabel htmlFor="wiz-audience" required>Target Audience</FieldLabel>
        <textarea id="wiz-audience" rows={2} value={data.audience}
          onChange={e => onChange('audience', e.target.value)}
          placeholder="e.g. B2B SaaS product managers at mid-sized tech companies"
          className={textareaCls} aria-required="true" />
      </div>
      <div>
        <FieldLabel required>Tone</FieldLabel>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Tone preset">
          {TONE_PRESETS.map(t => (
            <button key={t.id} type="button" onClick={() => onChange('tonePreset', t.id)}
              role="radio" aria-checked={data.tonePreset === t.id}
              className={`text-left p-3 rounded-xl border transition-all text-sm
                ${data.tonePreset === t.id
                  ? 'bg-indigo-600/20 border-indigo-500/60 text-indigo-200'
                  : 'bg-slate-800/40 border-slate-600/40 text-slate-400 hover:border-slate-500 hover:text-slate-300'}`}>
              <div className="font-medium">{t.label}</div>
              <div className="text-xs mt-0.5 opacity-70">{t.desc}</div>
            </button>
          ))}
        </div>
      </div>
      {isCustom && (
        <div>
          <FieldLabel htmlFor="wiz-tone-custom" required>Custom Tone Description</FieldLabel>
          <textarea id="wiz-tone-custom" rows={2} value={data.toneCustom}
            onChange={e => onChange('toneCustom', e.target.value)}
            placeholder="Describe the tone in your own words…"
            className={textareaCls} aria-required="true" />
        </div>
      )}
    </div>
  );
}

function Step3({ stages, onAdd, onRemove, onUpdate }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-400">Define the stages of your workflow. Each stage gets its own folder with a context file and output directory.</p>
      {stages.map((s, i) => (
        <div key={i} className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-indigo-400 w-6 shrink-0">{String(i + 1).padStart(2, '0')}</span>
            <input type="text" value={s.name} maxLength={40}
              onChange={e => onUpdate(i, 'name', e.target.value)}
              placeholder="Stage name"
              className="flex-1 bg-slate-700/50 border border-slate-600/40 rounded-lg px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              aria-label={`Stage ${i + 1} name`} />
            {stages.length > 1 && (
              <button type="button" onClick={() => onRemove(i)}
                className="text-slate-500 hover:text-red-400 transition-colors text-xs px-1.5"
                aria-label={`Remove stage ${i + 1}`}>✕</button>
            )}
          </div>
          <textarea rows={2} value={s.purpose}
            onChange={e => onUpdate(i, 'purpose', e.target.value)}
            placeholder="What does this stage accomplish?"
            className="w-full bg-slate-700/50 border border-slate-600/40 rounded-lg px-3 py-1.5 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
            aria-label={`Stage ${i + 1} purpose`} />
        </div>
      ))}
      {stages.length < 8 && (
        <button type="button" onClick={onAdd}
          className="w-full py-2.5 rounded-xl border border-dashed border-slate-600/50 text-sm text-slate-400 hover:border-indigo-500/50 hover:text-indigo-400 transition-all">
          + Add Stage
        </button>
      )}
    </div>
  );
}

function Step4({ data, onChange, pathPreview }) {
  return (
    <div className="space-y-5">
      <div>
        <FieldLabel htmlFor="wiz-output" required>Output Root Folder</FieldLabel>
        <input id="wiz-output" type="text" value={data.outputRoot}
          onChange={e => onChange('outputRoot', e.target.value)}
          placeholder="~/AI_Dev"
          className={inputCls} aria-required="true" />
        <p className="mt-1 text-xs text-slate-500">Tilde (~) is supported. The project folder will be created inside this directory.</p>
      </div>
      {pathPreview && (
        <div className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-3.5">
          <p className="text-xs text-slate-400 mb-1">Project will be created at:</p>
          <code className="text-sm text-indigo-300 break-all">{pathPreview}</code>
        </div>
      )}
      <div className="flex items-center gap-3">
        <input id="wiz-overwrite" type="checkbox" checked={data.overwrite}
          onChange={e => onChange('overwrite', e.target.checked)}
          className="w-4 h-4 rounded border-slate-600 bg-slate-700 accent-indigo-500" />
        <label htmlFor="wiz-overwrite" className="text-sm text-slate-300 cursor-pointer">
          Overwrite if project already exists
        </label>
      </div>
    </div>
  );
}

function Step5({ summary, creating, error }) {
  return (
    <div className="space-y-5">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3.5 text-sm text-red-300">
          {error}
        </div>
      )}
      <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl divide-y divide-slate-700/40">
        {summary.map(({ label, value }) => (
          <div key={label} className="px-4 py-3 flex gap-3">
            <span className="text-xs text-slate-500 w-28 shrink-0 pt-0.5">{label}</span>
            <span className="text-sm text-slate-300 break-all">{value}</span>
          </div>
        ))}
      </div>
      {creating && (
        <div className="flex items-center gap-3 text-sm text-indigo-300">
          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Scaffolding project…
        </div>
      )}
    </div>
  );
}

// ── Main wizard ─────────────────────────────────────────────────────────────

export default function CreateWizard({ onProjectCreated }) {
  const [step, setStep] = useState(0);
  const [creating, setCreating] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const [info, setInfo] = useState({ name: '', description: '', role: '' });
  const [audience, setAudienceState] = useState({ audience: '', tonePreset: 'professional', toneCustom: '' });
  const [stages, setStages] = useState(DEFAULT_STAGES.map(s => ({ ...s })));
  const [location, setLocationState] = useState({ outputRoot: '~/AI_Dev', overwrite: false });

  function updateInfo(k, v) { setInfo(p => ({ ...p, [k]: v })); }
  function updateAudience(k, v) { setAudienceState(p => ({ ...p, [k]: v })); }
  function updateLocation(k, v) { setLocationState(p => ({ ...p, [k]: v })); }

  function addStage() { setStages(p => [...p, { name: '', purpose: '', trigger: '' }]); }
  function removeStage(i) { setStages(p => p.filter((_, idx) => idx !== i)); }
  function updateStage(i, k, v) { setStages(p => p.map((s, idx) => idx === i ? { ...s, [k]: v } : s)); }

  const resolvedTone = audience.tonePreset === 'custom'
    ? audience.toneCustom
    : TONE_PRESETS.find(t => t.id === audience.tonePreset)?.label || 'Professional';

  const slug = slugify(info.name);
  const pathPreview = location.outputRoot && slug
    ? location.outputRoot.replace(/^~/, '~') + '/' + slug
    : '';

  const summary = [
    { label: 'Project', value: info.name || '—' },
    { label: 'Role', value: info.role || '—' },
    { label: 'Audience', value: audience.audience || '—' },
    { label: 'Tone', value: resolvedTone },
    { label: 'Stages', value: stages.map((s, i) => `${String(i + 1).padStart(2, '0')} ${s.name}`).join(', ') || '—' },
    { label: 'Output path', value: pathPreview || '—' },
  ];

  // Validation per step
  function canAdvance() {
    if (step === 0) return info.name.trim() && info.role.trim();
    if (step === 1) return audience.audience.trim() && (audience.tonePreset !== 'custom' || audience.toneCustom.trim());
    if (step === 2) return stages.length > 0 && stages.every(s => s.name.trim() && s.purpose.trim());
    if (step === 3) return location.outputRoot.trim() && slug;
    return true;
  }

  async function handleCreate() {
    setSubmitError('');
    setCreating(true);
    try {
      const res = await fetch('/api/create-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: info.name.trim(),
          description: info.description.trim(),
          role: info.role.trim(),
          audience: audience.audience.trim(),
          tone: resolvedTone,
          stages: stages.map(s => ({ name: s.name.trim(), purpose: s.purpose.trim(), trigger: s.trigger })),
          outputRoot: location.outputRoot.trim(),
          overwrite: location.overwrite,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setSubmitError(data.error || 'Failed to create project');
        setCreating(false);
        return;
      }
      onProjectCreated?.(data.projectPath);
    } catch (err) {
      setSubmitError(err.message || 'Network error');
      setCreating(false);
    }
  }

  const isLastStep = step === STEP_LABELS.length - 1;

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-6 flex justify-center">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-slate-100">Create New Project</h2>
          <p className="text-sm text-slate-400 mt-1">
            Scaffold an ICM-structured AI workspace with staged workflows.
          </p>
        </div>

        <StepIndicator step={step} total={STEP_LABELS.length} />

        {/* Step title */}
        <h3 className="text-base font-medium text-slate-200 mb-4">{STEP_LABELS[step]}</h3>

        {/* Step content */}
        <div className="glass border border-slate-700/40 rounded-2xl p-5 mb-5">
          {step === 0 && <Step1 data={info} onChange={updateInfo} />}
          {step === 1 && <Step2 data={audience} onChange={updateAudience} />}
          {step === 2 && <Step3 stages={stages} onAdd={addStage} onRemove={removeStage} onUpdate={updateStage} />}
          {step === 3 && <Step4 data={location} onChange={updateLocation} pathPreview={pathPreview} />}
          {step === 4 && <Step5 summary={summary} creating={creating} error={submitError} />}
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          {step > 0 && !creating && (
            <button type="button" onClick={() => setStep(s => s - 1)}
              className="px-4 py-2.5 rounded-xl text-sm text-slate-300 border border-slate-600/50 hover:border-slate-500 hover:text-slate-200 transition-all">
              ← Back
            </button>
          )}
          <div className="flex-1" />
          {!isLastStep ? (
            <button type="button" onClick={() => setStep(s => s + 1)} disabled={!canAdvance()}
              className="px-6 py-2.5 rounded-xl text-sm font-medium bg-indigo-600/80 hover:bg-indigo-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all">
              Next →
            </button>
          ) : (
            <button type="button" onClick={handleCreate} disabled={creating}
              className="px-6 py-2.5 rounded-xl text-sm font-medium btn-neon text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all">
              {creating ? 'Creating…' : '🛠️ Create Project'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
