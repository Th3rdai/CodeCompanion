/**
 * GSD Bridge for Code Companion
 *
 * Read-only wrapper around GSD CLI tools (gsd-tools.cjs).
 * Uses execFileSync (no shell) to prevent command injection.
 * Handles @file: large output mechanism from gsd-tools.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const GSD_DIR = path.join(os.homedir(), '.claude', 'get-shit-done');
const GSD_TOOLS = path.join(GSD_DIR, 'bin', 'gsd-tools.cjs');

class GsdBridge {
  constructor(projectCwd) {
    this.projectCwd = projectCwd;
  }

  /**
   * Execute a gsd-tools command and return parsed JSON.
   * Uses execFileSync (no shell invocation) for safety.
   * Handles @file: large output references automatically.
   */
  exec(command, args = []) {
    if (!GsdBridge.isInstalled()) {
      return { error: 'GSD tools not installed. Run auto-install or install manually.' };
    }

    const cmdParts = command.split(' ');
    const fullArgs = [GSD_TOOLS, ...cmdParts, ...args, '--cwd', this.projectCwd];

    try {
      let output = execFileSync('node', fullArgs, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        maxBuffer: 10 * 1024 * 1024,
        timeout: 30000,
      });

      // Handle @file: large output refs (gsd-tools writes to temp file for >50KB)
      if (output.startsWith('@file:')) {
        const filePath = output.slice(6).trim();
        output = fs.readFileSync(filePath, 'utf-8');
        try { fs.unlinkSync(filePath); } catch {}
      }

      return JSON.parse(output);
    } catch (err) {
      // Try to parse stderr or stdout for error JSON
      const raw = err.stdout || err.stderr || err.message || '';
      try {
        return JSON.parse(raw);
      } catch {
        return { error: raw.slice(0, 500) || 'GSD command failed' };
      }
    }
  }

  // ── Convenience Methods ──────────────────────────────

  getState() {
    return this.exec('state-snapshot');
  }

  getRoadmap() {
    return this.exec('roadmap analyze');
  }

  getProgress() {
    return this.exec('progress json');
  }

  getPhases() {
    const roadmap = this.getRoadmap();
    return roadmap.phases || [];
  }

  findPhase(n) {
    return this.exec('find-phase', [String(n)]);
  }

  // ── Direct File Reads (faster than CLI for file content) ──

  readPlan(phaseDir, planNum) {
    const padded = String(planNum).padStart(2, '0');
    const fullDir = path.join(this.projectCwd, phaseDir);
    try {
      const files = fs.readdirSync(fullDir).filter(f => f.includes(`-${padded}-PLAN.md`));
      if (files.length === 0) return null;
      return fs.readFileSync(path.join(fullDir, files[0]), 'utf-8');
    } catch {
      return null;
    }
  }

  readSummary(phaseDir, planNum) {
    const padded = String(planNum).padStart(2, '0');
    const fullDir = path.join(this.projectCwd, phaseDir);
    try {
      const files = fs.readdirSync(fullDir).filter(f => f.includes(`-${padded}-SUMMARY.md`));
      if (files.length === 0) return null;
      return fs.readFileSync(path.join(fullDir, files[0]), 'utf-8');
    } catch {
      return null;
    }
  }

  /**
   * Get phase detail: goal from roadmap + plan/summary file contents.
   */
  getPhaseDetail(phaseNum) {
    const phase = this.findPhase(phaseNum);
    if (phase.error) return phase;

    const phaseDir = phase.directory || phase.path;
    if (!phaseDir) return { error: 'Phase directory not found' };

    const planCount = phase.plan_count || 0;
    const plans = [];
    for (let i = 1; i <= planCount; i++) {
      const plan = this.readPlan(phaseDir, i);
      const summary = this.readSummary(phaseDir, i);
      plans.push({
        number: i,
        hasPlan: !!plan,
        hasSummary: !!summary,
        plan: plan ? plan.slice(0, 2000) : null, // Truncate for API response
        summary: summary ? summary.slice(0, 2000) : null,
      });
    }

    return {
      ...phase,
      plans,
    };
  }

  // ── Static Methods ───────────────────────────────────

  static isInstalled() {
    return fs.existsSync(GSD_TOOLS);
  }

  static ensureInstalled() {
    if (GsdBridge.isInstalled()) {
      return { installed: true, fresh: false };
    }

    try {
      // Create parent directory if needed
      const claudeDir = path.join(os.homedir(), '.claude');
      if (!fs.existsSync(claudeDir)) {
        fs.mkdirSync(claudeDir, { recursive: true });
      }

      execFileSync('git', [
        'clone',
        'https://github.com/gsd-build/get-shit-done.git',
        GSD_DIR,
      ], {
        timeout: 60000,
        stdio: 'pipe',
      });

      return { installed: GsdBridge.isInstalled(), fresh: true };
    } catch (err) {
      return {
        installed: false,
        fresh: false,
        error: err.message || 'Failed to install GSD tools',
      };
    }
  }
}

module.exports = GsdBridge;
