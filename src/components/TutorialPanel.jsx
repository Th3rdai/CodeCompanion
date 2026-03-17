import { BookOpen, ChevronLeft, ChevronRight, Lightbulb } from 'lucide-react';
import { BUILD_TUTORIAL_STEPS, CREATE_TUTORIAL_STEPS } from '../data/tutorialSteps';

export default function TutorialPanel({
  mode,
  currentStep,
  onStepChange,
  onPrefillStep,
  onClose,
  totalSteps,
}) {
  const steps = mode === 'build' ? BUILD_TUTORIAL_STEPS : CREATE_TUTORIAL_STEPS;
  const step = steps[currentStep - 1];
  const canPrev = currentStep > 1;
  const canNext = currentStep < totalSteps;
  const hasPrefill = step?.prefill != null;

  return (
    <div className="glass rounded-xl border border-indigo-500/20 p-4 mb-4" role="region" aria-label="Wizard tutorial">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 text-indigo-300">
          <BookOpen className="w-4 h-4 shrink-0" aria-hidden />
          <span className="text-sm font-medium">Tutorial — Step {currentStep} of {totalSteps}</span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            aria-label="Close tutorial"
          >
            Close
          </button>
        )}
      </div>

      {step && (
        <>
          <h3 className="text-sm font-semibold text-slate-200 mb-2">{step.title}</h3>
          <p className="text-xs text-slate-400 leading-relaxed mb-4">{step.body}</p>

          <div className="flex flex-wrap items-center gap-2">
            {hasPrefill && (
              <button
                type="button"
                onClick={() => onPrefillStep(currentStep, step.prefill)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-xs font-medium transition-colors"
              >
                <Lightbulb className="w-3.5 h-3.5" aria-hidden />
                Fill with example
              </button>
            )}
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => onStepChange(currentStep - 1)}
                disabled={!canPrev}
                className="p-1.5 rounded-lg bg-slate-700/50 text-slate-400 hover:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous step"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onStepChange(currentStep + 1)}
                disabled={!canNext}
                className="p-1.5 rounded-lg bg-slate-700/50 text-slate-400 hover:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Next step"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
