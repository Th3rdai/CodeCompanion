import { useState, useMemo, useEffect, useCallback } from 'react';
import { apiFetch } from '../lib/api-fetch';
import DictateButton from './DictateButton';
import { CREATE_TUTORIAL_STEPS } from '../data/tutorialSteps';
import { joinAppend } from '../lib/dictationAppend';

const STEPS = [
  { id: 1, title: 'Project Info', fields: ['name', 'description', 'role'] },
  { id: 2, title: 'Audience & Tone', fields: ['audience', 'tone'] },
  { id: 3, title: 'Stages', fields: ['stages'] },
  { id: 4, title: 'Output Location', fields: ['outputRoot'] },
  { id: 5, title: 'Review & Create', fields: ['review'] }
];

const TONE_OPTIONS = ['Friendly', 'Professional', 'Technical', 'Warm', 'Custom'];

const DEFAULT_STAGES = [
  { name: 'Research', purpose: 'Gather and organize source material' },
  { name: 'Draft', purpose: 'Create first draft from research findings' },
  { name: 'Review', purpose: 'Quality check, edit, and produce final version' }
];

/** Client-side slug matching backend rules (lowercase, hyphens, strip invalid, max 64). */
function slugify(name) {
  if (!name || typeof name !== 'string') return 'project';
  let s = name
    .toLowerCase()
    .replace(/[\s/]+/g, '-')
    .replace(/[\\:*?"<>|]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (s.length > 64) s = s.slice(0, 64).replace(/-$/, '');
  return s || 'project';
}

const TUTORIAL_HINT = 'Press Tab to keep and move on, or right-click in the field to accept this suggestion.';
const TUTORIAL_CLICK_HINT = 'Double-click in the field to get a different suggestion.';

// Alternatives for step 1 (cycle on left-click when tutorial is on)
const STEP1_ALTERNATIVES = {
  name: ['My Blog Assistant', 'My Research Helper', 'My Content Studio', 'My Data Explorer'],
  description: [
    'A project to draft and refine blog posts with an AI writing assistant.',
    'A project for research and analysis with an AI that helps find and summarize sources.',
    'A project for creating and editing content with a friendly AI writing partner.',
    'A project to explore and visualize data with AI-assisted analysis.',
  ],
  role: [
    'Content writing assistant that helps draft and edit posts in a friendly, clear tone.',
    'Research analyst that finds sources, summarizes key points, and suggests directions.',
    'Writing partner that keeps tone consistent and suggests improvements.',
    'Data assistant that helps interpret and explain findings clearly.',
  ],
};

export default function CreateWizard({ defaultOutputRoot = '~/AI_Dev/', onSuccess, onOpenInBuild, onToast, step: controlledStep, onStepChange, prefill, tutorialActive, tutorialSuggestions }) {
  const [internalStep, setInternalStep] = useState(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [role, setRole] = useState('');
  const [audience, setAudience] = useState('');
  const [tone, setTone] = useState('Professional');
  const [toneCustom, setToneCustom] = useState('');
  const [stages, setStages] = useState(DEFAULT_STAGES);
  const [outputRoot, setOutputRoot] = useState(defaultOutputRoot);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [stepError, setStepError] = useState(null);
  const [makerEnabled, setMakerEnabled] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  const [result, setResult] = useState(null);
  const [hintField, setHintField] = useState(null);
  const [contextualSuggestions, setContextualSuggestions] = useState(null);
  const [contextualSuggestionsLoading, setContextualSuggestionsLoading] = useState(false);
  const [loadingSuggestionFor, setLoadingSuggestionFor] = useState(null);
  const [step1CycleIndex, setStep1CycleIndex] = useState({ name: 0, description: 0, role: 0 });

  const step = controlledStep !== undefined ? controlledStep : internalStep;
  const setStep = (n) => {
    setInternalStep(n);
    onStepChange?.(n);
  };

  useEffect(() => setHintField(null), [step]);
  // Clear contextual suggestions when returning to step 1 so we refetch when they advance again
  useEffect(() => {
    if (step === 1) setContextualSuggestions(null);
  }, [step]);
  // Fetch contextual suggestions when entering step 2+ with project info filled
  useEffect(() => {
    if (step < 2 || !tutorialActive || contextualSuggestions || contextualSuggestionsLoading) return;
    const hasProjectInfo = name.trim() || description.trim();
    if (!hasProjectInfo) return;
    setContextualSuggestionsLoading(true);
    apiFetch('/api/tutorial-suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), description: description.trim(), role: role.trim() || undefined, mode: 'create' })
    })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(r.statusText)))
      .then(data => setContextualSuggestions(data))
      .catch(() => setContextualSuggestions(null))
      .finally(() => setContextualSuggestionsLoading(false));
  }, [step, tutorialActive, name, description, role]);

  // Derive suggestions from current wizard step so we're not dependent on parent's tutorialStep
  const staticStepSuggestions = CREATE_TUTORIAL_STEPS[step - 1]?.prefill ?? {};
  const effectiveSuggestions = (step >= 2 && contextualSuggestions)
    ? { ...staticStepSuggestions, ...contextualSuggestions }
    : staticStepSuggestions;

  useEffect(() => {
    if (!prefill?.data) return;
    const d = prefill.data;
    if (d.name !== undefined) setName(d.name);
    if (d.description !== undefined) setDescription(d.description);
    if (d.role !== undefined) setRole(d.role);
    if (d.audience !== undefined) setAudience(d.audience);
    if (d.tone !== undefined) { setTone(d.tone); setToneCustom(''); }
    if (d.toneCustom !== undefined) setToneCustom(d.toneCustom);
    if (d.stages !== undefined && Array.isArray(d.stages)) setStages(d.stages.map(s => ({ name: s.name || '', purpose: s.purpose || '' })));
    if (d.outputRoot !== undefined) setOutputRoot(d.outputRoot);
  }, [prefill]);

  const slug = useMemo(() => slugify(name), [name]);
  const projectPathPreview = name ? `${outputRoot.replace(/\/?$/, '/')}${slug}` : '';

  const handleTutorialSuggestFill = useCallback((fieldKey, currentValue, setValue) => {
    if (!tutorialActive) return;
    const suggestions = effectiveSuggestions || {};
    const suggested = suggestions[fieldKey];
    if (suggested == null || suggested === '') return;
    if (fieldKey === 'tone') {
      setValue(suggested);
      setHintField('tone');
      return;
    }
    if (String(currentValue ?? '').trim() !== '') return;
    setValue(suggested);
    setHintField(fieldKey);
  }, [tutorialActive, effectiveSuggestions]);

  const handleTutorialClickForNewSuggestion = useCallback((fieldKey) => {
    if (!tutorialActive) return;
    const setters = { name: setName, description: setDescription, role: setRole, audience: setAudience, tone: setTone, outputRoot: setOutputRoot };
    const setValue = setters[fieldKey];
    if (!setValue) return;

    if (step >= 2 && (fieldKey === 'audience' || fieldKey === 'tone' || fieldKey === 'outputRoot')) {
      setLoadingSuggestionFor(fieldKey);
      apiFetch('/api/tutorial-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim(), role: role.trim() || undefined, mode: 'create' })
      })
        .then(r => r.ok ? r.json() : Promise.reject(new Error(r.statusText)))
        .then((data) => {
          const value = data[fieldKey];
          if (value != null && value !== '') {
            setValue(value);
            setHintField(fieldKey);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingSuggestionFor(null));
      return;
    }

    if (step === 1 && (fieldKey === 'name' || fieldKey === 'description' || fieldKey === 'role')) {
      const options = STEP1_ALTERNATIVES[fieldKey];
      if (!options?.length) return;
      setStep1CycleIndex(prev => {
        const next = (prev[fieldKey] + 1) % options.length;
        setValue(options[next]);
        setHintField(fieldKey);
        return { ...prev, [fieldKey]: next };
      });
    }
  }, [tutorialActive, step, name, description, role]);

  const acceptTutorialHint = () => setHintField(null);

  const validateStep = () => {
    if (step === 1 && !name.trim()) return 'Project name is required.';
    if (step === 2 && tone === 'Custom' && !toneCustom.trim()) return 'Please describe your custom tone.';
    if (step === 3) {
      if (stages.length === 0) return 'At least one stage is required.';
      const names = stages.map(s => s.name.trim().toLowerCase()).filter(Boolean);
      if (names.length !== stages.length) return 'Each stage needs a name.';
      if (new Set(names).size !== names.length) return 'Stage names must be unique.';
    }
    if (step === 4 && !outputRoot.trim()) return 'Output location is required.';
    return null;
  };

  const handleNext = () => {
    const msg = validateStep();
    setStepError(msg);
    if (!msg) setStep(s => Math.min(s + 1, STEPS.length));
  };
  const handleBack = () => {
    setStepError(null);
    setStep(s => Math.max(s - 1, 1));
  };

  const handleSubmit = async () => {
    setError(null);
    setStepError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/create-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || 'New Project',
          description: description.trim() || '',
          role: role.trim() || 'AI assistant for this project',
          audience: audience.trim() || 'General',
          tone: tone === 'Custom' ? toneCustom.trim() : tone,
          stages: stages.map((s, i) => ({ name: s.name, purpose: s.purpose || '', order: i + 1 })),
          outputRoot: outputRoot.trim() || defaultOutputRoot,
          overwrite,
          makerEnabled
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || data.message || 'Project creation failed');
        return;
      }
      if (data.success && data.projectPath) {
        setResult(data);
        onToast?.(`Project created at ${data.projectPath}`);
        onSuccess?.(data.projectPath, data);
      } else {
        setError(data.error || 'Unknown error');
      }
    } catch (err) {
      setError(err.message || 'Network error');
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="glass rounded-xl p-6 max-w-2xl mx-auto space-y-4" role="status" aria-live="polite">
        <h2 className="text-lg font-bold text-green-400">Your project is ready!</h2>
        <p className="text-sm text-slate-300">{result.projectPath}</p>

        {/* Action buttons - shown prominently before file list */}
        <div className="flex flex-wrap gap-3 py-2 border-y border-slate-700/30">
          <button
            onClick={() => onOpenInBuild?.(result.projectPath, result)}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white rounded-xl font-medium text-sm transition-colors cursor-pointer shadow-lg shadow-indigo-500/20"
          >
            🏗️ Open in Build
          </button>
          <button
            onClick={() => { setResult(null); setStep(1); setForm({ name: '', description: '', outputRoot: defaultOutputRoot, customFields: [] }); }}
            className="px-5 py-2.5 text-sm text-slate-400 hover:text-white border border-slate-600 hover:bg-slate-700/40 rounded-xl transition-colors cursor-pointer"
          >
            Create Another
          </button>
        </div>

        <ul className="text-xs text-slate-400 list-disc list-inside space-y-1">
          {(result.files || []).slice(0, 20).map((f, i) => (
            <li key={i}>{f}</li>
          ))}
          {(result.files?.length || 0) > 20 && <li>… and {result.files.length - 20} more</li>}
        </ul>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-6 max-w-2xl mx-auto" role="form" aria-label="Create project wizard">
      {/* Step indicator */}
      <div className="flex gap-2 mb-6" aria-label="Progress">
        {STEPS.map(s => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStep(s.id)}
            aria-current={step === s.id ? 'step' : undefined}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
              step === s.id ? 'bg-indigo-600/40 text-indigo-200' : 'bg-slate-700/50 text-slate-500 hover:text-slate-300'
            }`}
          >
            {s.id}. {s.title}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm" role="alert">
          {error}
        </div>
      )}
      {stepError && (
        <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm" role="alert">
          {stepError}
        </div>
      )}

      {/* Step 1: Project Info */}
      {step === 1 && (
        <div className="space-y-4" aria-labelledby="step1-heading">
          <h3 id="step1-heading" className="text-sm font-semibold text-slate-200">Project Info</h3>
          <div>
            <label htmlFor="create-name" className="block text-xs text-slate-400 mb-1">Project name</label>
            <div className="flex gap-2 items-start">
              <input
                id="create-name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                onFocus={() => handleTutorialSuggestFill('name', name, setName)}
                onClick={() => handleTutorialSuggestFill('name', name, setName)}
                onDoubleClick={() => handleTutorialClickForNewSuggestion('name')}
                onContextMenu={acceptTutorialHint}
                placeholder="My Blog Assistant"
                className="flex-1 min-w-0 input-glow text-slate-100 rounded-lg px-4 py-2.5 text-sm"
                autoFocus
              />
              <DictateButton onResult={text => setName(prev => joinAppend(prev, text))} />
            </div>
            {hintField === 'name' && (
              <p className="mt-1 text-xs text-amber-400/90" role="status">
                {TUTORIAL_HINT} {TUTORIAL_CLICK_HINT}
              </p>
            )}
            {loadingSuggestionFor === 'name' && (
              <p className="mt-1 text-xs text-slate-400" role="status">Getting new suggestion…</p>
            )}
            {name && <p className="mt-1 text-xs text-slate-500">Slug: {slug}</p>}
          </div>
          <div>
            <label htmlFor="create-desc" className="block text-xs text-slate-400 mb-1">Description</label>
            <div className="flex gap-2 items-start">
              <textarea
                id="create-desc"
                value={description}
                onChange={e => setDescription(e.target.value)}
                onFocus={() => handleTutorialSuggestFill('description', description, setDescription)}
                onClick={() => handleTutorialSuggestFill('description', description, setDescription)}
                onDoubleClick={() => handleTutorialClickForNewSuggestion('description')}
                onContextMenu={acceptTutorialHint}
                placeholder="What is this project for?"
                rows={2}
                className="flex-1 min-w-0 input-glow text-slate-100 rounded-lg px-4 py-2.5 text-sm resize-none"
              />
              <DictateButton onResult={text => setDescription(prev => joinAppend(prev, text))} />
            </div>
            {hintField === 'description' && (
              <p className="mt-1 text-xs text-amber-400/90" role="status">
                {TUTORIAL_HINT} {TUTORIAL_CLICK_HINT}
              </p>
            )}
            {loadingSuggestionFor === 'description' && (
              <p className="mt-1 text-xs text-slate-400" role="status">Getting new suggestion…</p>
            )}
          </div>
          <div>
            <label htmlFor="create-role" className="block text-xs text-slate-400 mb-1">AI role</label>
            <div className="flex gap-2 items-start">
              <input
                id="create-role"
                type="text"
                value={role}
                onChange={e => setRole(e.target.value)}
                onFocus={() => handleTutorialSuggestFill('role', role, setRole)}
                onClick={() => handleTutorialSuggestFill('role', role, setRole)}
                onDoubleClick={() => handleTutorialClickForNewSuggestion('role')}
                onContextMenu={acceptTutorialHint}
                placeholder="e.g. content writing assistant, research analyst"
                className="flex-1 min-w-0 input-glow text-slate-100 rounded-lg px-4 py-2.5 text-sm"
              />
              <DictateButton onResult={text => setRole(prev => joinAppend(prev, text))} />
            </div>
            {hintField === 'role' && (
              <p className="mt-1 text-xs text-amber-400/90" role="status">
                {TUTORIAL_HINT} {TUTORIAL_CLICK_HINT}
              </p>
            )}
            {loadingSuggestionFor === 'role' && (
              <p className="mt-1 text-xs text-slate-400" role="status">Getting new suggestion…</p>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Audience & Tone */}
      {step === 2 && (
        <div className="space-y-4" aria-labelledby="step2-heading">
          <h3 id="step2-heading" className="text-sm font-semibold text-slate-200">Audience & Tone</h3>
          <div>
            <label htmlFor="create-audience" className="block text-xs text-slate-400 mb-1">Target audience</label>
            <div className="flex gap-2 items-start">
              <input
                id="create-audience"
                type="text"
                value={audience}
                onChange={e => setAudience(e.target.value)}
                onFocus={() => handleTutorialSuggestFill('audience', audience, setAudience)}
                onClick={() => handleTutorialSuggestFill('audience', audience, setAudience)}
                onDoubleClick={() => handleTutorialClickForNewSuggestion('audience')}
                onContextMenu={acceptTutorialHint}
                placeholder="Who will use the output?"
                className="flex-1 min-w-0 input-glow text-slate-100 rounded-lg px-4 py-2.5 text-sm"
              />
              <DictateButton onResult={text => setAudience(prev => joinAppend(prev, text))} />
            </div>
            {hintField === 'audience' && (
              <p className="mt-1 text-xs text-amber-400/90" role="status">
                {TUTORIAL_HINT} {TUTORIAL_CLICK_HINT}
              </p>
            )}
            {loadingSuggestionFor === 'audience' && (
              <p className="mt-1 text-xs text-slate-400" role="status">Getting new suggestion…</p>
            )}
          </div>
          <div>
            <label htmlFor="create-tone" className="block text-xs text-slate-400 mb-1">Tone</label>
            <select
              id="create-tone"
              value={tone}
              onChange={e => setTone(e.target.value)}
              onFocus={() => handleTutorialSuggestFill('tone', tone, setTone)}
              onClick={() => handleTutorialSuggestFill('tone', tone, setTone)}
              onDoubleClick={() => handleTutorialClickForNewSuggestion('tone')}
              onContextMenu={acceptTutorialHint}
              className="w-full input-glow text-slate-100 rounded-lg px-4 py-2.5 text-sm"
            >
              {TONE_OPTIONS.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            {hintField === 'tone' && (
              <p className="mt-1 text-xs text-amber-400/90" role="status">
                {TUTORIAL_HINT} {TUTORIAL_CLICK_HINT}
              </p>
            )}
            {loadingSuggestionFor === 'tone' && (
              <p className="mt-1 text-xs text-slate-400" role="status">Getting new suggestion…</p>
            )}
            {tone === 'Custom' && (
              <div className="flex gap-2 items-start mt-2">
                <input
                  type="text"
                  value={toneCustom}
                  onChange={e => setToneCustom(e.target.value)}
                  placeholder="Describe tone"
                  className="flex-1 min-w-0 input-glow text-slate-100 rounded-lg px-4 py-2.5 text-sm"
                />
                <DictateButton onResult={text => setToneCustom(prev => joinAppend(prev, text))} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Stages */}
      {step === 3 && (
        <div className="space-y-4" aria-labelledby="step3-heading">
          <h3 id="step3-heading" className="text-sm font-semibold text-slate-200">Stages</h3>
          <p className="text-xs text-slate-500">Make these your own — rename stages or tweak purposes to match how you work.</p>
          <div className="space-y-2">
            {stages.map((s, i) => (
              <div key={i} className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/40">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="font-mono text-indigo-400 text-xs shrink-0">{String(i + 1).padStart(2, '0')}</span>
                  <div className="flex flex-1 min-w-0 gap-2 items-start">
                    <input
                      type="text"
                      value={s.name}
                      onChange={e => setStages(prev => prev.map((row, idx) => idx === i ? { ...row, name: e.target.value } : row))}
                      className="flex-1 min-w-0 input-glow text-slate-100 rounded-lg px-3 py-1.5 text-sm"
                      placeholder="Stage name"
                    />
                    <DictateButton
                      onResult={text => setStages(prev => prev.map((row, idx) => idx === i ? { ...row, name: joinAppend(row.name, text) } : row))}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setStages(prev => prev.filter((_, idx) => idx !== i))}
                    disabled={stages.length <= 1}
                    className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-300 disabled:opacity-50 shrink-0"
                  >
                    Remove
                  </button>
                </div>
                <div className="flex gap-2 items-start">
                  <input
                    type="text"
                    value={s.purpose}
                    onChange={e => setStages(prev => prev.map((row, idx) => idx === i ? { ...row, purpose: e.target.value } : row))}
                    className="flex-1 min-w-0 input-glow text-slate-300 rounded-lg px-3 py-1.5 text-xs"
                    placeholder="Stage purpose"
                  />
                  <DictateButton
                    onResult={text => setStages(prev => prev.map((row, idx) => idx === i ? { ...row, purpose: joinAppend(row.purpose, text) } : row))}
                  />
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setStages(prev => [...prev, { name: `Stage ${prev.length + 1}`, purpose: 'Define stage purpose' }])}
            className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30"
          >
            + Add Stage
          </button>

          {/* MAKER Framework toggle */}
          <div className="mt-4 p-3 rounded-lg bg-slate-800/40 border border-slate-700/40">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={makerEnabled}
                onChange={e => setMakerEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-indigo-500 focus:ring-indigo-500/30"
              />
              <div>
                <span className="text-sm text-slate-200 font-medium">Enable MAKER Framework</span>
                <p className="text-xs text-slate-500 mt-0.5">
                  Zero-error methodology — decomposes each stage into verified subtasks with red-flag detection. Best for complex, multi-step projects.
                </p>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Step 4: Output Location */}
      {step === 4 && (
        <div className="space-y-4" aria-labelledby="step4-heading">
          <h3 id="step4-heading" className="text-sm font-semibold text-slate-200">Output Location</h3>
          <div>
            <label htmlFor="create-output" className="block text-xs text-slate-400 mb-1">Parent folder (project will be created inside)</label>
            <div className="flex gap-2 items-start">
              <input
                id="create-output"
                type="text"
                value={outputRoot}
                onChange={e => setOutputRoot(e.target.value)}
                onFocus={() => handleTutorialSuggestFill('outputRoot', outputRoot, setOutputRoot)}
                onClick={() => handleTutorialSuggestFill('outputRoot', outputRoot, setOutputRoot)}
                onDoubleClick={() => handleTutorialClickForNewSuggestion('outputRoot')}
                onContextMenu={acceptTutorialHint}
                placeholder="~/AI_Dev/"
                className="flex-1 min-w-0 input-glow text-slate-100 font-mono rounded-lg px-4 py-2.5 text-sm"
              />
              <DictateButton onResult={text => setOutputRoot(prev => joinAppend(prev, text))} />
            </div>
            {hintField === 'outputRoot' && (
              <p className="mt-1 text-xs text-amber-400/90" role="status">
                {TUTORIAL_HINT} {TUTORIAL_CLICK_HINT}
              </p>
            )}
            {loadingSuggestionFor === 'outputRoot' && (
              <p className="mt-1 text-xs text-slate-400" role="status">Getting new suggestion…</p>
            )}
          </div>
          {name && (
            <div className="p-3 rounded-lg bg-slate-800/50 text-xs text-slate-400 font-mono">
              Project will be created at:<br />
              <span className="text-indigo-300">{projectPathPreview}</span>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={overwrite}
              onChange={e => setOverwrite(e.target.checked)}
              className="rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500/40"
            />
            Overwrite if project already exists
          </label>
        </div>
      )}

      {/* Step 5: Review & Create */}
      {step === 5 && (
        <div className="space-y-4" aria-labelledby="step5-heading">
          <h3 id="step5-heading" className="text-sm font-semibold text-slate-200">Review & Create</h3>
          <dl className="grid grid-cols-1 gap-2 text-sm">
            <div><dt className="text-slate-500">Name</dt><dd className="text-slate-200">{name || '—'}</dd></div>
            <div><dt className="text-slate-500">Slug</dt><dd className="font-mono text-indigo-300">{slug}</dd></div>
            <div><dt className="text-slate-500">Description</dt><dd className="text-slate-300">{description || '—'}</dd></div>
            <div><dt className="text-slate-500">Role</dt><dd className="text-slate-300">{role || '—'}</dd></div>
            <div><dt className="text-slate-500">Audience</dt><dd className="text-slate-300">{audience || '—'}</dd></div>
            <div><dt className="text-slate-500">Tone</dt><dd className="text-slate-300">{tone === 'Custom' ? toneCustom : tone}</dd></div>
            <div><dt className="text-slate-500">MAKER</dt><dd className={makerEnabled ? 'text-green-400' : 'text-slate-500'}>{makerEnabled ? 'Enabled — zero-error methodology' : 'Off'}</dd></div>
            <div><dt className="text-slate-500">Path</dt><dd className="font-mono text-slate-300 break-all">{projectPathPreview || '—'}</dd></div>
            <div><dt className="text-slate-500">Overwrite</dt><dd className={overwrite ? 'text-amber-400' : 'text-slate-500'}>{overwrite ? 'Yes — will replace existing folder' : 'No'}</dd></div>
          </dl>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-6 pt-4 border-t border-slate-700/30">
        <button
          type="button"
          onClick={handleBack}
          disabled={step === 1}
          className="px-4 py-2 glass rounded-lg text-slate-300 text-sm disabled:opacity-50"
        >
          Back
        </button>
        {step < STEPS.length ? (
          <button type="button" onClick={handleNext} className="px-4 py-2 btn-neon text-white rounded-lg text-sm font-medium">
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 btn-neon text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {submitting ? 'Creating…' : 'Create Project'}
          </button>
        )}
      </div>
    </div>
  );
}
