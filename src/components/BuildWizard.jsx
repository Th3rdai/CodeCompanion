import { useState, useMemo, useEffect, useCallback } from "react";
import { apiFetch } from "../lib/api-fetch";
import DictateButton from "./DictateButton";
import { joinAppend } from "../lib/dictationAppend";
import { BUILD_TUTORIAL_STEPS } from "../data/tutorialSteps";

const STEPS = [
  { id: 1, title: "Project Info", fields: ["name", "description"] },
  { id: 2, title: "Audience & Tone", fields: ["audience", "tone"] },
  { id: 3, title: "Output Location", fields: ["outputRoot"] },
  { id: 4, title: "Review & Create", fields: ["review"] },
];

const TONE_OPTIONS = [
  "Friendly",
  "Professional",
  "Technical",
  "Warm",
  "Custom",
];

function slugify(name) {
  if (!name || typeof name !== "string") return "project";
  let s = name
    .toLowerCase()
    .replace(/[\s/]+/g, "-")
    .replace(/[\\:*?"<>|]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (s.length > 64) s = s.slice(0, 64).replace(/-$/, "");
  return s || "project";
}

const TUTORIAL_HINT =
  "Press Tab to keep and move on, or right-click in the field to accept this suggestion.";
const TUTORIAL_CLICK_HINT =
  "Double-click in the field to get a different suggestion.";

const STEP1_ALTERNATIVES = {
  name: ["My First Build", "My Side Project", "My Tool", "My App"],
  description: [
    "A small app or tool I want to plan and build step by step using GSD (planning) and ICM (stages).",
    "A project I want to scaffold with planning and stages so I can build it incrementally.",
    "An app or script I want to design and implement with clear phases and checkpoints.",
    "A tool or automation I want to build with structured planning and stage-based workflow.",
  ],
};

export default function BuildWizard({
  defaultOutputRoot = "~/AI_Dev/",
  onSuccess,
  onToast,
  onCancel,
  step: controlledStep,
  onStepChange,
  prefill,
  tutorialActive,
  tutorialSuggestions,
}) {
  const [internalStep, setInternalStep] = useState(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("Professional");
  const [toneCustom, setToneCustom] = useState("");
  const [outputRoot, setOutputRoot] = useState(defaultOutputRoot);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [stepError, setStepError] = useState(null);
  const [overwrite, setOverwrite] = useState(false);
  const [result, setResult] = useState(null);
  const [hintField, setHintField] = useState(null);
  const [contextualSuggestions, setContextualSuggestions] = useState(null);
  const [contextualSuggestionsLoading, setContextualSuggestionsLoading] =
    useState(false);
  const [loadingSuggestionFor, setLoadingSuggestionFor] = useState(null);
  const [step1CycleIndex, setStep1CycleIndex] = useState({
    name: 0,
    description: 0,
  });

  const step = controlledStep !== undefined ? controlledStep : internalStep;
  const setStep = (n) => {
    setInternalStep(n);
    onStepChange?.(n);
  };

  useEffect(() => setHintField(null), [step]);
  useEffect(() => {
    if (step === 1) setContextualSuggestions(null);
  }, [step]);
  useEffect(() => {
    if (
      step < 2 ||
      !tutorialActive ||
      contextualSuggestions ||
      contextualSuggestionsLoading
    )
      return;
    const hasProjectInfo = name.trim() || description.trim();
    if (!hasProjectInfo) return;
    setContextualSuggestionsLoading(true);
    apiFetch("/api/tutorial-suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim(),
        mode: "build",
      }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then((data) => setContextualSuggestions(data))
      .catch(() => setContextualSuggestions(null))
      .finally(() => setContextualSuggestionsLoading(false));
  }, [step, tutorialActive, name, description]);

  const staticStepSuggestions = BUILD_TUTORIAL_STEPS[step - 1]?.prefill ?? {};
  const effectiveSuggestions =
    step >= 2 && contextualSuggestions
      ? { ...staticStepSuggestions, ...contextualSuggestions }
      : staticStepSuggestions;

  useEffect(() => {
    if (!prefill?.data) return;
    const d = prefill.data;
    if (d.name !== undefined) setName(d.name);
    if (d.description !== undefined) setDescription(d.description);
    if (d.audience !== undefined) setAudience(d.audience);
    if (d.tone !== undefined) {
      setTone(d.tone);
      setToneCustom("");
    }
    if (d.toneCustom !== undefined) setToneCustom(d.toneCustom);
    if (d.outputRoot !== undefined) setOutputRoot(d.outputRoot);
  }, [prefill]);

  const slug = useMemo(() => slugify(name), [name]);
  const projectPathPreview = name
    ? `${outputRoot.replace(/\/?$/, "/")}${slug}`
    : "";

  const handleTutorialSuggestFill = useCallback(
    (fieldKey, currentValue, setValue) => {
      if (!tutorialActive) return;
      const suggestions = effectiveSuggestions || {};
      const suggested = suggestions[fieldKey];
      if (suggested == null || suggested === "") return;
      if (fieldKey === "tone") {
        setValue(suggested);
        setHintField("tone");
        return;
      }
      if (String(currentValue ?? "").trim() !== "") return;
      setValue(suggested);
      setHintField(fieldKey);
    },
    [tutorialActive, effectiveSuggestions],
  );

  const handleTutorialClickForNewSuggestion = useCallback(
    (fieldKey) => {
      if (!tutorialActive) return;
      const setters = {
        name: setName,
        description: setDescription,
        audience: setAudience,
        tone: setTone,
        outputRoot: setOutputRoot,
      };
      const setValue = setters[fieldKey];
      if (!setValue) return;

      if (
        step >= 2 &&
        (fieldKey === "audience" ||
          fieldKey === "tone" ||
          fieldKey === "outputRoot")
      ) {
        setLoadingSuggestionFor(fieldKey);
        apiFetch("/api/tutorial-suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim(),
            mode: "build",
          }),
        })
          .then((r) =>
            r.ok ? r.json() : Promise.reject(new Error(r.statusText)),
          )
          .then((data) => {
            const value = data[fieldKey];
            if (value != null && value !== "") {
              setValue(value);
              setHintField(fieldKey);
            }
          })
          .catch(() => {})
          .finally(() => setLoadingSuggestionFor(null));
        return;
      }

      if (step === 1 && (fieldKey === "name" || fieldKey === "description")) {
        const options = STEP1_ALTERNATIVES[fieldKey];
        if (!options?.length) return;
        setStep1CycleIndex((prev) => {
          const next = (prev[fieldKey] + 1) % options.length;
          setValue(options[next]);
          setHintField(fieldKey);
          return { ...prev, [fieldKey]: next };
        });
      }
    },
    [tutorialActive, step, name, description],
  );

  const acceptTutorialHint = () => setHintField(null);

  const validateStep = () => {
    if (step === 1 && !name.trim()) return "Project name is required.";
    if (step === 2 && tone === "Custom" && !toneCustom.trim())
      return "Please describe your custom tone.";
    if (step === 3 && !outputRoot.trim()) return "Output location is required.";
    return null;
  };

  const handleNext = () => {
    const msg = validateStep();
    setStepError(msg);
    if (!msg) setStep((s) => Math.min(s + 1, STEPS.length));
  };
  const handleBack = () => {
    setStepError(null);
    setStep((s) => Math.max(s - 1, 1));
  };

  const handleSubmit = async () => {
    setError(null);
    setStepError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/build-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || "New Build",
          description: description.trim() || "",
          audience: audience.trim() || "General",
          tone: tone === "Custom" ? toneCustom.trim() : tone,
          outputRoot: outputRoot.trim() || defaultOutputRoot,
          overwrite,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || data.message || "Project creation failed");
        return;
      }
      if (data.success && data.projectPath) {
        setResult(data);
        onToast?.(`Build project created at ${data.projectPath}`);
        onSuccess?.(data.projectPath, data);
      } else {
        setError(data.error || "Unknown error");
      }
    } catch (err) {
      setError(err.message || "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div
        className="glass rounded-xl p-6 max-w-2xl mx-auto space-y-4"
        role="status"
        aria-live="polite"
      >
        <h2 className="text-lg font-bold text-green-400">
          Your build project is ready!
        </h2>
        <p className="text-sm text-slate-300">{result.projectPath}</p>
        <p className="text-xs text-slate-500">
          Open it in Cursor or Claude Code to use GSD (planning) and ICM
          (stages) workflows.
        </p>
        <ul className="text-xs text-slate-400 list-disc list-inside space-y-1">
          {(result.files || []).slice(0, 20).map((f, i) => (
            <li key={i}>{f}</li>
          ))}
          {(result.files?.length || 0) > 20 && (
            <li>… and {result.files.length - 20} more</li>
          )}
        </ul>
      </div>
    );
  }

  return (
    <div
      className="glass rounded-xl p-6 max-w-2xl mx-auto"
      role="form"
      aria-label="Build project wizard"
    >
      {onCancel && (
        <button
          onClick={onCancel}
          className="text-xs text-slate-400 hover:text-indigo-300 transition-colors mb-3"
        >
          ← Back to Projects
        </button>
      )}

      <div className="flex gap-2 mb-6" aria-label="Progress">
        {STEPS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStep(s.id)}
            aria-current={step === s.id ? "step" : undefined}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
              step === s.id
                ? "bg-indigo-600/40 text-indigo-200"
                : "bg-slate-700/50 text-slate-500 hover:text-slate-300"
            }`}
          >
            {s.id}. {s.title}
          </button>
        ))}
      </div>

      {error && (
        <div
          className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm"
          role="alert"
        >
          {error}
        </div>
      )}
      {stepError && (
        <div
          className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm"
          role="alert"
        >
          {stepError}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4" aria-labelledby="build-step1-heading">
          <h3
            id="build-step1-heading"
            className="text-sm font-semibold text-slate-200"
          >
            Project Info
          </h3>
          <div>
            <label
              htmlFor="build-name"
              className="block text-xs text-slate-400 mb-1"
            >
              Project name
            </label>
            <div className="flex gap-2 items-start">
              <input
                id="build-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onFocus={() => handleTutorialSuggestFill("name", name, setName)}
                onClick={() => handleTutorialSuggestFill("name", name, setName)}
                onDoubleClick={() =>
                  handleTutorialClickForNewSuggestion("name")
                }
                onContextMenu={acceptTutorialHint}
                placeholder="My App"
                className="flex-1 min-w-0 input-glow text-slate-100 rounded-lg px-4 py-2.5 text-sm"
                autoFocus
              />
              <DictateButton
                onResult={(text) => setName((prev) => joinAppend(prev, text))}
              />
            </div>
            {hintField === "name" && (
              <p className="mt-1 text-xs text-amber-400/90" role="status">
                {TUTORIAL_HINT} {TUTORIAL_CLICK_HINT}
              </p>
            )}
            {loadingSuggestionFor === "name" && (
              <p className="mt-1 text-xs text-slate-400" role="status">
                Getting new suggestion…
              </p>
            )}
            {name && (
              <p className="mt-1 text-xs text-slate-500">Slug: {slug}</p>
            )}
          </div>
          <div>
            <label
              htmlFor="build-desc"
              className="block text-xs text-slate-400 mb-1"
            >
              What do you want to build?
            </label>
            <div className="flex gap-2 items-start">
              <textarea
                id="build-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onFocus={() =>
                  handleTutorialSuggestFill(
                    "description",
                    description,
                    setDescription,
                  )
                }
                onClick={() =>
                  handleTutorialSuggestFill(
                    "description",
                    description,
                    setDescription,
                  )
                }
                onDoubleClick={() =>
                  handleTutorialClickForNewSuggestion("description")
                }
                onContextMenu={acceptTutorialHint}
                placeholder="e.g. A small tool to automate X, an app that does Y"
                rows={3}
                className="flex-1 min-w-0 input-glow text-slate-100 rounded-lg px-4 py-2.5 text-sm resize-none"
              />
              <DictateButton
                onResult={(text) =>
                  setDescription((prev) => joinAppend(prev, text))
                }
              />
            </div>
            {hintField === "description" && (
              <p className="mt-1 text-xs text-amber-400/90" role="status">
                {TUTORIAL_HINT} {TUTORIAL_CLICK_HINT}
              </p>
            )}
            {loadingSuggestionFor === "description" && (
              <p className="mt-1 text-xs text-slate-400" role="status">
                Getting new suggestion…
              </p>
            )}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4" aria-labelledby="build-step2-heading">
          <h3
            id="build-step2-heading"
            className="text-sm font-semibold text-slate-200"
          >
            Audience & Tone
          </h3>
          <div>
            <label
              htmlFor="build-audience"
              className="block text-xs text-slate-400 mb-1"
            >
              Target audience
            </label>
            <div className="flex gap-2 items-start">
              <input
                id="build-audience"
                type="text"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                onFocus={() =>
                  handleTutorialSuggestFill("audience", audience, setAudience)
                }
                onClick={() =>
                  handleTutorialSuggestFill("audience", audience, setAudience)
                }
                onDoubleClick={() =>
                  handleTutorialClickForNewSuggestion("audience")
                }
                onContextMenu={acceptTutorialHint}
                placeholder="Who will use this?"
                className="flex-1 min-w-0 input-glow text-slate-100 rounded-lg px-4 py-2.5 text-sm"
              />
              <DictateButton
                onResult={(text) =>
                  setAudience((prev) => joinAppend(prev, text))
                }
              />
            </div>
            {hintField === "audience" && (
              <p className="mt-1 text-xs text-amber-400/90" role="status">
                {TUTORIAL_HINT} {TUTORIAL_CLICK_HINT}
              </p>
            )}
            {loadingSuggestionFor === "audience" && (
              <p className="mt-1 text-xs text-slate-400" role="status">
                Getting new suggestion…
              </p>
            )}
          </div>
          <div>
            <label
              htmlFor="build-tone"
              className="block text-xs text-slate-400 mb-1"
            >
              Tone
            </label>
            <select
              id="build-tone"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              onFocus={() => handleTutorialSuggestFill("tone", tone, setTone)}
              onClick={() => handleTutorialSuggestFill("tone", tone, setTone)}
              onDoubleClick={() => handleTutorialClickForNewSuggestion("tone")}
              onContextMenu={acceptTutorialHint}
              className="w-full input-glow text-slate-100 rounded-lg px-4 py-2.5 text-sm"
            >
              {TONE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            {hintField === "tone" && (
              <p className="mt-1 text-xs text-amber-400/90" role="status">
                {TUTORIAL_HINT} {TUTORIAL_CLICK_HINT}
              </p>
            )}
            {loadingSuggestionFor === "tone" && (
              <p className="mt-1 text-xs text-slate-400" role="status">
                Getting new suggestion…
              </p>
            )}
            {tone === "Custom" && (
              <div className="flex gap-2 items-start mt-2">
                <input
                  type="text"
                  value={toneCustom}
                  onChange={(e) => setToneCustom(e.target.value)}
                  placeholder="Describe tone"
                  className="flex-1 min-w-0 input-glow text-slate-100 rounded-lg px-4 py-2.5 text-sm"
                />
                <DictateButton
                  onResult={(text) =>
                    setToneCustom((prev) => joinAppend(prev, text))
                  }
                />
              </div>
            )}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4" aria-labelledby="build-step3-heading">
          <h3
            id="build-step3-heading"
            className="text-sm font-semibold text-slate-200"
          >
            Output Location
          </h3>
          <div>
            <label
              htmlFor="build-output"
              className="block text-xs text-slate-400 mb-1"
            >
              Parent folder (project will be created inside)
            </label>
            <div className="flex gap-2 items-start">
              <input
                id="build-output"
                type="text"
                value={outputRoot}
                onChange={(e) => setOutputRoot(e.target.value)}
                onFocus={() =>
                  handleTutorialSuggestFill(
                    "outputRoot",
                    outputRoot,
                    setOutputRoot,
                  )
                }
                onClick={() =>
                  handleTutorialSuggestFill(
                    "outputRoot",
                    outputRoot,
                    setOutputRoot,
                  )
                }
                onDoubleClick={() =>
                  handleTutorialClickForNewSuggestion("outputRoot")
                }
                onContextMenu={acceptTutorialHint}
                placeholder="~/AI_Dev/"
                className="flex-1 min-w-0 input-glow text-slate-100 font-mono rounded-lg px-4 py-2.5 text-sm"
              />
              <DictateButton
                onResult={(text) =>
                  setOutputRoot((prev) => joinAppend(prev, text))
                }
              />
            </div>
            {hintField === "outputRoot" && (
              <p className="mt-1 text-xs text-amber-400/90" role="status">
                {TUTORIAL_HINT} {TUTORIAL_CLICK_HINT}
              </p>
            )}
            {loadingSuggestionFor === "outputRoot" && (
              <p className="mt-1 text-xs text-slate-400" role="status">
                Getting new suggestion…
              </p>
            )}
          </div>
          {name && (
            <div className="p-3 rounded-lg bg-slate-800/50 text-xs text-slate-400 font-mono">
              Project will be created at:
              <br />
              <span className="text-indigo-300">{projectPathPreview}</span>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={overwrite}
              onChange={(e) => setOverwrite(e.target.checked)}
              className="rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500/40"
            />
            Overwrite if project already exists
          </label>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4" aria-labelledby="build-step4-heading">
          <h3
            id="build-step4-heading"
            className="text-sm font-semibold text-slate-200"
          >
            Review & Create
          </h3>
          <dl className="grid grid-cols-1 gap-2 text-sm">
            <div>
              <dt className="text-slate-500">Name</dt>
              <dd className="text-slate-200">{name || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Slug</dt>
              <dd className="font-mono text-indigo-300">{slug}</dd>
            </div>
            <div>
              <dt className="text-slate-500">What you're building</dt>
              <dd className="text-slate-300">{description || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Audience</dt>
              <dd className="text-slate-300">{audience || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Tone</dt>
              <dd className="text-slate-300">
                {tone === "Custom" ? toneCustom : tone}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Path</dt>
              <dd className="font-mono text-slate-300 break-all">
                {projectPathPreview || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Overwrite</dt>
              <dd className={overwrite ? "text-amber-400" : "text-slate-500"}>
                {overwrite ? "Yes" : "No"}
              </dd>
            </div>
          </dl>
        </div>
      )}

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
          <button
            type="button"
            onClick={handleNext}
            className="px-4 py-2 btn-neon text-white rounded-lg text-sm font-medium"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 btn-neon text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create Build Project"}
          </button>
        )}
      </div>
    </div>
  );
}
