/**
 * Regression: chatComplete must distinguish ITS OWN timeout from a caller/client
 * abort.
 *
 * Bug (2026-05-25): when the per-round timeout fired, chatComplete aborted its
 * fetch with controller.abort(), throwing a bare AbortError. The chat handler
 * treats AbortError as a user "Stop" and silently ends the turn — so the
 * slow-model self-heal (which only triggers on a "timed out" error) never fired,
 * and slow local models died at the timeout with no response and no switch.
 *
 * Contract:
 *   - internal timeout  → Error with name "TimeoutError" and "timed out" message
 *   - external abort     → AbortError (a real Stop, must end the turn)
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const { chatComplete } = require("../../lib/ollama-client.js");

function startHangingServer() {
  // Accepts the request and never responds — forces the client-side timeout /
  // abort path without any race on a slow response body.
  const server = http.createServer(() => {});
  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve(server)),
  );
}

test("chatComplete: own timeout throws TimeoutError ('timed out'), not AbortError", async () => {
  const server = await startHangingServer();
  const { port } = server.address();
  try {
    await assert.rejects(
      () =>
        chatComplete(
          `http://127.0.0.1:${port}`,
          "m",
          [{ role: "user", content: "hi" }],
          200, // 200ms timeout
        ),
      (err) => {
        assert.notEqual(
          err.name,
          "AbortError",
          "timeout must NOT surface as AbortError (would be misread as a client Stop)",
        );
        assert.match(err.message, /timed out/i);
        return true;
      },
    );
  } finally {
    server.closeAllConnections?.();
    server.close();
  }
});

test("chatComplete: external abortSignal still throws AbortError (real Stop)", async () => {
  const server = await startHangingServer();
  const { port } = server.address();
  const ac = new AbortController();
  setTimeout(() => ac.abort(), 100);
  try {
    await assert.rejects(
      () =>
        chatComplete(
          `http://127.0.0.1:${port}`,
          "m",
          [{ role: "user", content: "hi" }],
          60000, // long timeout — the abort should win
          [],
          { abortSignal: ac.signal },
        ),
      (err) => {
        assert.equal(
          err.name,
          "AbortError",
          "a real client abort must stay an AbortError so the turn ends",
        );
        return true;
      },
    );
  } finally {
    server.closeAllConnections?.();
    server.close();
  }
});
