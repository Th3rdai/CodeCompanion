import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  Target,
  LayoutList,
  Zap,
  CheckSquare,
  FileCheck,
  BookOpen,
  Repeat,
  Compass,
  Wrench,
  GitBranch,
  Shield,
} from "lucide-react";

// ── Icon registry ────────────────────────────────────
const ICONS = {
  Eye,
  Target,
  LayoutList,
  Zap,
  CheckSquare,
  FileCheck,
  BookOpen,
  Repeat,
  Compass,
  Wrench,
  GitBranch,
  Shield,
};

// ── Grade color mapping (matches ReportCard.jsx) ─────
const GRADE_COLORS = {
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

// ── Grade Badge ──────────────────────────────────────

function GradeBadge({ grade, size = "lg" }) {
  const colors = GRADE_COLORS[grade] || GRADE_COLORS.C;
  const sizeClasses =
    size === "lg"
      ? "w-20 h-20 text-4xl"
      : size === "md"
        ? "w-12 h-12 text-2xl"
        : "w-8 h-8 text-base";

  return (
    <div
      className={`${sizeClasses} rounded-2xl ${colors.bg} ${colors.border} border-2 flex items-center justify-center font-bold ${colors.text} shadow-lg ${colors.glow} transition-all`}
    >
      {grade}
    </div>
  );
}

// ── Category Row ─────────────────────────────────────

function CategoryRow({ categoryKey, categoryData, categoryConfig, onRevise }) {
  const [expanded, setExpanded] = useState(false);
  const IconComponent = ICONS[categoryConfig?.icon] || BookOpen;
  const _colors = GRADE_COLORS[categoryData?.grade] || GRADE_COLORS.C;
  const suggestions = categoryData?.suggestions || [];

  return (
    <div className="glass rounded-xl border border-slate-700/30 overflow-hidden transition-all hover:border-slate-600/50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 hover:bg-slate-700/10 transition-colors text-left"
      >
        <GradeBadge grade={categoryData?.grade || "C"} size="sm" />
        <IconComponent className="w-4 h-4 text-slate-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-100">
            {categoryConfig?.label || categoryKey}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5 truncate">
            {categoryData?.summary || ""}
          </p>
        </div>
        <span className="text-slate-500 shrink-0">
          {expanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-2 border-t border-slate-700/20 pt-3 fade-in">
          {suggestions.length > 0 ? (
            <ul className="space-y-1.5">
              {suggestions.map((suggestion, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-slate-300"
                >
                  <span className="text-indigo-400 shrink-0 mt-0.5">
                    &#8226;
                  </span>
                  <span className="leading-relaxed">{suggestion}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500 italic">
              No specific suggestions for this category.
            </p>
          )}

          {onRevise && (
            <button
              onClick={() =>
                onRevise(categoryKey, categoryConfig?.label || categoryKey)
              }
              className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 px-2.5 py-1.5 rounded-lg transition-colors border border-indigo-500/20 hover:border-indigo-500/40 cursor-pointer"
            >
              Revise this area...
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main BuilderScoreCard ────────────────────────────

export default function BuilderScoreCard({ data, categories, onRevise }) {
  if (!data) return null;

  const { overallGrade, summary } = data;
  const categoryData = data.categories || {};

  return (
    <div className="space-y-4 fade-in max-w-3xl mx-auto">
      {/* Overall Grade Header */}
      <div className="glass rounded-2xl border border-slate-700/30 p-6">
        <div className="flex items-center gap-6">
          <GradeBadge grade={overallGrade || "C"} size="lg" />
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-slate-100">Score Report</h2>
            {summary && (
              <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                {summary}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Category Grade Summary Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {categories.map((cat) => {
          const cd = categoryData[cat.key];
          const colors = GRADE_COLORS[cd?.grade] || GRADE_COLORS.C;
          const IconComponent = ICONS[cat.icon] || BookOpen;
          return (
            <div
              key={cat.key}
              className={`glass rounded-xl border ${colors.border} p-3 text-center`}
            >
              <div className="flex items-center justify-center">
                <IconComponent className={`w-4 h-4 ${colors.text}`} />
              </div>
              <div className={`text-2xl font-bold ${colors.text} mt-1`}>
                {cd?.grade || "-"}
              </div>
              <div className="text-xs text-slate-400 mt-1">{cat.label}</div>
            </div>
          );
        })}
      </div>

      {/* Detailed Category Sections */}
      <div className="space-y-3">
        {categories.map((cat) => {
          const cd = categoryData[cat.key];
          if (!cd) return null;
          return (
            <CategoryRow
              key={cat.key}
              categoryKey={cat.key}
              categoryData={cd}
              categoryConfig={cat}
              onRevise={onRevise}
            />
          );
        })}
      </div>
    </div>
  );
}
