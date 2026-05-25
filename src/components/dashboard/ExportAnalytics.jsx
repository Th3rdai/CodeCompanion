import { Download, FileJson, FileSpreadsheet } from "lucide-react";

/**
 * Export analytics data as CSV
 * @param {Object} analytics - Analytics object with totals, modeCounts, modelCounts
 * @returns {string} CSV formatted data
 */
function exportToCSV(analytics) {
  const lines = [];

  // Header
  lines.push("Dashboard Analytics Export");
  lines.push(`Exported: ${new Date().toLocaleString()}`);
  lines.push("");

  // Totals Section
  lines.push("TOTALS");
  lines.push("Metric,Value");
  lines.push(`Total Conversations,${analytics.totals.conversations}`);
  lines.push(`Active Conversations,${analytics.totals.active}`);
  lines.push(`Archived Conversations,${analytics.totals.archived}`);
  lines.push(`Total Messages,${analytics.totals.messages}`);
  lines.push("");

  // Mode Breakdown
  lines.push("MODE BREAKDOWN");
  lines.push("Mode,Count");
  Object.entries(analytics.modeCounts || {})
    .sort((a, b) => b[1] - a[1])
    .forEach(([mode, count]) => {
      lines.push(`${mode},${count}`);
    });
  lines.push("");

  // Model Breakdown
  lines.push("MODEL BREAKDOWN");
  lines.push("Model Family,Count");
  Object.entries(analytics.modelCounts || {})
    .sort((a, b) => b[1] - a[1])
    .forEach(([model, count]) => {
      lines.push(`${model},${count}`);
    });

  return lines.join("\n");
}

/**
 * Export analytics data as JSON
 * @param {Object} analytics - Analytics object
 * @returns {string} JSON formatted data
 */
function exportToJSON(analytics) {
  return JSON.stringify(
    {
      exported: new Date().toISOString(),
      analytics: {
        totals: analytics.totals,
        modeCounts: analytics.modeCounts,
        modelCounts: analytics.modelCounts,
      },
    },
    null,
    2
  );
}

/**
 * Trigger browser download of a text file
 * @param {string} content - File content
 * @param {string} filename - Download filename
 * @param {string} mimeType - MIME type
 */
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * ExportAnalytics - Export button group for analytics data
 * Allows exporting dashboard analytics as CSV or JSON
 */
export default function ExportAnalytics({ analytics }) {
  const handleExportCSV = () => {
    const csv = exportToCSV(analytics);
    const timestamp = new Date().toISOString().split("T")[0];
    downloadFile(csv, `analytics-${timestamp}.csv`, "text/csv");
  };

  const handleExportJSON = () => {
    const json = exportToJSON(analytics);
    const timestamp = new Date().toISOString().split("T")[0];
    downloadFile(json, `analytics-${timestamp}.json`, "application/json");
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-slate-400 font-medium">Export:</span>

      {/* CSV Export */}
      <button
        onClick={handleExportCSV}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 hover:border-indigo-500/50 text-slate-300 hover:text-white transition-all duration-200 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        aria-label="Export analytics as CSV"
      >
        <FileSpreadsheet className="w-4 h-4" />
        <span>CSV</span>
      </button>

      {/* JSON Export */}
      <button
        onClick={handleExportJSON}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 hover:border-indigo-500/50 text-slate-300 hover:text-white transition-all duration-200 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        aria-label="Export analytics as JSON"
      >
        <FileJson className="w-4 h-4" />
        <span>JSON</span>
      </button>
    </div>
  );
}
