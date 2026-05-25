#!/usr/bin/env node
/**
 * Build a GitNexus index with Ollama HTTP embeddings (avoids ONNX segfaults).
 *
 * `analyze --embeddings` often exits silently during embedding on macOS/Node 24.
 * This script uses a two-step flow:
 *   1. clean + analyze (graph only) with GITNEXUS_EMBEDDING_DIMS set for schema
 *   2. embed-only pass via Ollama HTTP
 *
 * Prerequisites: Ollama + embedding model; GitNexus MCP off.
 *
 * Usage:
 *   npm run gitnexus:embed
 *   node scripts/gitnexus-analyze-embeddings.mjs --skip-clean
 */
import { execSync, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dbPath = path.join(repoRoot, ".gitnexus/lbug");

/** OpenAI-compatible base; GitNexus appends `/embeddings`. */
const EMBED_URL = process.env.GITNEXUS_EMBEDDING_URL ?? "http://127.0.0.1:11434/v1";
const EMBED_MODEL = process.env.GITNEXUS_EMBEDDING_MODEL ?? "nomic-embed-text";
const EMBED_DIMS = process.env.GITNEXUS_EMBEDDING_DIMS ?? "768";

const skipClean = process.argv.includes("--skip-clean");

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

function run(cmd, args) {
  const env = {
    ...process.env,
    GITNEXUS_EMBEDDING_URL: EMBED_URL,
    GITNEXUS_EMBEDDING_MODEL: EMBED_MODEL,
    GITNEXUS_EMBEDDING_DIMS: EMBED_DIMS,
  };
  const r = spawnSync(cmd, args, { cwd: repoRoot, env, stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const holders = holdersOfLbug();
if (holders.length > 0) {
  console.error(
    `\n.gitnexus/lbug is open. Disable GitNexus MCP and kill orphan gitnexus mcp:\n  pgrep -fl "gitnexus mcp"\n\n${holders.join("\n")}\n`,
  );
  process.exit(1);
}

console.log(
  `GitNexus + Ollama embeddings (${EMBED_MODEL}, ${EMBED_DIMS}d)\n  ${EMBED_URL}/embeddings\n`,
);

if (!skipClean) {
  console.log("Step 1/3: clean...");
  run("npx", ["gitnexus", "clean", "--force"]);
}

console.log("Step 2/3: analyze graph (no ONNX; schema uses EMBEDDING_DIMS)...");
run("npx", ["gitnexus", "analyze"]);

console.log("Step 3/3: embed via Ollama HTTP (may take 15–45 min)...");
run("node", ["scripts/gitnexus-embed-only.mjs"]);

console.log("\nNext: npm run gitnexus:warm-fts");
console.log("Then re-enable GitNexus MCP in Cursor.");
