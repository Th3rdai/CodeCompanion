// Shared visual tokens for graded report cards.
// Used by ReportCard (Review mode) and ExperimentReport (Experiment mode).
// Centralizing these prevents palette drift between the two report views.

export const GRADE_COLORS = {
  A: {
    bg: "bg-emerald-500/20",
    border: "border-emerald-500/40",
    text: "text-emerald-300",
    ring: "ring-emerald-500/30",
    glow: "shadow-emerald-500/20",
  },
  B: {
    bg: "bg-blue-500/20",
    border: "border-blue-500/40",
    text: "text-blue-300",
    ring: "ring-blue-500/30",
    glow: "shadow-blue-500/20",
  },
  C: {
    bg: "bg-amber-500/20",
    border: "border-amber-500/40",
    text: "text-amber-300",
    ring: "ring-amber-500/30",
    glow: "shadow-amber-500/20",
  },
  D: {
    bg: "bg-orange-500/20",
    border: "border-orange-500/40",
    text: "text-orange-300",
    ring: "ring-orange-500/30",
    glow: "shadow-orange-500/20",
  },
  F: {
    bg: "bg-red-500/20",
    border: "border-red-500/40",
    text: "text-red-300",
    ring: "ring-red-500/30",
    glow: "shadow-red-500/20",
  },
};

export const SEVERITY_COLORS = {
  critical: "text-red-400 bg-red-500/15 border-red-500/30",
  high: "text-orange-400 bg-orange-500/15 border-orange-500/30",
  medium: "text-amber-400 bg-amber-500/15 border-amber-500/30",
  low: "text-blue-400 bg-blue-500/15 border-blue-500/30",
};

export const STATUS_COLORS = {
  active: "text-blue-300 bg-blue-500/15 border-blue-500/30",
  completed: "text-emerald-300 bg-emerald-500/15 border-emerald-500/30",
  aborted: "text-slate-300 bg-slate-500/15 border-slate-500/30",
  failed: "text-red-300 bg-red-500/15 border-red-500/30",
  timeout: "text-amber-300 bg-amber-500/15 border-amber-500/30",
};

// Decision pill colors — distinct from severity palette so users don't
// conflate "iterate" (a neutral choice) with "warning" semantics.
export const DECISION_COLORS = {
  keep: "text-emerald-300 bg-emerald-500/15 border-emerald-500/30",
  iterate: "text-amber-300 bg-amber-500/15 border-amber-500/30",
  discard: "text-slate-300 bg-slate-500/15 border-slate-500/30",
};
