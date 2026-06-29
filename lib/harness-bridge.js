/**
 * Harness Bridge for Code Companion
 *
 * In-process reader for a th3rdai-harness Build project's planning state.
 *
 * Replaces an earlier bridge (now removed) that shelled out to an external
 * planning CLI. The th3rdai-harness framework is a
 * plain-text framework: a project's roadmap, state, and progress live in its
 * `.planning/` directory (ROADMAP.md, STATE.md, PROJECT.md, config.json,
 * phases/). This reader parses those files directly — no external tool, no
 * install step — and returns the same response shapes the Build UI consumes:
 *
 *   getRoadmap()       → { overview, phases: [{ number, name, status,
 *                          disk_status, goal, plan_count, summary_count }] }
 *   getProgress()      → { percent, total_plans, total_summaries,
 *                          total_phases, completed_phases }
 *   getPhaseDetail(n)  → { number, name, goal, status, plans: [{ number,
 *                          hasPlan, hasSummary, plan, summary }] }
 *   getState()         → parsed STATE.md (project/focus/position/progress + raw)
 *
 * All methods degrade gracefully: a project with no `.planning/` yet returns
 * empty-but-valid shapes rather than an error object.
 */
const fs = require("fs");
const path = require("path");

const MAX_DOC_CHARS = 2000; // Truncate plan/summary bodies for API responses

class HarnessBridge {
  constructor(projectPath) {
    this.projectCwd = projectPath;
    this.planningDir = path.join(projectPath, ".planning");
    this.phasesDir = path.join(this.planningDir, "phases");
  }

  // ── Internal helpers ─────────────────────────────────

  _readPlanning(file) {
    try {
      return fs.readFileSync(path.join(this.planningDir, file), "utf-8");
    } catch {
      return null;
    }
  }

