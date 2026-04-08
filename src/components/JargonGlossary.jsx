import { useState, useRef, useEffect, useCallback } from "react";
import { BookOpen } from "lucide-react";

/**
 * Glossary of common technical jargon you'll encounter when building with AI coding tools.
 * Used both for the floating glossary panel and for inline hover definitions.
 */
const GLOSSARY = {
  // Architecture & Design
  api: {
    term: "API",
    definition:
      "Application Programming Interface — a way for two pieces of software to talk to each other. Think of it like a waiter taking your order to the kitchen.",
    category: "Architecture",
  },
  rest: {
    term: "REST",
    definition:
      "A common style for building web APIs. When your app fetches data from a server, it's probably using REST.",
    category: "Architecture",
  },
  graphql: {
    term: "GraphQL",
    definition:
      "An alternative to REST that lets the frontend ask for exactly the data it needs — no more, no less.",
    category: "Architecture",
  },
  microservices: {
    term: "Microservices",
    definition:
      "Breaking a big application into smaller, independent services that each do one thing well. Like a food court vs. one big restaurant.",
    category: "Architecture",
  },
  monolith: {
    term: "Monolith",
    definition:
      "A single, unified application where all the code lives together. Simpler to start with, harder to scale.",
    category: "Architecture",
  },
  endpoint: {
    term: "Endpoint",
    definition:
      "A specific URL where your app sends or receives data. Like a specific window at a government office.",
    category: "Architecture",
  },
  webhook: {
    term: "Webhook",
    definition:
      "An automatic notification sent from one app to another when something happens. Like a doorbell — it rings when someone arrives.",
    category: "Architecture",
  },
  middleware: {
    term: "Middleware",
    definition:
      "Code that runs between receiving a request and sending a response. Like a security guard checking IDs before letting you into a building.",
    category: "Architecture",
  },
  sdk: {
    term: "SDK",
    definition:
      "Software Development Kit — a toolkit that makes it easier to build for a specific platform or service.",
    category: "Architecture",
  },

  // Development Process
  "ci/cd": {
    term: "CI/CD",
    definition:
      "Continuous Integration / Continuous Deployment — automated systems that test and ship code changes. Like an assembly line for software.",
    category: "Process",
  },
  "pull request": {
    term: "Pull Request",
    definition:
      "A proposal to merge code changes. Other developers review it before it goes live — like a peer review for code.",
    category: "Process",
  },
  pr: {
    term: "PR",
    definition:
      "Pull Request — a proposal to merge code changes. Other developers review it before it goes live.",
    category: "Process",
  },
  "merge conflict": {
    term: "Merge Conflict",
    definition:
      "When two people edit the same part of a file and Git can't figure out which version to keep. Needs a human to sort out.",
    category: "Process",
  },
  deploy: {
    term: "Deploy",
    definition:
      "Releasing code changes to a live environment where users can access them.",
    category: "Process",
  },
  rollback: {
    term: "Rollback",
    definition:
      'Reverting to a previous version of the software. Like hitting "undo" on a release.',
    category: "Process",
  },
  sprint: {
    term: "Sprint",
    definition:
      "A fixed time period (usually 1-2 weeks) where a team commits to completing specific work.",
    category: "Process",
  },
  "technical debt": {
    term: "Technical Debt",
    definition:
      "Shortcuts taken in code that make future work harder. Like putting off house maintenance — it compounds over time.",
    category: "Process",
  },
  "tech debt": {
    term: "Tech Debt",
    definition:
      "Shortcuts taken in code that make future work harder. Like putting off house maintenance — it compounds over time.",
    category: "Process",
  },
  refactor: {
    term: "Refactor",
    definition:
      "Restructuring existing code without changing what it does. Like reorganizing a messy closet — same stuff, better organized.",
    category: "Process",
  },
  linting: {
    term: "Linting",
    definition:
      "Automated checking of code for style issues and common mistakes. Like spell-check for code.",
    category: "Process",
  },

  // Security
  "sql injection": {
    term: "SQL Injection",
    definition:
      "A security attack where someone tricks your app into running database commands. Like someone writing a command on a paper form instead of their name.",
    category: "Security",
  },
  xss: {
    term: "XSS",
    definition:
      "Cross-Site Scripting — when an attacker injects malicious code into a webpage that other users see. Like someone putting a fake sign in a store.",
    category: "Security",
  },
  csrf: {
    term: "CSRF",
    definition:
      "Cross-Site Request Forgery — tricking a user's browser into making requests they didn't intend. Like someone forging your signature.",
    category: "Security",
  },
  authentication: {
    term: "Authentication",
    definition:
      'Verifying who someone is — proving their identity. "Are you who you say you are?"',
    category: "Security",
  },
  authorization: {
    term: "Authorization",
    definition:
      "Determining what someone is allowed to do after they've been identified. \"OK, you're you — but can you access this?\"",
    category: "Security",
  },
  encryption: {
    term: "Encryption",
    definition:
      "Scrambling data so only authorized parties can read it. Like writing in a secret code only you and the recipient know.",
    category: "Security",
  },
  cors: {
    term: "CORS",
    definition:
      "Cross-Origin Resource Sharing — security rules that control which websites can request data from your server.",
    category: "Security",
  },
  jwt: {
    term: "JWT",
    definition:
      "JSON Web Token — a compact, encrypted token used to securely pass user identity between services. Like a tamper-proof ID badge.",
    category: "Security",
  },
  oauth: {
    term: "OAuth",
    definition:
      'A protocol that lets users grant limited access to their accounts without sharing passwords. "Sign in with Google" uses OAuth.',
    category: "Security",
  },

  // Data
  schema: {
    term: "Schema",
    definition:
      "The structure or blueprint of a database — what fields exist, what types they are, how they relate.",
    category: "Data",
  },
  migration: {
    term: "Migration",
    definition:
      "A scripted change to a database structure. Like remodeling a room — you plan it, execute it, and can undo it if needed.",
    category: "Data",
  },
  query: {
    term: "Query",
    definition:
      "A request for specific data from a database. Like asking a librarian to find books matching certain criteria.",
    category: "Data",
  },
  cache: {
    term: "Cache",
    definition:
      "A temporary storage layer that speeds things up by keeping frequently-used data close at hand. Like keeping your favorite books on your desk instead of the shelf.",
    category: "Data",
  },
  orm: {
    term: "ORM",
    definition:
      "Object-Relational Mapping — a tool that lets developers work with databases using their programming language instead of writing SQL.",
    category: "Data",
  },
  nosql: {
    term: "NoSQL",
    definition:
      "Databases that don't use traditional tables and rows. More flexible for certain types of data, like documents or graphs.",
    category: "Data",
  },
  json: {
    term: "JSON",
    definition:
      "JavaScript Object Notation — a common format for storing and transmitting data. Like a standardized filing system everyone agrees to use.",
    category: "Data",
  },

  // Frontend
  component: {
    term: "Component",
    definition:
      "A reusable, self-contained piece of UI. Like LEGO blocks — you snap them together to build a page.",
    category: "Frontend",
  },
  state: {
    term: "State",
    definition:
      'Data that can change over time in your app. Like "is the menu open?" or "what did the user type?"',
    category: "Frontend",
  },
  render: {
    term: "Render",
    definition:
      "The process of turning code into what users actually see on screen.",
    category: "Frontend",
  },
  dom: {
    term: "DOM",
    definition:
      "Document Object Model — the browser's internal representation of a webpage. Like a blueprint the browser uses to draw the page.",
    category: "Frontend",
  },
  responsive: {
    term: "Responsive",
    definition:
      "Design that adapts to different screen sizes — looks good on both phones and desktops.",
    category: "Frontend",
  },
  ssr: {
    term: "SSR",
    definition:
      "Server-Side Rendering — generating HTML on the server instead of in the browser. Faster first load, better for SEO.",
    category: "Frontend",
  },
  spa: {
    term: "SPA",
    definition:
      "Single Page Application — a web app that loads once and updates dynamically without full page reloads. Feels more like a native app.",
    category: "Frontend",
  },

  // DevOps & Infrastructure
  container: {
    term: "Container",
    definition:
      "A lightweight, portable package that includes everything an app needs to run. Like shipping containers — standardized and work everywhere.",
    category: "Infrastructure",
  },
  docker: {
    term: "Docker",
    definition:
      "A tool for building and running containers. The most popular way to package apps so they run the same everywhere.",
    category: "Infrastructure",
  },
  kubernetes: {
    term: "Kubernetes",
    definition:
      "A system for managing many containers at scale. Like an air traffic controller for your containers.",
    category: "Infrastructure",
  },
  "load balancer": {
    term: "Load Balancer",
    definition:
      "Distributes incoming traffic across multiple servers so no single one gets overwhelmed. Like having multiple checkout lanes at a store.",
    category: "Infrastructure",
  },
  latency: {
    term: "Latency",
    definition:
      "The delay between making a request and getting a response. Lower is better — users notice anything over ~200ms.",
    category: "Infrastructure",
  },
  uptime: {
    term: "Uptime",
    definition:
      'The percentage of time a service is available. "99.9% uptime" means about 8 hours of downtime per year.',
    category: "Infrastructure",
  },
  cdn: {
    term: "CDN",
    definition:
      "Content Delivery Network — servers spread around the world that serve your content from the nearest location. Like having branch offices instead of one HQ.",
    category: "Infrastructure",
  },
};

