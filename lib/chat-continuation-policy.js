/**
 * Single-turn continuation policy: keep working until blocked or the user must decide.
 * Used by the agent tool loop and optional streaming continuation in chat-post-handler.
 */

const AUTO_CONTINUE_USER_MESSAGE =
  "Continue with the next step of the task. Do not stop until the work is fully complete. " +
  "When everything is genuinely done, end your reply with the literal token TASK_COMPLETE on its own line. " +
  "If you truly cannot proceed without a specific user decision, start your reply with NEEDS_USER_INPUT: and ask one clear question — otherwise keep going by emitting the next TOOL_CALL.";

function isExplicitTaskComplete(text) {
  const t = String(text || "").trim();
  if (!t) return false;
  if (/(?:^|\n)\s*TASK_COMPLETE\s*$/im.test(t)) return true;
  if (/\btask[_ ]complete\b/i.test(t)) return true;
  if (
    /\ball done\b|\beverything (?:is )?(?:set up|ready|complete|done)\b|\bsuccessfully (?:completed|finished|deployed|set up)\b|\bfinal answer\b|\bno further action\b|\bnothing (?:else|more) to do\b/i.test(
      t,
    )
  ) {
    return true;
  }
  return false;
}

/** Stop only when the model signals it needs a user decision (not rhetorical questions). */
function needsUserClarity(text) {
  const t = String(text || "").trim();
  if (!t) return false;
  return /(?:^|\n)\s*NEEDS_USER_INPUT\s*:/im.test(t);
}

/** True when the turn should get another model pass (empty reply counts as incomplete). */
function shouldContinueAgentWork(text) {
  const t = String(text || "").trim();
  if (!t) return true;
  if (needsUserClarity(t)) return false;
  if (isExplicitTaskComplete(t)) return false;
  return true;
}

function userRequestedSustainedWork(messages = []) {
  const last = messages.filter((m) => m.role === "user").pop();
  const text = String(last?.content || "").toLowerCase();
  if (!text) return false;
  return /\b(until done|until complete|don't stop|do not stop|keep going|finish all|complete all|full implementation|all sections|entire feature|whole project|implement everything|write all|all files)\b/i.test(
    text,
  );
}

function buildToolResultFollowUpMessage(externalizedToolResults, { actionableIntent }) {
  if (actionableIntent) {
    return (
      `Tool results:\n${externalizedToolResults}\n\n` +
      "⚡ CONTINUE WORK — If the user's original request is not fully complete, emit the next TOOL_CALL now (minimal prose). " +
      "When everything is genuinely finished, end with TASK_COMPLETE on its own line. " +
      "If you cannot proceed without one specific user decision, start with NEEDS_USER_INPUT: and ask one clear question."
    );
  }
  return (
    `Tool results:\n${externalizedToolResults}\n\n` +
    "Summarize these results for the user. Use TASK_COMPLETE on its own line when done; " +
    "NEEDS_USER_INPUT: if you need one decision from the user."
  );
}

module.exports = {
  AUTO_CONTINUE_USER_MESSAGE,
  isExplicitTaskComplete,
  needsUserClarity,
  shouldContinueAgentWork,
  userRequestedSustainedWork,
  buildToolResultFollowUpMessage,
};
