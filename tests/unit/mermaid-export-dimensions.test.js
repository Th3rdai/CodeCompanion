const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

let resolveSvgExportDimensions;

async function getResolver() {
  if (resolveSvgExportDimensions) return resolveSvgExportDimensions;
  const modulePath = pathToFileURL(
    path.resolve(__dirname, "../../src/lib/mermaid-export-dimensions.js"),
  ).href;
  ({ resolveSvgExportDimensions } = await import(modulePath));
  return resolveSvgExportDimensions;
}

test("uses viewBox dimensions when width/height attrs are percentages", async () => {
  const resolve = await getResolver();
  const result = resolve({
    widthAttr: "100%",
    heightAttr: "100%",
    viewBoxAttr: "0 0 960 540",
    styleAttr: "max-width: 420px; max-height: 210px;",
  });

  assert.deepEqual(result, { width: 960, height: 540 });
});

test("uses style pixel dimensions when attrs unresolved and no viewBox", async () => {
  const resolve = await getResolver();
  const result = resolve({
    widthAttr: "100%",
    heightAttr: "100%",
    styleAttr: "max-width: 1200px; max-height: 500px;",
  });

  assert.deepEqual(result, { width: 1200, height: 500 });
});

test("preserves aspect ratio when only width is available", async () => {
  const resolve = await getResolver();
  const result = resolve({
    widthAttr: "1000",
  });

  assert.deepEqual(result, { width: 1000, height: 750 });
});

test("preserves aspect ratio when only height is available", async () => {
  const resolve = await getResolver();
  const result = resolve({
    heightAttr: "300",
  });

  assert.deepEqual(result, { width: 400, height: 300 });
});

test("falls back to sane defaults when no dimensions resolve", async () => {
  const resolve = await getResolver();
  const result = resolve({
    widthAttr: "100%",
    heightAttr: "auto",
    styleAttr: "width: 100%; height: 100%;",
  });

  assert.deepEqual(result, { width: 800, height: 600 });
});
