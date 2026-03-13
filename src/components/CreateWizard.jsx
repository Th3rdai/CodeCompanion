import { useEffect, useMemo, useState } from 'react';

const DEFAULT_STAGES = [
  { name: 'Research', purpose: 'Gather and organize source material' },
  { name: 'Draft', purpose: 'Create first drafts from research findings' },
  { name: 'Review', purpose: 'Quality check and finalize output' }
];

const STEP_TITLES = [
  'Project Info',
  'Audience & Tone',
  'Stages',
  'Output Location',
  'Review & Create'
];

function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 64) || 'new-project';
}

function buildPreviewPaths(outputRoot, projectSlug, stages) {
  const root = `${outputRoot.replace(/\/+$/, '')}/${projectSlug}`;
  const paths = [`${root}/CLAUDE.md`, `${root}/CONTEXT.md`, `${root}/_config/brand-voice.md`, `${root}/shared/README.md`, `${root}/skills/README.md`];

  stages.forEach((stage, index) => {
    const stageSlug = `${String(index + 1).padStart(2, '0')}-${slugify(stage.name || `stage-${index + 1}`)}`;
    paths.push(`${root}/stages/${stageSlug}/CONTEXT.md`);
    paths.push(`${root}/stages/${stageSlug}/output/`);
    if (index === 0) paths.push(`${root}/stages/${stageSlug}/references/`);
  });

  return paths;
}