  /**
   * Parse simple `key: value` YAML front matter (--- delimited) if present.
   * Returns {} when absent. Intentionally minimal — handles the flat scalar
   * fields a STATE.md may carry; nested keys are flattened to dotted paths.
   */
  _parseFrontMatter(text) {
    if (!text || !text.startsWith("---")) return {};
    const end = text.indexOf("\n---", 3);
    if (end === -1) return {};
    const body = text.slice(3, end);
    const out = {};
    let prefix = "";
    for (const rawLine of body.split("\n")) {
      const line = rawLine.replace(/\s+$/, "");
      if (!line.trim() || line.trim().startsWith("#")) continue;
      const m = line.match(/^(\s*)([A-Za-z0-9_.-]+):\s*(.*)$/);
      if (!m) continue;
      const [, indent, key, valueRaw] = m;
      const value = valueRaw.replace(/^["']|["']$/g, "").trim();
      if (value === "") {
        // Parent of a nested block — remember as prefix for indented children
        prefix = indent.length === 0 ? `${key}.` : prefix + `${key}.`;
        continue;
      }
      const fullKey = indent.length > 0 ? `${prefix}${key}` : key;
      if (indent.length === 0) prefix = "";
      out[fullKey] = value;
    }
    return out;
  }

  /**
   * Scan `.planning/phases/` for plan/summary artifacts belonging to a phase.
   * Supports two layouts:
   *   - Flat files:  phases/phase-N-...plan....md and ...summary....md
   *   - Sub-folders: phases/phase-N.../...-NN-PLAN.md and ...-NN-SUMMARY.md
   * Returns { plans: [{ number, planPath, summaryPath }] }.
   */
  _scanPhaseArtifacts(phaseNum) {
    const n = String(phaseNum);
    const plans = new Map(); // planNumber -> { planPath, summaryPath }
    const ensure = (k) => {
      if (!plans.has(k)) plans.set(k, { planPath: null, summaryPath: null });
      return plans.get(k);
    };

    if (!fs.existsSync(this.phasesDir)) return { plans: [] };

    let entries;
    try {
      entries = fs.readdirSync(this.phasesDir, { withFileTypes: true });
    } catch {
      return { plans: [] };
    }

    for (const entry of entries) {
      const full = path.join(this.phasesDir, entry.name);
      // Flat file directly in phases/
      if (entry.isFile()) {
        const fm = entry.name.match(
          new RegExp(`phase-0*${n}\\b.*?(plan|summary)`, "i"),
        );
        if (!fm) continue;
        // Plan number defaults to 1 for the single AI-plan-per-phase layout
        const numMatch = entry.name.match(/-(\d{1,2})-/);
        const planNum = numMatch ? parseInt(numMatch[1], 10) : 1;
        const slot = ensure(planNum);
        if (/summary/i.test(fm[1])) slot.summaryPath = full;
        else slot.planPath = full;
        continue;
      }
      // Sub-folder for the phase (legacy phase-directory layout)
      if (
        entry.isDirectory() &&
        new RegExp(`phase-?0*${n}\\b`, "i").test(entry.name)
      ) {
        let files;
        try {
          files = fs.readdirSync(full);
        } catch {
          files = [];
        }
        for (const f of files) {
          const pm = f.match(/-(\d{2})-PLAN\.md$/i);
          const sm = f.match(/-(\d{2})-SUMMARY\.md$/i);
          if (pm) ensure(parseInt(pm[1], 10)).planPath = path.join(full, f);
          else if (sm)
            ensure(parseInt(sm[1], 10)).summaryPath = path.join(full, f);
        }
      }
    }

    const list = [...plans.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([number, paths]) => ({ number, ...paths }));
    return { plans: list };
  }

  // ── Roadmap ──────────────────────────────────────────

  /**
   * Parse `.planning/ROADMAP.md` into structured phases.
   * Phase checklist lines:  `- [ ] **Phase 1: Name** — description`
   * Goal lines (in detail):  `### Phase 1: Name` then `**Goal**: ...`
   */
  getRoadmap() {
    const md = this._readPlanning("ROADMAP.md");
    if (!md) return { overview: "", phases: [] };

    const lines = md.split("\n");
    const phases = [];
    const goalByNumber = new Map();

    const phaseLineRe =
      /^[-*]\s*\[([ xX])\]\s*\*\*Phase\s+(\d+):\s*([^*]+?)\*\*\s*(?:[—–-]\s*(.*))?$/;
    const detailHeadingRe = /^#{2,4}\s*Phase\s+(\d+):\s*(.+?)\s*$/;
    const goalRe = /^\s*\*\*Goal\*\*:\s*(.+?)\s*$/i;

    let currentDetailNum = null;
    for (const line of lines) {
      const pm = line.match(phaseLineRe);
      if (pm) {
        const status = pm[1].toLowerCase() === "x" ? "complete" : "pending";
        phases.push({
          number: parseInt(pm[2], 10),
          name: pm[3].trim(),
          status,
          disk_status: status,
          goal: (pm[4] || "").trim(),
        });
        continue;
      }
      const dm = line.match(detailHeadingRe);
      if (dm) {
        currentDetailNum = parseInt(dm[1], 10);
        continue;
      }
      if (currentDetailNum != null) {
        const gm = line.match(goalRe);
        if (gm && !goalByNumber.has(currentDetailNum)) {
          goalByNumber.set(currentDetailNum, gm[1].trim());
        }
      }
    }

    // Merge detail goals + per-phase artifact counts
    for (const phase of phases) {
      if (!phase.goal && goalByNumber.has(phase.number)) {
        phase.goal = goalByNumber.get(phase.number);
      }
      const { plans } = this._scanPhaseArtifacts(phase.number);
      phase.plan_count = plans.filter((p) => p.planPath).length;
      phase.summary_count = plans.filter((p) => p.summaryPath).length;
    }

    const overviewMatch = md.match(/##\s*Overview\s*\n+([\s\S]*?)(?:\n##\s|$)/);
    const overview = overviewMatch ? overviewMatch[1].trim() : "";

    return { overview, phases };
  }

  getPhases() {
    return this.getRoadmap().phases;
  }

  // ── Progress ─────────────────────────────────────────

  getProgress() {
    const { phases } = this.getRoadmap();
    const total_phases = phases.length;
    const completed_phases = phases.filter(
      (p) => (p.disk_status || p.status) === "complete",
    ).length;
    const total_plans = phases.reduce((s, p) => s + (p.plan_count || 0), 0);
    const total_summaries = phases.reduce(
      (s, p) => s + (p.summary_count || 0),
      0,
    );

    // Prefer an explicit percent from STATE.md front matter when present;
    // otherwise derive: completed phases, falling back to summaries/plans.
    let percent = null;
    const fm = this._parseFrontMatter(this._readPlanning("STATE.md") || "");
    if (fm["progress.percent"] != null) {
      const p = parseFloat(fm["progress.percent"]);
      if (!Number.isNaN(p)) percent = Math.round(p);
    }
    if (percent == null) {
      if (total_phases > 0) {
        percent = Math.round((completed_phases / total_phases) * 100);
      } else if (total_plans > 0) {
        percent = Math.round((total_summaries / total_plans) * 100);
      } else {
        percent = 0;
      }
    }

    return {
      percent,
      total_plans,
      total_summaries,
      total_phases,
      completed_phases,
    };
  }

  // ── Phase detail ─────────────────────────────────────

  getPhaseDetail(phaseNum) {
    const n = parseInt(phaseNum, 10);
    const roadmap = this.getRoadmap();
    const phase = roadmap.phases.find((p) => p.number === n) || {
      number: n,
      name: `Phase ${n}`,
      goal: "",
      status: "pending",
      disk_status: "pending",
    };

    const { plans } = this._scanPhaseArtifacts(n);
    const detailPlans = plans.map((p) => {
      const plan = p.planPath ? this._safeRead(p.planPath) : null;
      const summary = p.summaryPath ? this._safeRead(p.summaryPath) : null;
      return {
        number: p.number,
        hasPlan: !!plan,
        hasSummary: !!summary,
        plan: plan ? plan.slice(0, MAX_DOC_CHARS) : null,
        summary: summary ? summary.slice(0, MAX_DOC_CHARS) : null,
      };
    });

    return { ...phase, plans: detailPlans };
  }

  _safeRead(p) {
    try {
      return fs.readFileSync(p, "utf-8");
    } catch {
      return null;
    }
  }

  // ── State ────────────────────────────────────────────

  /**
   * Parse `.planning/STATE.md` into a context object for the AI coach.
   * Shape is advisory (not directly rendered by the UI), so we surface the
   * most useful fields plus the raw markdown. Never returns an error object.
   */
  getState() {
    const stateMd = this._readPlanning("STATE.md");
    const projectMd = this._readPlanning("PROJECT.md");
    if (!stateMd && !projectMd) {
      return {
        project: path.basename(this.projectCwd),
        status: "unscaffolded",
        note: "No .planning/ directory yet — project not initialized.",
        progress: this.getProgress(),
      };
    }

    const fm = this._parseFrontMatter(stateMd || "");
    const focusMatch = (stateMd || "").match(
      /\*\*Current focus:\*\*\s*(.+?)\s*$/im,
    );
    const positionMatch = (stateMd || "").match(
      /Phase:\s*(\d+)\s*of\s*(\d+)\s*(?:\(([^)]+)\))?/i,
    );
    const statusMatch = (stateMd || "").match(/Status:\s*(.+?)\s*$/im);
    const coreValueMatch = (projectMd || "").match(
      /\*\*Core value:\*\*\s*(.+?)\s*$/im,
    );

    return {
      project: path.basename(this.projectCwd),
      milestone: fm.milestone || null,
      status: fm.status || (statusMatch ? statusMatch[1].trim() : "active"),
      currentPhase: positionMatch ? parseInt(positionMatch[1], 10) : null,
      totalPhases: positionMatch ? parseInt(positionMatch[2], 10) : null,
      currentFocus: focusMatch ? focusMatch[1].trim() : null,
      coreValue: coreValueMatch ? coreValueMatch[1].trim() : null,
      progress: this.getProgress(),
      stateRaw: (stateMd || "").slice(0, MAX_DOC_CHARS),
    };
  }
}

module.exports = HarnessBridge;
