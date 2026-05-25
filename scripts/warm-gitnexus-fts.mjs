#!/usr/bin/env node
/**
 * Pre-create GitNexus FTS indexes on .gitnexus/lbug using a writable connection.
 *
 * MCP and `gitnexus query` use a read-only pool that cannot run CREATE_FTS_INDEX;
 * analyze defers FTS creation to the first query — so keyword search stays broken
 * until indexes exist on disk. Run this once after analyze (with MCP disabled).
 *
 * Each index is created in a separate Node process to avoid LadybugDB native
 * crashes when reusing one connection across multiple CREATE_FTS_INDEX calls.
 *
 * Usage:
 *   node scripts/warm-gitnexus-fts.mjs
 *   npm run gitnexus:warm-fts
 */
import { execSync, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dbPath = path.join(repoRoot, ".gitnexus/lbug");

const FTS_INDEXES = [
  ["File", "file_fts", ["name", "content"]],
  ["Function", "function_fts", ["name", "content"]],
  ["Class", "class_fts", ["name", "content"]],
  ["Method", "method_fts", ["name", "content"]],
  ["Interface", "interface_fts", ["name", "content"]],
];

const workerPath = path.join(repoRoot, "scripts/warm-gitnexus-fts-worker.mjs");

function holdersOfLbug() {
  try {
    const out = execSync(`lsof "${dbPath}" 2>/dev/null || true`, {
      encoding: "utf8",
    }).trim();
    return out ? out.split("\n") : [];
  } catch {
    return [];
  }
}

const holders = holdersOfLbug();
if (holders.length > 0) {
  console.error(
    "Another process has .gitnexus/lbug open (often the GitNexus MCP server):\n",
  );
  for (const line of holders) console.error(line);
  console.error(
    "\nDisable GitNexus MCP in Cursor (Settings → MCP), wait a few seconds, then re-run:\n" +
      "  npm run gitnexus:warm-fts\n",
  );
  process.exit(1);
}

function runOneIndex(table, indexName, properties) {
  const args = [workerPath, dbPath, table, indexName, JSON.stringify(properties)];
  for (let attempt = 1; attempt <= 3; attempt++) {
    const r = spawnSync(process.execPath, args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (r.status === 0) return true;
    if (attempt < 3) {
      // LadybugDB native close can SIGSEGV; a fresh process usually succeeds.
      continue;
    }
    console.error(
      `FAIL ${table} → ${indexName}:`,
      (r.stderr || r.stdout || "").trim() || `exit ${r.status ?? "signal"}`,
    );
    return false;
  }
  return false;
}

let failed = false;
for (const [table, indexName, properties] of FTS_INDEXES) {
  if (!runOneIndex(table, indexName, properties)) failed = true;
  else console.log(`OK  ${table} → ${indexName}`);
}

if (failed) {
  console.error("\nFTS warmup incomplete. Re-run after fixing errors above.");
  process.exit(1);
}
console.log(
  "\nFTS warmup complete. Re-enable GitNexus MCP and retry gitnexus query.",
);