export default function CreateWizard({ defaultOutputRoot = '', onCreated }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [role, setRole] = useState('');
  const [audience, setAudience] = useState('');
  const [tone, setTone] = useState('Professional');
  const [outputRoot, setOutputRoot] = useState(defaultOutputRoot);
  const [stages, setStages] = useState(DEFAULT_STAGES);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!outputRoot && defaultOutputRoot) setOutputRoot(defaultOutputRoot);
  }, [defaultOutputRoot, outputRoot]);

  const projectSlug = useMemo(() => slugify(name), [name]);
  const previewPaths = useMemo(() => buildPreviewPaths(outputRoot || '/path/to/projects', projectSlug, stages), [outputRoot, projectSlug, stages]);

  function updateStage(index, key, value) {
    setStages(current => current.map((stage, stageIndex) => (
      stageIndex === index ? { ...stage, [key]: value } : stage
    )));
  }

  function addStage() {
    setStages(current => [...current, { name: `Stage ${current.length + 1}`, purpose: 'Describe what this stage should accomplish' }]);
  }

  function removeStage(index) {
    setStages(current => current.filter((_, stageIndex) => stageIndex !== index));
  }

  function resetWizard() {
    setStep(0);
    setName('');
    setDescription('');
    setRole('');
    setAudience('');
    setTone('Professional');
    setOutputRoot(defaultOutputRoot);
    setStages(DEFAULT_STAGES);
    setError('');
    setResult(null);
  }

  function validateCurrentStep() {
    if (step === 0) return name.trim() && description.trim() && role.trim();
    if (step === 1) return audience.trim() && tone.trim();
    if (step === 2) return stages.length > 0 && stages.every(stage => stage.name.trim() && stage.purpose.trim());
    if (step === 3) return outputRoot.trim();
    return true;
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/create-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          role,
          audience,
          tone,
          stages,
          outputRoot,
          overwrite: false
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Project creation failed.');
      }

      setResult(data);
      onCreated?.(data);
    } catch (err) {
      setError(err.message || 'Project creation failed.');
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <section className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto glass-heavy rounded-2xl border border-indigo-500/30 p-6">
          <h2 className="text-2xl font-semibold text-slate-100">Project Created</h2>
          <p className="text-sm text-slate-400 mt-2">The new ICM workspace is ready.</p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="glass rounded-xl p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Project folder</p>
              <p className="mt-2 text-sm text-slate-200 break-all">{result.projectPath}</p>
            </div>
            <div className="glass rounded-xl p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Files generated</p>
              <p className="mt-2 text-sm text-slate-200">{result.files?.length || 0} files</p>
            </div>
          </div>

          <div className="mt-6 glass rounded-xl p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Generated paths</p>
            <div className="mt-3 max-h-64 overflow-auto rounded-lg bg-slate-950/40 p-3">
              <pre className="text-xs text-slate-300 whitespace-pre-wrap">{(result.files || []).map(file => `${result.projectPath}/${file}`).join('\n')}</pre>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={resetWizard} className="btn-neon text-white rounded-lg px-4 py-2 text-sm font-medium">
              Create Another Project
            </button>
            <button onClick={() => onCreated?.(result)} className="glass rounded-lg px-4 py-2 text-sm text-slate-200 hover:bg-slate-700/30 transition-colors">
              Open in File Browser
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="flex-1 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto glass-heavy rounded-2xl border border-slate-700/30 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-slate-100">Create a New Workspace</h2>
            <p className="text-sm text-slate-400 mt-2">Set up an ICM project scaffold with a guided wizard. This flow works even if Ollama is offline.</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-slate-500">Project slug preview</p>
            <p className="mt-1 text-sm text-indigo-300">{projectSlug}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-2 md:grid-cols-5" role="list" aria-label="Create mode steps">
          {STEP_TITLES.map((title, index) => (
            <div
              key={title}
              role="listitem"
              aria-current={index === step ? 'step' : undefined}
              className={`rounded-xl border px-3 py-3 text-sm transition-colors ${
                index === step
                  ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-200'
                  : index < step
                    ? 'border-green-500/30 bg-green-500/10 text-green-200'
                    : 'border-slate-700/30 bg-slate-900/30 text-slate-400'
              }`}
            >
              <div className="text-xs uppercase tracking-wide opacity-80">Step {index + 1}</div>
              <div className="mt-1 font-medium">{title}</div>
            </div>
          ))}
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="mt-6">
          {step === 0 && (
            <fieldset className="grid gap-4" aria-label="Project info">
              <div>
                <label className="block text-sm text-slate-300 mb-2" htmlFor="create-name">Project name</label>
                <input id="create-name" value={name} onChange={e => setName(e.target.value)} className="w-full input-glow text-slate-100 rounded-xl px-4 py-3" placeholder="Code Companion Research Hub" />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-2" htmlFor="create-description">Project description</label>
                <textarea id="create-description" value={description} onChange={e => setDescription(e.target.value)} rows={4} className="w-full input-glow text-slate-100 rounded-xl px-4 py-3 resize-y" placeholder="Describe what this workspace should help the AI produce." />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-2" htmlFor="create-role">AI role</label>
                <input id="create-role" value={role} onChange={e => setRole(e.target.value)} className="w-full input-glow text-slate-100 rounded-xl px-4 py-3" placeholder="A PM-focused research and writing assistant for feature planning." />
              </div>
            </fieldset>
          )}

          {step === 1 && (
            <fieldset className="grid gap-4" aria-label="Audience and tone">
              <div>
                <label className="block text-sm text-slate-300 mb-2" htmlFor="create-audience">Target audience</label>
                <textarea id="create-audience" value={audience} onChange={e => setAudience(e.target.value)} rows={3} className="w-full input-glow text-slate-100 rounded-xl px-4 py-3 resize-y" placeholder="Product managers, founders, or other stakeholders who need plain-English output." />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-2" htmlFor="create-tone">Tone</label>
                <select id="create-tone" value={tone} onChange={e => setTone(e.target.value)} className="w-full input-glow text-slate-100 rounded-xl px-4 py-3">
                  <option>Professional</option>
                  <option>Friendly</option>
                  <option>Technical</option>
                  <option>Warm</option>
                  <option>Concise</option>
                  <option>Custom</option>
                </select>
              </div>
            </fieldset>
          )}

          {step === 2 && (
            <fieldset className="grid gap-4" aria-label="Stages">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-medium text-slate-200">Stages</h3>
                  <p className="text-xs text-slate-500 mt-1">Rename the default stages or add more. Triggers are not part of MVP.</p>
                </div>
                <button onClick={addStage} type="button" className="glass rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-slate-700/30 transition-colors">
                  Add Stage
                </button>
              </div>

              {stages.map((stage, index) => (
                <div key={`${index}-${stage.name}`} className="rounded-xl border border-slate-700/30 bg-slate-900/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-200">Stage {index + 1}</p>
                    <button
                      type="button"
                      onClick={() => removeStage(index)}
                      disabled={stages.length === 1}
                      className="text-xs text-slate-400 hover:text-red-300 disabled:opacity-40 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="mt-3 grid gap-3">
                    <div>
                      <label className="block text-sm text-slate-300 mb-2">Stage name</label>
                      <input value={stage.name} onChange={e => updateStage(index, 'name', e.target.value)} className="w-full input-glow text-slate-100 rounded-xl px-4 py-3" />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-300 mb-2">Purpose</label>
                      <textarea value={stage.purpose} onChange={e => updateStage(index, 'purpose', e.target.value)} rows={2} className="w-full input-glow text-slate-100 rounded-xl px-4 py-3 resize-y" />
                    </div>
                  </div>
                </div>
              ))}
            </fieldset>
          )}

          {step === 3 && (
            <fieldset className="grid gap-4" aria-label="Output location">
              <div>
                <label className="block text-sm text-slate-300 mb-2" htmlFor="create-output-root">Output location</label>
                <input id="create-output-root" value={outputRoot} onChange={e => setOutputRoot(e.target.value)} className="w-full input-glow text-slate-100 rounded-xl px-4 py-3" placeholder="/Users/you/AI_Dev" />
                <p className="mt-2 text-xs text-slate-500">The final project folder is derived automatically as <span className="text-slate-300">{projectSlug}</span>.</p>
              </div>

              <div className="rounded-xl border border-slate-700/30 bg-slate-950/30 p-4">
                <p className="text-sm font-medium text-slate-200">Preview</p>
                <div className="mt-3 max-h-64 overflow-auto">
                  <pre className="text-xs text-slate-300 whitespace-pre-wrap">{previewPaths.join('\n')}</pre>
                </div>
              </div>
            </fieldset>
          )}

          {step === 4 && (
            <section aria-label="Review and create" className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="glass rounded-xl p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Project</p>
                  <p className="mt-2 text-sm text-slate-100">{name}</p>
                  <p className="mt-2 text-xs text-slate-400">{description}</p>
                </div>
                <div className="glass rounded-xl p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Audience & tone</p>
                  <p className="mt-2 text-sm text-slate-100">{audience}</p>
                  <p className="mt-2 text-xs text-slate-400">{tone}</p>
                </div>
              </div>

              <div className="glass rounded-xl p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Stages</p>
                <div className="mt-3 grid gap-3">
                  {stages.map((stage, index) => (
                    <div key={`${index}-${stage.name}-summary`} className="rounded-lg border border-slate-700/30 px-3 py-3">
                      <p className="text-sm text-slate-100">{index + 1}. {stage.name}</p>
                      <p className="mt-1 text-xs text-slate-400">{stage.purpose}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass rounded-xl p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Final path</p>
                <p className="mt-2 text-sm text-slate-100">{`${outputRoot.replace(/\/+$/, '')}/${projectSlug}`}</p>
              </div>
            </section>
          )}
        </div>

        <div className="mt-8 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setStep(current => Math.max(0, current - 1))}
            disabled={step === 0 || submitting}
            className="glass rounded-lg px-4 py-2 text-sm text-slate-200 hover:bg-slate-700/30 transition-colors disabled:opacity-40"
          >
            Back
          </button>

          <div className="flex items-center gap-3">
            {step < STEP_TITLES.length - 1 ? (
              <button
                type="button"
                onClick={() => validateCurrentStep() && setStep(current => Math.min(STEP_TITLES.length - 1, current + 1))}
                disabled={!validateCurrentStep() || submitting}
                className="btn-neon text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!validateCurrentStep() || submitting}
                className="btn-neon text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40"
              >
                {submitting ? 'Creating...' : 'Create Project'}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
