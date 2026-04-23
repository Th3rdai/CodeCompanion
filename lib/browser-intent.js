"use strict";

const SNAPSHOT_REQUEST_RE =
  /\b(snapshot|screenshot|screen\s*shot|capture\s+(?:a\s+)?(?:snapshot|screenshot|screen\s*shot)|take\s+(?:a\s+)?(?:snapshot|screenshot|screen\s*shot)|grab\s+(?:a\s+)?(?:snapshot|screenshot|screen\s*shot))\b/i;

function getLastUserMessageText(messages) {
  if (!Array.isArray(messages)) return "";
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg?.role !== "user") continue;
    if (typeof msg.content === "string") return msg.content;
  }
  return "";
}

function userRequestedBrowserSnapshot(messages) {
  const text = getLastUserMessageText(messages);
  return SNAPSHOT_REQUEST_RE.test(text);
}

function needsSnapshotRetry(toolCalls) {
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) return false;
  let hasBrowserCall = false;
  let hasSnapshotCall = false;
  for (const call of toolCalls) {
    const toolName = call?.toolName || "";
    if (/^browser_/i.test(toolName)) hasBrowserCall = true;
    if (/^browser_snapshot$/i.test(toolName)) hasSnapshotCall = true;
  }
  return hasBrowserCall && !hasSnapshotCall;
}

module.exports = {
  getLastUserMessageText,
  userRequestedBrowserSnapshot,
  needsSnapshotRetry,
};
