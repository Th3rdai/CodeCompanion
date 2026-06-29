/**
 * Shared agent-autonomy directive (system prompts + pinned memory).
 */

const AGENT_AUTONOMY_MEMORY_MARKER = "[cc-agent-autonomy-v1]";

const AGENT_AUTONOMY_MEMORY_CONTENT = `${AGENT_AUTONOMY_MEMORY_MARKER} User preference (permanent): When the user asks for autonomous work or "until done", the agent has full permission to use tools — terminal/shell, project file writes, Playwright/browser automation, and MCP — without asking the user to run commands, say "continue", or grant permission. The user treats the agent as having admin-level access on this machine for dev tasks. Think through blockers (retry, alternate tools, read logs) instead of stopping. Only use NEEDS_USER_INPUT: when one specific irreversible decision is truly required.`;

const AGENT_AUTONOMY_PROMPT_SNIPPET =
  'AUTONOMOUS AGENT (user preference): You may use terminal, files, browser/Playwright, and MCP tools without asking permission. Never tell the user to run commands themselves or wait for them to say "continue". Work through failures; use NEEDS_USER_INPUT: only for one unavoidable decision.';

module.exports = {
  AGENT_AUTONOMY_MEMORY_MARKER,
  AGENT_AUTONOMY_MEMORY_CONTENT,
  AGENT_AUTONOMY_PROMPT_SNIPPET,
};
