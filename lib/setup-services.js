"use strict";

const ALLOWED_ACTIONS = new Set(["enable", "disable", "skip"]);

/** @typedef {'all' | 'electronOnly' | 'webOnly'} SetupVisibility */

/**
 * @typedef {object} SetupAcquire
 * @property {string} title
 * @property {string} stepsMd
 * @property {string[]} urls
 */

/**
 * @typedef {object} SetupServiceRow
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {SetupVisibility} visibility
 * @property {Record<string, object | ((ctx: { isElectron: boolean }) => object)>} actions
 * @property {SetupAcquire} [acquire]
 */

/** @type {SetupServiceRow[]} */
const CATALOG = [
  {
    id: "ollama_basics",
    title: "Ollama",
    description: "Local or cloud models for AI features.",
    visibility: "all",
    actions: {
      enable: {},
      disable: {},
      skip: {},
    },
    acquire: {
      title: "Connect Ollama",
      stepsMd:
        "1. Install from **ollama.com**.\n2. Pull a starter model: `ollama pull llama3.2`.\n3. Open **Settings → General** and set **Server URL** (default `http://localhost:11434`) or use **Ollama Cloud** with URL `https://ollama.com` plus an API key.",
      urls: ["https://ollama.com"],
    },
  },
  {
    id: "project_context",
    title: "Project folder",
    description: "Tell Code Companion which project you are working on.",
    visibility: "all",
    actions: {
      enable: {},
      disable: {},
      skip: {},
    },
    acquire: {
      title: "Choose project folder",
      stepsMd:
        "Open **Settings → General** and set **Project folder** (and optionally **File browser folder**). This keeps scans and tools scoped to your code.",
      urls: [],
    },
  },
  {
    id: "docling_toggle",
    title: "Docling document conversion",
    description: "Higher-quality PDF and document conversion when enabled.",
    visibility: "all",
    actions: {
      enable: { docling: { enabled: true } },
      disable: { docling: { enabled: false } },
      skip: {},
    },
    acquire: {
      title: "Docling setup",
      stepsMd:
        "See **docs/DOCLING-AUTO-START.md** in the app repo. When Docling is installed, the app can auto-start it on port 5002.",
      urls: [],
    },
  },
  {
    id: "dictation_groq",
    title: "Voice dictation (Groq)",
    description: "Optional Groq key for speech-to-text in text fields.",
    visibility: "all",
    actions: {
      enable: {},
      disable: {},
      skip: {},
    },
    acquire: {
      title: "Groq API key",
      stepsMd:
        "Create a key in the Groq console, then paste it under **Settings → General → Voice dictation**.",
      urls: ["https://console.groq.com/keys"],
    },
  },
  {
    id: "memory_toggle",
    title: "Embedding memory",
    description: "Remember helpful facts across chats (scoped per Settings).",
    visibility: "all",
    actions: {
      enable: { memory: { enabled: true } },
      disable: { memory: { enabled: false } },
      skip: {},
    },
    acquire: {
      title: "Memory tab",
      stepsMd:
        "Open **Settings → Memory** to turn memory on, pick an embedding model, and tune recall.",
      urls: [],
    },
  },
  {
    id: "agent_safety_bundle",
    title: "Safer agent defaults",
    description:
      "Stricter chat file writes and cautious agent browser defaults; terminal stays off unless you enable it (desktop).",
    visibility: "all",
    actions: {
      enable: (ctx) => {
        const base = {
          chatRequireExplicitFileWrites: true,
          agentBrowser: { enabled: false },
        };
        if (ctx.isElectron) {
          return {
            ...base,
            agentTerminal: { enabled: false, confirmBeforeRun: true },
          };
        }
        return base;
      },
      disable: {},
      skip: {},
    },
    acquire: {
      title: "Review agent settings",
      stepsMd:
        "On **desktop**, open **Settings → General** for **Agent terminal** and command allowlists. On **web**, terminal is not available — use the desktop app for an integrated shell.",
      urls: [],
    },
  },
  {
    id: "mcp_clients",
    title: "MCP clients",
    description:
      "Connect external MCP tools (Cursor-style stdio/http servers).",
    visibility: "all",
    actions: {
      enable: {},
      disable: {},
      skip: {},
    },
    acquire: {
      title: "MCP Clients (Settings)",
      stepsMd:
        "v1 does not change MCP from the assistant. Open **Settings → MCP Clients** to add, test, or remove clients.",
      urls: [],
    },
  },
];

