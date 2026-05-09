"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

test("isDictateTranscribeConfigured uses env GROQ_API_KEY over empty config", async (t) => {
  t.after(() => {
    delete process.env.GROQ_API_KEY;
    delete process.env.DICTATE_GROQ_API_KEY;
  });
  delete process.env.GROQ_API_KEY;
  delete process.env.DICTATE_GROQ_API_KEY;
  delete require.cache[require.resolve("../../lib/dictate-transcribe.js")];
  let m = require("../../lib/dictate-transcribe.js");
  assert.equal(
    m.isDictateTranscribeConfigured({ dictateGroqApiKey: "" }),
    false,
  );

  process.env.GROQ_API_KEY = "gsk_test";
  delete require.cache[require.resolve("../../lib/dictate-transcribe.js")];
  m = require("../../lib/dictate-transcribe.js");
  assert.equal(
    m.isDictateTranscribeConfigured({ dictateGroqApiKey: "" }),
    true,
  );
});

test("isDictateTranscribeConfigured reads config key when env unset", async (t) => {
  t.after(() => {
    delete process.env.GROQ_API_KEY;
    delete process.env.DICTATE_GROQ_API_KEY;
  });
  delete process.env.GROQ_API_KEY;
  delete process.env.DICTATE_GROQ_API_KEY;
  delete require.cache[require.resolve("../../lib/dictate-transcribe.js")];
  const m = require("../../lib/dictate-transcribe.js");
  assert.equal(
    m.isDictateTranscribeConfigured({ dictateGroqApiKey: "abc" }),
    true,
  );
});
