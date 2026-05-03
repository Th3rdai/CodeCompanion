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

test("sanitizeUnconfirmedImageClaims strips fake tool-result blocks (the 2026-05-03 hallucination pattern)", async () => {
  const { sanitizeUnconfirmedImageClaims } = await loadUseChatModule();
  const input = [
    "Let me try generating it again right now.",
    "",
    "> 🔧 **Tool result:**",
    "> Tool nano-banana.generate_image returned:",
    "> ✅ Generated 1 image(s) with 🏆 Gemini 3 Pro Image.",
    "> 📊 **Model**: PRO tier",
    "> 📁 **Generated Images:**",
    ">   1. `/Users/james/nanobanana-images/temp_images/9f3c2d8e.png`",
    "> 🖼️ **Thumbnail previews shown below**",
    "",
    "Can you see the image now?",
  ].join("\n");
  const output = sanitizeUnconfirmedImageClaims(input, false);
  // Fake block must be replaced with the warning notice.
  assert.match(output, /no tool was actually invoked/i);
  // Original prose around the block must be preserved.
  assert.match(output, /Let me try generating it again/);
  assert.match(output, /Can you see the image now/);
  // The fabricated file path must be gone.
  assert.doesNotMatch(output, /9f3c2d8e\.png/);
  // The fabricated success line must be gone.
  assert.doesNotMatch(output, /Generated 1 image\(s\)/);
});

test("sanitizeUnconfirmedImageClaims preserves real tool-result block when toolImage is attached", async () => {
  const { sanitizeUnconfirmedImageClaims } = await loadUseChatModule();
  const input = [
    "> 🔧 **Tool result:**",
    "> Tool nano-banana.generate_image returned:",
    "> ✅ Generated 1 image(s).",
  ].join("\n");
  const output = sanitizeUnconfirmedImageClaims(input, true);
  // When the tool actually ran (hasToolImage=true), keep the block intact.
  assert.strictEqual(output, input);
});

test("sanitizeUnconfirmedImageClaims preserves unrelated blockquotes (no false positives on plain quotes)", async () => {
  const { sanitizeUnconfirmedImageClaims } = await loadUseChatModule();
  const input = [
    "Here's a quote from the docs:",
    "",
    "> Important: always validate user input before passing it to the shell.",
    "> See OWASP top 10 for details.",
    "",
    "That's the rule.",
  ].join("\n");
  const output = sanitizeUnconfirmedImageClaims(input, false);
  assert.strictEqual(output, input);
});

test("sanitizeUnconfirmedImageClaims strips bare TOOL_CODE: image-success line (Gemma hallucination)", async () => {
  const { sanitizeUnconfirmedImageClaims } = await loadUseChatModule();
  const input = [
    "Generate an image of a sunset.",
    'TOOL_CODE: print("Image generated successfully.")',
    "",
    "Let me know if you want adjustments.",
  ].join("\n");
  const output = sanitizeUnconfirmedImageClaims(input, false);
  assert.match(output, /Gemma-family hallucination format/);
  assert.doesNotMatch(output, /TOOL_CODE: print/);
  // Surrounding prose preserved.
  assert.match(output, /Generate an image of a sunset/);
  assert.match(output, /Let me know if you want adjustments/);
});

test("sanitizeUnconfirmedImageClaims strips fenced ```tool_code``` blocks", async () => {
  const { sanitizeUnconfirmedImageClaims } = await loadUseChatModule();
  const input = [
    "Here's the image:",
    "",
    "```tool_code",
    'print(generate_image(prompt="a cat", aspect_ratio="16:9"))',
    "```",
    "",
    "Done!",
  ].join("\n");
  const output = sanitizeUnconfirmedImageClaims(input, false);
  assert.match(output, /Gemma-family hallucination format/);
  assert.doesNotMatch(output, /generate_image\(prompt/);
  assert.match(output, /Here's the image/);
  assert.match(output, /Done!/);
});

test("sanitizeUnconfirmedImageClaims preserves TOOL_CODE: when discussing the keyword in plain prose", async () => {
  const { sanitizeUnconfirmedImageClaims } = await loadUseChatModule();
  // Conservative gate: bare TOOL_CODE: lines that don't claim image work
  // are left alone so docs/explanations aren't mangled.
  const input =
    "Gemma's training data uses TOOL_CODE: as a Python execution prefix.";
  const output = sanitizeUnconfirmedImageClaims(input, false);
  assert.strictEqual(output, input);
});

test("sanitizeUnconfirmedImageClaims keeps TOOL_CODE block when toolImage is real", async () => {
  const { sanitizeUnconfirmedImageClaims } = await loadUseChatModule();
  const input = 'TOOL_CODE: print("Image generated successfully.")';
  const output = sanitizeUnconfirmedImageClaims(input, true);
  assert.strictEqual(output, input);
});
