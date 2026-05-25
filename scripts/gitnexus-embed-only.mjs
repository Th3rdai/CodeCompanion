#!/usr/bin/env node
/**
 * Generate embeddings on an existing GitNexus index (no full re-parse).
 * Use when `analyze --embeddings` crashes during the embedding phase.
 *
 * Requires GITNEXUS_EMBEDDING_* env (see gitnexus-analyze-embeddings.mjs).
 * MCP must be off; .gitnexus/lbug must not be open elsewhere.
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dbPath = path.join(repoRoot, ".gitnexus/lbug");

const baseUrl = process.env.GITNEXUS_EMBEDDING_URL ?? "http://127.0.0.1:11434/v1";
const model = process.env.GITNEXUS_EMBEDDING_MODEL ?? "nomic-embed-text";
const dims = process.env.GITNEXUS_EMBEDDING_DIMS ?? "768";

process.env.GITNEXUS_EMBEDDING_URL = baseUrl;
process.env.GITNEXUS_EMBEDDING_MODEL = model;
process.env.GITNEXUS_EMBEDDING_DIMS = dims;

function holdersOfLbug() {
  try {
    return execSync(`lsof "${dbPath}" 2>/dev/null || true`, { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

const held = holdersOfLbug();
if (held) {
  console.error(`lbug is busy:\n${held}`);
  process.exit(1);
}

const { getStoragePaths, loadMeta, saveMeta } = await import(
  "../node_modules/gitnexus/dist/storage/repo-manager.js"
);
const {
  initLbug,
  executeQuery,
  executeWithReusedStatement,
  closeLbug,
} = await import("../node_modules/gitnexus/dist/core/lbug/lbug-adapter.js");
const { runEmbeddingPipeline } = await import(
  "../node_modules/gitnexus/dist/core/embeddings/embedding-pipeline.js"
);
const { EMBEDDING_TABLE_NAME } = await import(
  "../node_modules/gitnexus/dist/core/lbug/schema.js"
);
const { isHttpMode } = await import(
  "../node_modules/gitnexus/dist/core/embeddings/http-client.js"
);

if (!isHttpMode()) {
  console.error("Set GITNEXUS_EMBEDDING_URL and GITNEXUS_EMBEDDING_MODEL");
  process.exit(1);
}

const { lbugPath, storagePath } = getStoragePaths(repoRoot);
const meta = await loadMeta(storagePath);
if (!meta) {
  console.error("No meta.json — run npx gitnexus analyze first");
  process.exit(1);
}

console.log(`Embedding ${repoRoot} via ${model} (${dims}d) @ ${baseUrl}\n`);

await initLbug(lbugPath);

let pipelineError = null;
try {
  await runEmbeddingPipeline(
    executeQuery,
    executeWithReusedStatement,
    (p) => {
      const msg =
        p.phase === "loading-model"
          ? "Connecting to embedding endpoint..."
          : `Embedding ${p.nodesProcessed ?? 0}/${p.totalNodes ?? "?"}`;
      process.stdout.write(`\r  ${msg}`.padEnd(60));
    },
    {},
  );
  console.log("\n");
} catch (err) {
  pipelineError = err;
  console.error(
    `\nEmbedding pipeline error (vector index step often fails on macOS): ${
      err instanceof Error ? err.message : err
    }`,
  );
}

let embeddingCount = 0;
try {
  const embResult = await executeQuery(
    `MATCH (e:${EMBEDDING_TABLE_NAME}) RETURN count(e) AS cnt`,
  );
  embeddingCount = embResult?.[0]?.cnt ?? 0;
} catch (err) {
  console.error(
    `Could not count embeddings: ${err instanceof Error ? err.message : err}`,
  );
}

if (embeddingCount > 0) {
  meta.stats = { ...meta.stats, embeddings: embeddingCount };
  meta.indexedAt = new Date().toISOString();
  await saveMeta(storagePath, meta);
  console.log(`Saved meta: ${embeddingCount} embedding rows`);
}

if (pipelineError && embeddingCount === 0) {
  process.exit(1);
}
if (pipelineError) {
  console.warn(
    "Partial success — rows may exist but vector index missing; hybrid query may still use BM25 after warm-fts.",
  );
  process.exit(0);
}

console.log(`Done: ${embeddingCount} embedding rows`);
