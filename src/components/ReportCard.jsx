import { useState } from 'react';

// ── Grade color mapping ─────────────────────────────

const GRADE_COLORS = {
  A: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/40', text: 'text-emerald-300', ring: 'ring-emerald-500/30', glow: 'shadow-emerald-500/20' },
  B: { bg: 'bg-blue-500/20', border: 'border-blue-500/40', text: 'text-blue-300', ring: 'ring-blue-500/30', glow: 'shadow-blue-500/20' },
  C: { bg: 'bg-amber-500/20', border: 'border-amber-500/40', text: 'text-amber-300', ring: 'ring-amber-500/30', glow: 'shadow-amber-500/20' },
  D: { bg: 'bg-orange-500/20', border: 'border-orange-500/40', text: 'text-orange-300', ring: 'ring-orange-500/30', glow: 'shadow-orange-500/20' },
  F: { bg: 'bg-red-500/20', border: 'border-red-500/40', text: 'text-red-300', ring: 'ring-red-500/30', glow: 'shadow-red-500/20' },
};

const SEVERITY_COLORS = {
  critical: 'text-red-400 bg-red-500/15 border-red-500/30',
  high: 'text-orange-400 bg-orange-500/15 border-orange-500/30',
  medium: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
  low: 'text-blue-400 bg-blue-500/15 border-blue-500/30',
};

const CATEGORY_LABELS = {
  bugs: { label: 'Bugs', icon: '🐛', desc: 'Logic errors, crashes, and broken behavior' },
  security: { label: 'Security', icon: '🔒', desc: 'Vulnerabilities and safety risks' },
  readability: { label: 'Readability', icon: '📖', desc: 'Clarity, naming, and maintainability' },
  completeness: { label: 'Completeness', icon: '✅', desc: 'Missing features, edge cases, and error handling' },
};

// ── Grade Badge ─────────────────────────────────────

function GradeBadge({ grade, size = 'lg' }) {
  const colors = GRADE_COLORS[grade] || GRADE_COLORS.C;
  const sizeClasses = size === 'lg'
    ? 'w-20 h-20 text-4xl'
    : size === 'md'
    ? 'w-12 h-12 text-2xl'
    : 'w-8 h-8 text-base';

  return (
    <div className={`${sizeClasses} rounded-2xl ${colors.bg} ${colors.border} border-2 flex items-center justify-center font-bold ${colors.text} shadow-lg ${colors.glow} transition-all`}>
      {grade}
    </div>
  );
}

// ── Severity Pill ───────────────────────────────────

function SeverityPill({ severity }) {
  return (
    <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full border ${SEVERITY_COLORS[severity] || SEVERITY_COLORS.medium}`}>
      {severity}
    </span>
  );
}

// ── Finding Card ────────────────────────────────────

function CopyFixButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
        copied
          ? 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10'
          : 'text-slate-400 border-slate-600 hover:text-indigo-300 hover:border-indigo-500/30 hover:bg-indigo-500/10'
      }`}
      aria-label="Copy fix to clipboard"
    >
      {copied ? '✓ Copied!' : '📋 Copy Fix'}
    </button>
  );
}

