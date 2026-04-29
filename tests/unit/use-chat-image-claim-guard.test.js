const { test } = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

async function loadUseChatModule() {
  const fileUrl = pathToFileURL(
    path.join(__dirname, "../../src/lib/chat-image-claims.js"),
  ).href;
  return import(fileUrl);
}

test("sanitizeUnconfirmedImageClaims removes generated-image claim text without tool image", async () => {
  const { sanitizeUnconfirmedImageClaims } = await loadUseChatModule();
  const input =
    "Generated image from nano-banana.generate_image.\n\nThe image is now displayed above.";
  const output = sanitizeUnconfirmedImageClaims(input, false);
  assert.strictEqual(
    output,
    "Image generation was not confirmed by tool output in this response.",
  );
});

test("sanitizeUnconfirmedImageClaims keeps claim text when tool image exists", async () => {
  const { sanitizeUnconfirmedImageClaims } = await loadUseChatModule();
  const input = "Generated image from nano-banana.generate_image.";
  const output = sanitizeUnconfirmedImageClaims(input, true);
  assert.strictEqual(output, input);
});

test("sanitizeUnconfirmedImageClaims preserves non-claim assistant content", async () => {
  const { sanitizeUnconfirmedImageClaims } = await loadUseChatModule();
  const input = "Here are three ways to improve your prompt for image detail.";
  const output = sanitizeUnconfirmedImageClaims(input, false);
  assert.strictEqual(output, input);
});

test("sanitizeUnconfirmedImageClaims rewrites unverified exact-resolution claims", async () => {
  const { sanitizeUnconfirmedImageClaims } = await loadUseChatModule();
  const input =
    "I just generated a fresh robot dog image at 1920x1080 and it is now displayed above.";
  const output = sanitizeUnconfirmedImageClaims(input, true);
  assert.match(
    output,
    /exact pixel dimensions depend on model output unless explicitly measured/i,
  );
  assert.doesNotMatch(output, /1920x1080/i);
});

test("sanitizeUnconfirmedImageClaims allows exact resolution when dimensions are verified", async () => {
  const { sanitizeUnconfirmedImageClaims } = await loadUseChatModule();
  const input = "I just generated a fresh robot dog image at 1920x1080.";
  const output = sanitizeUnconfirmedImageClaims(input, true, ["1920x1080"]);
  assert.strictEqual(output, input);
});
