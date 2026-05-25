#!/usr/bin/env node
/** Update meta.json embedding count after embed-only segfault at vector-index step. */
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const { getStoragePaths, loadMeta, saveMeta } =
  await import("../node_modules/gitnexus/dist/storage/repo-manager.js");
const { initLbug, executeQuery, closeLbug } =
  await import("../node_modules/gitnexus/dist/core/lbug/lbug-adapter.js");
const { EMBEDDING_TABLE_NAME } =
  await import("../node_modules/gitnexus/dist/core/lbug/schema.js");

const { lbugPath, storagePath } = getStoragePaths(repoRoot);
const meta = await loadMeta(storagePath);
if (!meta) {
  console.error("No meta.json");
  process.exit(1);
}

await initLbug(lbugPath);
let count = 0;
try {
  const r = await executeQuery(
    `MATCH (e:${EMBEDDING_TABLE_NAME}) RETURN count(e) AS cnt`,
  );
  count = r?.[0]?.cnt ?? 0;
} finally {
  await closeLbug();
}

meta.stats = { ...meta.stats, embeddings: count };
meta.indexedAt = new Date().toISOString();
await saveMeta(storagePath, meta);
console.log(`meta.json embeddings: ${count}`);
