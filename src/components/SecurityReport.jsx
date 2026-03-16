import { useState } from 'react';
import { ShieldAlert, Database, Code, KeyRound, Settings, Globe, ChevronDown, ChevronRight, Copy, Check, Download, RotateCcw, ShieldCheck, AlertTriangle } from 'lucide-react';

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
  info: 'text-slate-400 bg-slate-500/15 border-slate-500/30',
};

// ── OWASP category configuration with Lucide icons ──
const SECURITY_CATEGORIES = {
  accessControl: { label: 'Access Control', Icon: ShieldAlert, owasp: 'A01, API1, API5' },
  dataProtection: { label: 'Data Protection', Icon: Database, owasp: 'A02, A08' },
  injection: { label: 'Injection & Input', Icon: Code, owasp: 'A03' },
  authAndSession: { label: 'Auth & Sessions', Icon: KeyRound, owasp: 'A07, API2' },
  configuration: { label: 'Configuration', Icon: Settings, owasp: 'A05, A06, A09, A10' },
  apiSecurity: { label: 'API Security', Icon: Globe, owasp: 'API3-10' },
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

// ── Copy Fix Prompt Button ──────────────────────────
function CopyFixButton({ text, onToast }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        onToast?.('Fix prompt copied to clipboard');
        setTimeout(() => setCopied(false), 3000);
      }}
      className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-all duration-200 cursor-pointer min-h-[32px] ${
        copied
          ? 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10'
          : 'text-slate-400 border-slate-600 hover:text-indigo-300 hover:border-indigo-500/30 hover:bg-indigo-500/10'
      }`}
      aria-label="Copy fix prompt to clipboard"
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied!' : 'Copy Fix Prompt'}
    </button>
  );
}

// ── Vulnerability Card ──────────────────────────────
function VulnerabilityCard({ vuln, onToast }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="glass rounded-xl border border-slate-700/30 p-3 space-y-2 transition-all hover:border-slate-600/50">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
          <SeverityPill severity={vuln.severity} />
          {vuln.owaspCategory && (
            <span className="text-[10px] font-mono text-slate-500 bg-slate-700/40 px-1.5 py-0.5 rounded">
              {vuln.owaspCategory}
            </span>
          )}
          {vuln.wstgTestCase && (
            <span className="text-[10px] font-mono text-slate-500 bg-slate-700/40 px-1.5 py-0.5 rounded">
              {vuln.wstgTestCase}
            </span>
          )}
          <span className="text-sm font-medium text-slate-200 truncate">{vuln.title}</span>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-slate-500 hover:text-slate-300 text-xs shrink-0 transition-colors cursor-pointer p-1 min-w-[28px] min-h-[28px] flex items-center justify-center"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>

      {expanded && (
        <div className="space-y-2 pt-1 fade-in">
          <p className="text-sm text-slate-300 leading-relaxed">{vuln.description}</p>
          {vuln.impact && (
            <div className="flex items-start gap-2 bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-200/80"><strong>Impact:</strong> {vuln.impact}</p>
            </div>
          )}
          {vuln.codeLocation && (
            <p className="text-xs text-slate-500 font-mono">Location: {vuln.codeLocation}</p>
          )}
          {vuln.remediation && (
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-emerald-400">Remediation</span>
              <p className="text-sm text-slate-300 leading-relaxed">{vuln.remediation}</p>
            </div>
          )}
          {vuln.cvssEstimate && (
            <span className="inline-block text-[10px] font-mono text-slate-500 bg-slate-700/40 px-2 py-0.5 rounded">
              CVSS: {vuln.cvssEstimate}
            </span>
          )}
          {vuln.remediationPrompt && (
            <div className="pt-1">
              <CopyFixButton text={vuln.remediationPrompt} onToast={onToast} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Category Section ────────────────────────────────
function CategorySection({ categoryKey, category, onDeepDive, onToast }) {
  const meta = SECURITY_CATEGORIES[categoryKey] || { label: categoryKey, Icon: Code, owasp: '' };
  const { Icon } = meta;
  const [collapsed, setCollapsed] = useState(false);
  const vulnCount = category.vulnerabilities?.length || 0;

  return (
    <div className="glass rounded-xl border border-slate-700/30 overflow-hidden">
      <div className="p-4 space-y-3">
        {/* Category header */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center gap-3 hover:bg-slate-700/10 transition-colors text-left rounded-lg -m-1 p-1 cursor-pointer"
        >
          <GradeBadge grade={category.grade} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Icon className="w-4 h-4 text-slate-300" />
              <h3 className="text-sm font-semibold text-slate-100">{meta.label}</h3>
              <span className="text-[10px] text-slate-500 bg-slate-700/40 px-1.5 py-0.5 rounded font-mono">
                {meta.owasp}
              </span>
              {vulnCount > 0 && (
                <span className="text-[10px] text-slate-500 bg-slate-700/40 px-1.5 py-0.5 rounded-full">
                  {vulnCount} finding{vulnCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5 truncate">{category.summary}</p>
          </div>
          <span className="text-slate-500 shrink-0">
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
        </button>

        {/* Deep Dive button */}
        {onDeepDive && (
          <button
            onClick={() => onDeepDive(categoryKey, { ...category, label: meta.label })}
            className="w-full text-sm px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium cursor-pointer focus:ring-2 focus:ring-blue-500/40 focus:outline-none"
            aria-label={`Deep dive into ${meta.label}`}
          >
            Deep Dive: {meta.label}
          </button>
        )}
      </div>

      {!collapsed && vulnCount > 0 && (
        <div className="px-4 pb-4 space-y-2 border-t border-slate-700/20 pt-3">
          {category.vulnerabilities.map((vuln, i) => (
            <VulnerabilityCard key={i} vuln={vuln} onToast={onToast} />
          ))}
        </div>
      )}

      {!collapsed && vulnCount === 0 && (
        <div className="px-4 pb-4 border-t border-slate-700/20 pt-3">
          <p className="text-xs text-slate-500 italic">No vulnerabilities found in this category.</p>
        </div>
      )}
    </div>
  );
}

// ── Export helpers ──────────────────────────────────
function handleExportJSON(data, filename) {
  const exportData = { ...data, filename, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const name = filename ? filename.replace(/\.[^.]+$/, '') : 'security-scan';
  a.download = `${name}-security-report.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main Security Report ────────────────────────────