// Build a lookup map keyed by lowercase term for quick matching
const GLOSSARY_KEYS = Object.keys(GLOSSARY);
const CATEGORIES = [
  ...new Set(Object.values(GLOSSARY).map((g) => g.category)),
].sort();

/**
 * Floating glossary panel that can be toggled from the header.
 * Shows all terms organized by category with search.
 */
export function GlossaryPanel({ onClose }) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState(null);
  const [panelPos, setPanelPos] = useState(null);
  const [dragState, setDragState] = useState(null);
  const panelRef = useRef(null);

  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

  useEffect(() => {
    // Initialize near center when opened
    const width = Math.min(560, window.innerWidth - 32);
    const height = Math.min(760, window.innerHeight - 48);
    setPanelPos({
      left: clamp(
        (window.innerWidth - width) / 2,
        8,
        window.innerWidth - width - 8,
      ),
      top: clamp(
        (window.innerHeight - height) / 2,
        8,
        window.innerHeight - height - 8,
      ),
    });
  }, []);

  useEffect(() => {
    if (!dragState) return;
    const onMove = (e) => {
      const panelWidth = panelRef.current?.offsetWidth || 560;
      const panelHeight = panelRef.current?.offsetHeight || 760;
      setPanelPos({
        left: clamp(
          e.clientX - dragState.offsetX,
          8,
          window.innerWidth - panelWidth - 8,
        ),
        top: clamp(
          e.clientY - dragState.offsetY,
          8,
          window.innerHeight - panelHeight - 8,
        ),
      });
    };
    const onUp = () => setDragState(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragState]);

  const startDrag = useCallback(
    (e) => {
      if (!panelPos) return;
      setDragState({
        offsetX: e.clientX - panelPos.left,
        offsetY: e.clientY - panelPos.top,
      });
    },
    [panelPos],
  );

  const filtered = GLOSSARY_KEYS.filter((key) => {
    const entry = GLOSSARY[key];
    const matchesSearch =
      !search.trim() ||
      entry.term.toLowerCase().includes(search.toLowerCase()) ||
      entry.definition.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      !activeCategory || entry.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  // Deduplicate by term (e.g., 'tech debt' and 'technical debt')
  const seen = new Set();
  const deduplicated = filtered.filter((key) => {
    const term = GLOSSARY[key].term;
    if (seen.has(term)) return false;
    seen.add(term);
    return true;
  });

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={panelRef}
        className="rounded-2xl w-full max-w-lg neon-border max-h-[85vh] flex flex-col shadow-2xl border border-indigo-400/30"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Jargon Glossary"
        aria-modal="true"
        style={{
          position: "fixed",
          left: panelPos?.left ?? "50%",
          top: panelPos?.top ?? "50%",
          transform: panelPos ? "none" : "translate(-50%, -50%)",
          backgroundColor: "rgba(8, 14, 28, 0.96)",
          backdropFilter: "blur(8px)",
        }}
      >
        {/* Header */}
        <div
          className="p-5 border-b border-slate-700/50 cursor-move select-none"
          onPointerDown={startDrag}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-bold text-slate-100 neon-text">
                Jargon Glossary
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white text-xl transition-colors"
              aria-label="Close glossary"
            >
              &#10005;
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mb-2">Drag header to move</p>
          <p className="text-xs text-slate-500 mb-3">
            Plain-English definitions for the tech terms you'll encounter. No
            judgment — everyone starts somewhere.
          </p>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search terms..."
            className="w-full input-glow text-slate-200 text-sm rounded-lg px-3 py-2 placeholder-slate-500"
            autoFocus
          />
          {/* Category pills */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            <button
              onClick={() => setActiveCategory(null)}
              className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                !activeCategory
                  ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/40"
                  : "text-slate-500 hover:text-slate-300 glass"
              }`}
            >
              All
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() =>
                  setActiveCategory(activeCategory === cat ? null : cat)
                }
                className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                  activeCategory === cat
                    ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/40"
                    : "text-slate-500 hover:text-slate-300 glass"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Terms list */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-2">
          {deduplicated.length === 0 && (
            <p className="text-center text-slate-500 text-sm py-8">
              No terms match your search.
            </p>
          )}
          {deduplicated.map((key) => {
            const entry = GLOSSARY[key];
            return (
              <div key={key} className="glass rounded-lg p-3 fade-in">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-indigo-300">
                    {entry.term}
                  </span>
                  <span className="text-[10px] text-slate-600 px-1.5 py-0.5 rounded-full glass">
                    {entry.category}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {entry.definition}
                </p>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-700/30 text-center">
          <p className="text-[10px] text-slate-600">
            {Object.keys(seen).length || deduplicated.length} terms available
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * JargonTooltip — renders inline hover tooltips for jargon terms.
 * Wrap any text content with this component to get automatic jargon highlighting.
 *
 * Usage: <JargonTooltip text="The API uses REST endpoints" />
 */
export function JargonTooltip({ children }) {
  const [tooltip, setTooltip] = useState(null);
  const [tooltipPos, setTooltipPos] = useState(null);
  const [dragState, setDragState] = useState(null);
  const tooltipRef = useRef(null);
  const containerRef = useRef(null);

  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
  const getInitialTooltipPos = useCallback((x, y) => {
    const cardWidth = 320;
    const cardHeight = 180;
    return {
      left: clamp(x - cardWidth / 2, 8, window.innerWidth - cardWidth - 8),
      top: clamp(y - cardHeight - 12, 8, window.innerHeight - cardHeight - 8),
    };
  }, []);

  const handleMouseOver = useCallback(
    (e) => {
      const target = e.target;
      if (target.classList?.contains("jargon-term")) {
        const key = target.dataset.jargonKey;
        const entry = GLOSSARY[key];
        if (entry) {
          const rect = target.getBoundingClientRect();
          setTooltip({
            term: entry.term,
            definition: entry.definition,
            category: entry.category,
          });
          setTooltipPos(
            getInitialTooltipPos(rect.left + rect.width / 2, rect.top),
          );
        }
      }
    },
    [getInitialTooltipPos],
  );

  const handleMouseOut = useCallback((e) => {
    const related = e.relatedTarget;
    // Clear tooltip when mouse leaves jargon term, unless moving to another jargon term
    if (e.target.classList?.contains("jargon-term")) {
      if (!related?.classList?.contains("jargon-term")) {
        setTooltip(null);
      }
    }
  }, []);

  // Dismiss on outside click
  useEffect(() => {
    if (!tooltip) return;
    const dismiss = (e) => {
      if (tooltipRef.current?.contains(e.target)) return;
      setTooltip(null);
      setTooltipPos(null);
    };
    window.addEventListener("pointerdown", dismiss, true);
    return () => {
      window.removeEventListener("pointerdown", dismiss, true);
    };
  }, [tooltip]);

  useEffect(() => {
    if (!dragState || !tooltip) return;
    const handleMove = (e) => {
      const cardWidth = tooltipRef.current?.offsetWidth || 320;
      const cardHeight = tooltipRef.current?.offsetHeight || 180;
      setTooltipPos({
        left: clamp(
          e.clientX - dragState.offsetX,
          8,
          window.innerWidth - cardWidth - 8,
        ),
        top: clamp(
          e.clientY - dragState.offsetY,
          8,
          window.innerHeight - cardHeight - 8,
        ),
      });
    };
    const handleUp = () => setDragState(null);
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [dragState, tooltip]);

  const handleDragStart = useCallback(
    (e) => {
      if (!tooltipPos) return;
      setDragState({
        offsetX: e.clientX - tooltipPos.left,
        offsetY: e.clientY - tooltipPos.top,
      });
    },
    [tooltipPos],
  );

  return (
    <div
      ref={containerRef}
      onMouseOver={handleMouseOver}
      onMouseOut={handleMouseOut}
    >
      {children}
      {tooltip && (
        <div
          ref={tooltipRef}
          className="fixed z-50 rounded-lg p-3 max-w-xs fade-in border border-indigo-400/40 shadow-2xl backdrop-blur-md"
          style={{
            left: tooltipPos?.left ?? 8,
            top: tooltipPos?.top ?? 8,
            backgroundColor: "rgba(6, 12, 24, 0.95)",
          }}
        >
          <div
            className="flex items-center justify-between gap-2 mb-1 cursor-move select-none"
            onPointerDown={handleDragStart}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-semibold text-indigo-300 truncate">
                {tooltip.term}
              </span>
              <span className="text-[9px] text-slate-300 px-1 py-0.5 rounded bg-slate-900/90 border border-slate-700/70">
                {tooltip.category}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setTooltip(null);
                setTooltipPos(null);
              }}
              className="text-slate-400 hover:text-slate-100 text-xs"
              aria-label="Close definition"
            >
              ×
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mb-1">Drag to move</p>
          <div className="h-px bg-slate-700/70 mb-2" />
          <p className="text-[11px] text-slate-200 leading-relaxed">
            {tooltip.definition}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Processes text and wraps known jargon terms with hoverable spans.
 * Returns HTML string with jargon terms wrapped.
 */
export function highlightJargon(html) {
  if (!html) return html;

  // Sort keys by length (longest first) to match multi-word terms before single words
  const sortedKeys = [...GLOSSARY_KEYS].sort((a, b) => b.length - a.length);

  let result = html;
  const matched = new Set();

  for (const key of sortedKeys) {
    const entry = GLOSSARY[key];
    if (matched.has(entry.term)) continue;

    // Only match outside of HTML tags and existing jargon spans
    const regex = new RegExp(
      `(?<![<\\w/])\\b(${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})\\b(?![^<]*>)`,
      "gi",
    );

    result = result.replace(regex, (match) => {
      matched.add(entry.term);
      return `<span class="jargon-term" data-jargon-key="${key}" style="border-bottom: 1px dotted rgba(99,102,241,0.4); cursor: help;">${match}</span>`;
    });
  }

  return result;
}

export { GLOSSARY, CATEGORIES };
export default GlossaryPanel;
