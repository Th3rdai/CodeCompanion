/**
 * File browser → chat image path: MIME guessing and File construction.
 * Full attachChatImageFromBlob needs browser canvas (processImage).
 */

const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

let guessImageMimeFromFilename;
let isBrowserChatImageFilename;
let imageFileFromBlob;

test.before(async () => {
  ({
    guessImageMimeFromFilename,
    isBrowserChatImageFilename,
    imageFileFromBlob,
  } = await import("../../src/lib/file-browser-image-attach.js"));
});

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* no localStorage in some runners */
  }
});

test("guessImageMimeFromFilename maps extensions", () => {
  assert.equal(guessImageMimeFromFilename("x.PNG"), "image/png");
  assert.equal(guessImageMimeFromFilename("a.jpeg"), "image/jpeg");
  assert.equal(guessImageMimeFromFilename("b.jpg"), "image/jpeg");
  assert.equal(guessImageMimeFromFilename("c.gif"), "image/gif");
  assert.equal(guessImageMimeFromFilename("d.webp"), "");
  assert.equal(guessImageMimeFromFilename("e.txt"), "");
});

test("isBrowserChatImageFilename is true only for png/jpeg/gif", () => {
  assert.equal(isBrowserChatImageFilename("shot.png"), true);
  assert.equal(isBrowserChatImageFilename("a.JPEG"), true);
  assert.equal(isBrowserChatImageFilename("x.webp"), false);
});

test("imageFileFromBlob uses blob.type when allowed", () => {
  const b = new Blob([Uint8Array.from([0x89, 0x50])], { type: "image/png" });
  const f = imageFileFromBlob(b, "ignored.gif");
  assert.equal(f.type, "image/png");
  assert.equal(f.name, "ignored.gif");
});

test("imageFileFromBlob falls back to filename when blob type missing", () => {
  const b = new Blob([Uint8Array.from([0xff, 0xd8])]);
  const f = imageFileFromBlob(b, "photo.jpg");
  assert.equal(f.type, "image/jpeg");
});

test("imageFileFromBlob throws for unsupported name", () => {
  const b = new Blob([new Uint8Array(4)]);
  assert.throws(() => imageFileFromBlob(b, "doc.pdf"), /supported chat image/);
});