function FindingCard({ finding, categoryKey, onDeepDive }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="glass rounded-xl border border-slate-700/30 p-3 space-y-2 transition-all hover:border-slate-600/50">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <SeverityPill severity={finding.severity} />
          <span className="text-sm font-medium text-slate-200 truncate">{finding.title}</span>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-slate-500 hover:text-slate-300 text-xs shrink-0 transition-colors"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {expanded && (
        <div className="space-y-2 pt-1 fade-in">
          <p className="text-sm text-slate-300 leading-relaxed">{finding.explanation}</p>
          {finding.analogy && (
            <div className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
              <span className="text-amber-400 shrink-0 mt-0.5">💡</span>
              <p className="text-sm text-amber-200/80 italic">{finding.analogy}</p>
            </div>
          )}
          {finding.suggestedFix && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-emerald-400">Suggested Fix</span>
                <CopyFixButton text={finding.suggestedFix} />
              </div>
              <pre className="bg-slate-900/80 border border-slate-700/40 rounded-lg px-3 py-2.5 text-xs text-slate-200 font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
                {finding.suggestedFix}
              </pre>
            </div>
          )}
          {onDeepDive && (
            <button
              onClick={() => onDeepDive(finding, categoryKey)}
              className="text-xs text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 px-2.5 py-1.5 rounded-lg transition-colors border border-indigo-500/20 hover:border-indigo-500/40"
            >
              🔍 Ask about this finding...
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Category Section ────────────────────────────────

function CategorySection({ categoryKey, category, onDeepDive }) {
  const meta = CATEGORY_LABELS[categoryKey] || { label: categoryKey, icon: '📋', desc: '' };
  const [collapsed, setCollapsed] = useState(false);
  const findingsCount = category.findings?.length || 0;

  return (
    <div className="glass rounded-xl border border-slate-700/30 overflow-hidden">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-3 p-4 hover:bg-slate-700/10 transition-colors text-left"
      >
        <GradeBadge grade={category.grade} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span>{meta.icon}</span>
            <h3 className="text-sm font-semibold text-slate-100">{meta.label}</h3>
            {findingsCount > 0 && (
              <span className="text-[10px] text-slate-500 bg-slate-700/40 px-1.5 py-0.5 rounded-full">
                {findingsCount} finding{findingsCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5 truncate">{category.summary}</p>
        </div>
        <span className="text-slate-500 text-xs shrink-0">{collapsed ? '▶' : '▼'}</span>
      </button>

      {!collapsed && findingsCount > 0 && (
        <div className="px-4 pb-4 space-y-2 border-t border-slate-700/20 pt-3">
          {category.findings.map((finding, i) => (
            <FindingCard key={i} finding={finding} categoryKey={categoryKey} onDeepDive={onDeepDive} />
          ))}
        </div>
      )}

      {!collapsed && findingsCount === 0 && (
        <div className="px-4 pb-4 border-t border-slate-700/20 pt-3">
          <p className="text-xs text-slate-500 italic">No issues found in this category.</p>
        </div>
      )}
    </div>
  );
}

// ── Main Report Card ────────────────────────────────

export default function ReportCard({ data, filename, onDeepDive, onNewReview }) {
  if (!data) return null;

  const { overallGrade, topPriority, categories, cleanBillOfHealth } = data;

  return (
    <div className="space-y-4 fade-in max-w-3xl mx-auto">
      {/* Overall Grade Header */}
      <div className="glass rounded-2xl border border-slate-700/30 p-6">
        <div className="flex items-center gap-6">
          <GradeBadge grade={overallGrade} size="lg" />
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-slate-100">
              Code Review Report Card
            </h2>
            {filename && (
              <p className="text-sm text-slate-400 mt-0.5 font-mono truncate">{filename}</p>
            )}
            <div className="flex items-center gap-3 mt-2">
              {cleanBillOfHealth ? (
                <span className="text-xs bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-full font-medium">
                  ✨ Clean bill of health
                </span>
              ) : (
                <span className="text-xs bg-slate-700/40 text-slate-400 px-2.5 py-1 rounded-full">
                  Issues found — see details below
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onNewReview}
            className="text-xs px-3 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700/40 hover:text-white transition-colors shrink-0"
          >
            Review Another
          </button>
        </div>
      </div>

      {/* Top Priority Callout */}
      {topPriority && (
        <div className={`rounded-xl border p-4 ${
          cleanBillOfHealth
            ? 'bg-emerald-500/5 border-emerald-500/20'
            : 'bg-amber-500/5 border-amber-500/20'
        }`}>
          <div className="flex items-start gap-3">
            <span className="text-lg shrink-0 mt-0.5">{cleanBillOfHealth ? '🎉' : '⚠️'}</span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-100">
                  {cleanBillOfHealth ? 'Looking Good!' : '#1 Priority'}
                </h3>
                <span className="text-[10px] text-slate-500 bg-slate-700/40 px-1.5 py-0.5 rounded-full">
                  {topPriority.category}
                </span>
              </div>
              <p className="text-sm font-medium text-slate-300 mt-1">{topPriority.title}</p>
              <p className="text-sm text-slate-400 mt-1 leading-relaxed">{topPriority.explanation}</p>
              {onDeepDive && !cleanBillOfHealth && (
                <button
                  onClick={() => onDeepDive({ title: topPriority.title, explanation: topPriority.explanation, severity: 'high' }, topPriority.category)}
                  className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 px-2.5 py-1.5 rounded-lg transition-colors border border-indigo-500/20 hover:border-indigo-500/40"
                >
                  🔍 Dig deeper into this...
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Category Grade Summary (4-up grid) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(categories).map(([key, cat]) => {
          const meta = CATEGORY_LABELS[key] || { label: key, icon: '📋' };
          const colors = GRADE_COLORS[cat.grade] || GRADE_COLORS.C;
          return (
            <div key={key} className={`glass rounded-xl border ${colors.border} p-3 text-center`}>
              <div className="text-lg">{meta.icon}</div>
              <div className={`text-2xl font-bold ${colors.text} mt-1`}>{cat.grade}</div>
              <div className="text-xs text-slate-400 mt-1">{meta.label}</div>
            </div>
          );
        })}
      </div>

      {/* Detailed Category Sections */}
      <div className="space-y-3">
        {Object.entries(categories).map(([key, cat]) => (
          <CategorySection key={key} categoryKey={key} category={cat} onDeepDive={onDeepDive} />
        ))}
      </div>
    </div>
  );
}
