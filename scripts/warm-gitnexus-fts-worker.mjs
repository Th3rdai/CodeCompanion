/**
 * One FTS index per process — invoked by warm-gitnexus-fts.mjs only.
 * Drops orphan LadybugDB *_fts_docs tables (partial CREATE_FTS_INDEX leaves
 * these without a registered index), then creates and verifies the index.
 */
import {
  initLbug,
  loadFTSExtension,
  executeQuery,
  closeLbug,
} from "../node_modules/gitnexus/dist/core/lbug/lbug-adapter.js";

const [, , dbPath, table, indexName, propertiesJson] = process.argv;
if (!dbPath || !table || !indexName || !propertiesJson) {
  console.error(
    "usage: warm-gitnexus-fts-worker.mjs <dbPath> <table> <index> <props-json>",
  );
  process.exit(2);
}

const properties = JSON.parse(propertiesJson);
const propList = properties.map((p) => `'${p}'`).join(", ");

/** LadybugDB orphan docs tables: e.g. 2_function_fts_docs */
async function dropOrphanFtsDocs(nodeTable) {
  const base = nodeTable.toLowerCase();
  for (let i = 0; i < 16; i++) {
    const docsTable = `${i}_${base}_fts_docs`;
    try {
      await executeQuery(`DROP TABLE IF EXISTS \`${docsTable}\``);
    } catch {
      /* ignore */
    }
  }
}

async function verifyFtsIndex(nodeTable, indexName) {
  await executeQuery(
    `CALL QUERY_FTS_INDEX('${nodeTable}', '${indexName}', 'test', conjunctive := false) RETURN node, score LIMIT 1`,
  );
}

try {
  await initLbug(dbPath);
  await loadFTSExtension();

  try {
    await executeQuery(`CALL DROP_FTS_INDEX('${table}', '${indexName}')`);
  } catch {
    /* index may not exist */
  }
  await dropOrphanFtsDocs(table);

  const create = `CALL CREATE_FTS_INDEX('${table}', '${indexName}', [${propList}], stemmer := 'porter')`;
  try {
    await executeQuery(create);
  } catch (e) {
    const msg = String(e?.message ?? e);
    // GitNexus treats any "already exists" as success; docs-table orphans match that.
    if (!msg.includes("already exists")) throw e;
    await dropOrphanFtsDocs(table);
    await executeQuery(create);
  }

  await verifyFtsIndex(table, indexName);
  await closeLbug();
} catch (err) {
  console.error(err?.message || err);
  process.exit(1);
}