const byId = Object.fromEntries(CATALOG.map((r) => [r.id, r]));

function rowVisible(row, isElectron) {
  if (row.visibility === "all") return true;
  if (row.visibility === "electronOnly") return isElectron;
  if (row.visibility === "webOnly") return !isElectron;
  return true;
}

/**
 * @param {boolean} isElectron
 * @returns {SetupServiceRow[]}
 */
function getFilteredCatalog(isElectron) {
  return CATALOG.filter((r) => rowVisible(r, isElectron));
}

/**
 * @param {boolean} isElectron
 * @returns {string[]}
 */
function getAllowedServiceIds(isElectron) {
  return getFilteredCatalog(isElectron).map((r) => r.id);
}

/**
 * @param {unknown} raw
 * @param {{ isElectron: boolean }} ctx
 * @returns {{ id: string, action: string }[]}
 */
function normalizeIntents(raw, ctx) {
  const allowed = new Set(getAllowedServiceIds(ctx.isElectron));
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const id = typeof item.id === "string" ? item.id.trim() : "";
    const action = typeof item.action === "string" ? item.action.trim() : "";
    if (!id || !allowed.has(id)) continue;
    if (!ALLOWED_ACTIONS.has(action)) continue;
    out.push({ id, action });
  }
  return out;
}

function mergeDeep(target, source) {
  if (!source || typeof source !== "object" || Array.isArray(source))
    return target;
  for (const [k, v] of Object.entries(source)) {
    if (
      v &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      target[k] &&
      typeof target[k] === "object" &&
      !Array.isArray(target[k])
    ) {
      mergeDeep(target[k], v);
    } else {
      target[k] = v;
    }
  }
  return target;
}

/**
 * @param {{ id: string, action: string }[]} intents
 * @param {{ isElectron: boolean }} ctx
 * @returns {Record<string, unknown>}
 */
function mapIntentsToConfigBody(intents, ctx) {
  const body = {};
  for (const intent of intents) {
    const row = byId[intent.id];
    if (!row) continue;
    let frag = row.actions[intent.action];
    if (typeof frag === "function") frag = frag(ctx);
    if (!frag || typeof frag !== "object") continue;
    mergeDeep(body, frag);
  }
  return body;
}

/**
 * @param {{ id: string, action: string }[]} intents
 * @param {{ isElectron: boolean }} ctx
 * @returns {{ id: string, title: string, stepsMd: string, urls: string[] }[]}
 */
function buildAcquireList(intents, ctx) {
  const list = [];
  const seen = new Set();
  for (const intent of intents) {
    if (intent.action !== "enable") continue;
    const row = byId[intent.id];
    if (!row || !row.acquire || seen.has(row.id)) continue;
    if (!rowVisible(row, ctx.isElectron)) continue;
    seen.add(row.id);
    list.push({
      id: row.id,
      title: row.acquire.title,
      stepsMd: row.acquire.stepsMd,
      urls: row.acquire.urls.slice(),
    });
  }
  return list;
}

/**
 * @param {boolean} isElectron
 * @returns {string}
 */
function buildSystemPromptSnippet(isElectron) {
  const ids = getAllowedServiceIds(isElectron);
  return `Allowed intent ids (use only these): ${ids.join(", ")}.\nEach intent has action one of: enable, disable, skip.\nReturn JSON only: {"intents":[{"id":"...","action":"enable|disable|skip"},...],"summary":"short plain text for the user"}`;
}

module.exports = {
  CATALOG,
  ALLOWED_ACTIONS,
  getFilteredCatalog,
  getAllowedServiceIds,
  normalizeIntents,
  mapIntentsToConfigBody,
  buildAcquireList,
  buildSystemPromptSnippet,
};
