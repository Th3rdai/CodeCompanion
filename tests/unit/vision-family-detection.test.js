/**
 * Lock vision-family detection for the model families the app actively
 * supports. Adding a popular vision model whose family/name doesn't match
 * any substring in VISION_FAMILIES silently breaks image-attached chat —
 * `supportsVision: false` means the resolver skips it and Auto falls back
 * to a non-vision model.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { checkVisionModel } = require("../../lib/ollama-client");

const CASES = [
  // [family, name, expected]
  ["llama", "llava:7b", true],
  ["llama", "llava:34b", true],
  ["llama", "llava-llama3:latest", true],
  ["clip", "moondream:latest", true],
  ["minicpm", "minicpm-v:latest", true],
  ["mllama", "llama3.2-vision:11b", true], // regression: was undetected pre-fix
  ["mllama", "llama3.2-vision:90b", true],
  ["llama", "bakllava:latest", true],
  ["qwen", "qwen-vl:7b", true],
  ["internlm", "internvl:latest", true],
  ["yi", "yi-vl:6b", true],
  ["deepseek", "deepseek-vl:7b", true],
  ["glm", "glm-4v:9b", true],
  // Negatives — non-vision models must NOT be flagged
  ["llama", "llama3.2:latest", false],
  ["qwen", "qwen3-32k:latest", false],
  ["llama", "kimi-k2:1t-cloud", false],
  ["llama", "qwen2.5:7b", false],
];

for (const [family, name, expected] of CASES) {
  test(`checkVisionModel(${JSON.stringify(family)}, ${JSON.stringify(name)}) === ${expected}`, () => {
    assert.strictEqual(checkVisionModel(family, name), expected);
  });
}