export default function SecurityReport({ data, filename, onDeepDive, onNewScan, onToast }) {
  if (!data) return null;

  const { overallGrade, riskSummary, topRisk, categories, cleanBillOfHealth, testCaseSuggestions } = data;

  return (
    <div className="space-y-4 fade-in max-w-3xl mx-auto">
      {/* Overall Grade Header */}
      <div className="glass rounded-2xl border border-slate-700/30 p-6">
        <div className="flex items-center gap-6">
          <GradeBadge grade={overallGrade} size="lg" />
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-slate-100">
              Security Scan Report
            </h2>
            {filename && (
              <p className="text-sm text-slate-400 mt-0.5 font-mono truncate">{filename}</p>
            )}
            <div className="flex items-center gap-3 mt-2">
              {cleanBillOfHealth ? (
                <span className="text-xs bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-full font-medium">
                  No vulnerabilities detected
                </span>
              ) : (
                <span className="text-xs bg-slate-700/40 text-slate-400 px-2.5 py-1 rounded-full">
                  Vulnerabilities found -- see details below
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2 shrink-0 flex-wrap justify-end">
            <button
              onClick={() => handleExportJSON(data, filename)}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10 hover:text-indigo-200 transition-colors cursor-pointer"
              aria-label="Export report as JSON"
            >
              <Download className="w-3.5 h-3.5" />
              Export Report
            </button>
            <button
              onClick={onNewScan}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700/40 hover:text-white transition-colors cursor-pointer"
              aria-label="Start a new security scan"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              New Scan
            </button>
          </div>
        </div>
      </div>

      {/* Risk Summary */}
      {riskSummary && (
        <div className="glass rounded-xl border border-slate-700/30 p-4">
          <p className="text-sm text-slate-300 leading-relaxed">{riskSummary}</p>
        </div>
      )}

      {/* Clean bill of health celebration */}
      {cleanBillOfHealth && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5 text-center">
          <ShieldCheck className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-emerald-300 mb-1">Your code passed the security scan!</h3>
          <p className="text-sm text-emerald-200/70">No vulnerabilities detected. Keep up the good work!</p>
        </div>
      )}

      {/* Top Risk Callout */}
      {topRisk && !cleanBillOfHealth && (
        <div className="rounded-xl border bg-amber-500/5 border-amber-500/20 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-100">Top Risk</h3>
                <span className="text-[10px] text-slate-500 bg-slate-700/40 px-1.5 py-0.5 rounded-full">
                  {topRisk.category}
                </span>
              </div>
              <p className="text-sm font-medium text-slate-300 mt-1">{topRisk.title}</p>
              <p className="text-sm text-slate-400 mt-1 leading-relaxed">{topRisk.explanation}</p>
            </div>
          </div>
        </div>
      )}

      {/* 6 Category Grade Summary Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {Object.entries(categories).map(([key, cat]) => {
          const meta = SECURITY_CATEGORIES[key] || { label: key, Icon: Code, owasp: '' };
          const { Icon } = meta;
          const colors = GRADE_COLORS[cat.grade] || GRADE_COLORS.C;
          return (
            <div key={key} className={`glass rounded-xl border ${colors.border} p-3 text-center`}>
              <div className="flex items-center justify-center">
                <Icon className="w-4 h-4 text-slate-300" />
              </div>
              <div className={`text-2xl font-bold ${colors.text} mt-1`}>{cat.grade}</div>
              <div className="text-xs text-slate-400 mt-1">{meta.label}</div>
              <div className="text-[9px] text-slate-600 mt-0.5 font-mono">{meta.owasp}</div>
            </div>
          );
        })}
      </div>

      {/* Detailed Category Sections */}
      <div className="space-y-3">
        {Object.entries(categories).map(([key, cat]) => (
          <CategorySection key={key} categoryKey={key} category={cat} onDeepDive={onDeepDive} onToast={onToast} />
        ))}
      </div>

      {/* Test Case Suggestions */}
      {testCaseSuggestions && testCaseSuggestions.length > 0 && (
        <div className="glass rounded-xl border border-slate-700/30 p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-2">Suggested Test Cases</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-slate-400">
            {testCaseSuggestions.map((suggestion, i) => (
              <li key={i}>{suggestion}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
