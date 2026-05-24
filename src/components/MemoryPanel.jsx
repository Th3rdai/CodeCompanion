import { useState, useEffect } from "react";
import { apiFetch } from "../lib/api-fetch";
import {
  Brain,
  Trash2,
  Pencil,
  Search,
  X,
  Check,
  Globe,
  MessageSquare,
  User,
  FolderOpen,
  Pin,
  PinOff,
  Sparkles,
  CheckSquare,
  Square,
} from "lucide-react";

const TYPE_COLORS = {
  fact: {
    bg: "bg-blue-500/15",
    border: "border-blue-500/30",
    text: "text-blue-300",
    label: "agent",
  },
  project: {
    bg: "bg-green-500/15",
    border: "border-green-500/30",
    text: "text-green-300",
    label: "project",
  },
  pattern: {
    bg: "bg-orange-500/15",
    border: "border-orange-500/30",
    text: "text-orange-300",
    label: "pattern",
  },
  summary: {
    bg: "bg-purple-500/15",
    border: "border-purple-500/30",
    text: "text-purple-300",
    label: "summary",
  },
};

/** Agent memories (facts) are global — recalled in every conversation, regardless of project. */
function isAgentMemory(memory) {
  return memory.type === "fact";
}

/** Project memories (project/pattern) are scoped to a specific project key. */
function isProjectMemory(memory) {
  return ["project", "pattern"].includes(memory.type);
}

const FILTER_TABS = [
  { id: "all", label: "All" },
  { id: "agent", label: "🧠 Agent" },
  { id: "project-scoped", label: "📁 Project" },
  { id: "summary", label: "💬 Summaries" },
];

function relativeDate(dateStr) {
  if (!dateStr) return "";
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 30) return `${diffDays} days ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return "1 month ago";
  return `${diffMonths} months ago`;
}

export default function MemoryPanel({ onClose }) {
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [compacting, setCompacting] = useState(false);
  const [compactMsg, setCompactMsg] = useState("");
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  function toggleSelected(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  useEffect(() => {
    fetchMemories();
  }, []);

  async function fetchMemories() {
    setLoading(true);
    try {
      const res = await apiFetch("/api/memory");
      const data = await res.json();
      setMemories(Array.isArray(data) ? data : data.memories || []);
    } catch {
      setMemories([]);
    }
    setLoading(false);
  }

  async function handleSearch(e) {
    e.preventDefault();
    if (!searchQuery.trim()) {
      fetchMemories();
      return;
    }
    setSearching(true);
    try {
      const res = await apiFetch(
        `/api/memory/search?q=${encodeURIComponent(searchQuery.trim())}`,
      );
      const data = await res.json();
      setMemories(
        Array.isArray(data) ? data : data.memories || data.results || [],
      );
    } catch {
      // keep current list on error
    }
    setSearching(false);
  }

  function handleClearSearch() {
    setSearchQuery("");
    fetchMemories();
  }

  async function handleDelete(id) {
    try {
      await apiFetch(`/api/memory/${id}`, { method: "DELETE" });
      setMemories((prev) => prev.filter((m) => m.id !== id));
    } catch {}
  }

  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState("");

  async function handleSave(id) {
    try {
      const res = await apiFetch(`/api/memory/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent }),
      });
      if (res.ok) {
        setMemories((prev) =>
          prev.map((m) => (m.id === id ? { ...m, content: editContent } : m)),
        );
        setEditingId(null);
      }
    } catch {}
  }

  // Pin (protect from auto-pruning) / unpin via PUT { pinned } — MEMORYFIX P5.
  async function handleTogglePin(memory) {
    const next = !memory.pinned;
    try {
      const res = await apiFetch(`/api/memory/${memory.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: next }),
      });
      if (res.ok) {
        setMemories((prev) =>
          prev.map((m) => (m.id === memory.id ? { ...m, pinned: next } : m)),
        );
      }
    } catch {}
  }

  // Bulk pin/unpin selected memories via PUT { pinned }.
  async function bulkSetPinned(pinned) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      const results = await Promise.allSettled(
        ids.map((id) =>
          apiFetch(`/api/memory/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pinned }),
          }).then((res) => {
            if (!res.ok) throw new Error("request failed");
            return id;
          }),
        ),
      );
      const succeeded = new Set(
        results
          .filter((r) => r.status === "fulfilled")
          .map((r) => r.value),
      );
      if (succeeded.size > 0) {
        setMemories((prev) =>
          prev.map((m) => (succeeded.has(m.id) ? { ...m, pinned } : m)),
        );
      }
    } finally {
      clearSelection();
      setBulkBusy(false);
    }
  }

  // Bulk delete (forget) selected memories via DELETE.
  async function bulkForget() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (
      !confirm(
        `Forget ${ids.length} selected ${ids.length === 1 ? "memory" : "memories"}? This cannot be undone.`,
      )
    )
      return;
    setBulkBusy(true);
    try {
      const results = await Promise.allSettled(
        ids.map((id) =>
          apiFetch(`/api/memory/${id}`, { method: "DELETE" }).then((res) => {
            if (!res.ok) throw new Error("request failed");
            return id;
          }),
        ),
      );
      const succeeded = new Set(
        results
          .filter((r) => r.status === "fulfilled")
          .map((r) => r.value),
      );
      if (succeeded.size > 0) {
        setMemories((prev) => prev.filter((m) => !succeeded.has(m.id)));
      }
    } finally {
      clearSelection();
      setBulkBusy(false);
    }
  }

  // Compact: drop summaries from deleted conversations (keeps pinned) — MEMORYFIX P4.
  async function handleCompact() {
    if (
      !confirm(
        "Compact the memory store? This removes conversation summaries whose chat was deleted. Pinned memories are kept.",
      )
    )
      return;
    setCompacting(true);
    setCompactMsg("");
    try {
      const res = await apiFetch("/api/memory/compact", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setCompactMsg(
          `Compacted — removed ${data.removed ?? 0} orphaned, ${data.after ?? "?"} kept.`,
        );
        await fetchMemories();
      } else {
        setCompactMsg("Compact failed.");
      }
    } catch {
      setCompactMsg("Compact failed.");
    }
    setCompacting(false);
  }

  const filtered =
    filter === "all"
      ? memories
      : filter === "agent"
        ? memories.filter(isAgentMemory)
        : filter === "project-scoped"
          ? memories.filter(isProjectMemory)
          : memories.filter((m) => m.type === filter);

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="glass-heavy rounded-2xl w-full max-w-2xl p-6 neon-border max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Memory Manager"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-slate-100 neon-text">
              Memories
            </h2>
            <span className="text-xs text-slate-500">({filtered.length})</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleCompact}
              disabled={compacting}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700/40 hover:text-white disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
              title="Compact: remove summaries from deleted conversations (pinned memories are kept)"
            >
              <Sparkles className="w-4 h-4" />
              {compacting ? "Compacting…" : "Compact"}
            </button>
            <button
              onClick={onClose}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-700/40 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
              aria-label="Close memory panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search bar */}
        <form onSubmit={handleSearch} className="flex gap-2 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search memories..."
              className="w-full input-glow text-slate-100 rounded-lg pl-9 pr-8 py-2 outline-none text-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-1.5 top-1/2 inline-flex min-h-9 min-w-9 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-700/50 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
                aria-label="Clear memory search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={searching}
            className="btn-neon text-white rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {searching ? (
              <span className="inline-block spin">&#x27F3;</span>
            ) : (
              "Search"
            )}
          </button>
        </form>

        {/* Filter tabs */}
        <div className="flex gap-1.5 mb-4 flex-wrap">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setFilter(tab.id);
                clearSelection();
              }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filter === tab.id
                  ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/40"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 border border-transparent"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scope legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1 text-blue-400">
            <User className="w-3 h-3" /> Agent — about you, recalled always
          </span>
          <span className="inline-flex items-center gap-1 text-green-400">
            <FolderOpen className="w-3 h-3" /> Project — active project only
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageSquare className="w-3 h-3" /> Summary — this chat only
          </span>
        </div>

        {compactMsg && (
          <div className="mb-2 text-[11px] text-emerald-400" role="status">
            {compactMsg}
          </div>
        )}

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="glass rounded-lg px-3 py-2 mb-3 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-slate-300">
              {selectedIds.size} selected
            </span>
            <div className="flex items-center gap-1.5 ml-auto flex-wrap">
              <button
                onClick={() => bulkSetPinned(true)}
                disabled={bulkBusy}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
                title="Pin selected — protect from auto-pruning"
              >
                <Pin className="w-3 h-3" /> Pin
              </button>
              <button
                onClick={() => bulkSetPinned(false)}
                disabled={bulkBusy}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-slate-600/30 text-slate-300 hover:bg-slate-600/40 transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
                title="Unpin selected — allow auto-pruning"
              >
                <PinOff className="w-3 h-3" /> Unpin
              </button>
              <button
                onClick={bulkForget}
                disabled={bulkBusy}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-red-500/15 text-red-300 hover:bg-red-500/25 transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/70"
                title="Forget selected — delete permanently"
              >
                <Trash2 className="w-3 h-3" /> Forget
              </button>
              <button
                onClick={clearSelection}
                disabled={bulkBusy}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-slate-400 hover:text-white transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
                title="Clear selection"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            </div>
          </div>
        )}

        {/* Memory list */}
        <div className="flex-1 overflow-y-auto scrollbar-thin space-y-2">
          {loading ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              Loading memories...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Brain className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">
                No memories yet. Have a few conversations and I'll start
                remembering!
              </p>
            </div>
          ) : (
            filtered.map((memory) => {
              const colors = TYPE_COLORS[memory.type] || TYPE_COLORS.fact;
              const isExpanded = expandedId === memory.id;
              return (
                <div key={memory.id} className="glass rounded-lg p-3 group">
                  <div className="flex items-start gap-3">
                    {/* Selection checkbox */}
                    <button
                      onClick={() => toggleSelected(memory.id)}
                      className={`shrink-0 mt-0.5 p-1 rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 ${
                        selectedIds.has(memory.id)
                          ? "text-indigo-400"
                          : "text-slate-500 hover:text-indigo-300"
                      }`}
                      title={
                        selectedIds.has(memory.id)
                          ? "Deselect memory"
                          : "Select memory"
                      }
                      aria-label={
                        selectedIds.has(memory.id)
                          ? "Deselect memory"
                          : "Select memory"
                      }
                      aria-pressed={selectedIds.has(memory.id)}
                    >
                      {selectedIds.has(memory.id) ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      {/* Type badge + scope + project key + date */}
                      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${colors.bg} ${colors.border} ${colors.text} border`}
                        >
                          {colors.label}
                        </span>
                        {isAgentMemory(memory) && (
                          <span
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 border border-blue-500/20 text-blue-400"
                            title="Recalled in every conversation — about you as a person"
                          >
                            <User className="w-2.5 h-2.5" /> always recalled
                          </span>
                        )}
                        {isProjectMemory(memory) && memory.projectKey && (
                          <span
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-500/10 border border-green-500/20 text-green-400"
                            title={`Only recalled when project "${memory.projectKey}" is active`}
                          >
                            <FolderOpen className="w-2.5 h-2.5" />{" "}
                            {memory.projectKey}
                          </span>
                        )}
                        {isProjectMemory(memory) && !memory.projectKey && (
                          <span
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-500/10 border border-slate-500/20 text-slate-400"
                            title="No project assigned — recalled globally"
                          >
                            <Globe className="w-2.5 h-2.5" /> all projects
                          </span>
                        )}
                        {memory.type === "summary" && (
                          <span
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-500/10 border border-slate-500/20 text-slate-500"
                            title="Only recalled within its original conversation"
                          >
                            <MessageSquare className="w-2.5 h-2.5" /> this chat
                          </span>
                        )}
                        {memory.pinned && (
                          <span
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 border border-amber-500/30 text-amber-400"
                            title="Pinned — never auto-pruned"
                          >
                            <Pin className="w-2.5 h-2.5" /> pinned
                          </span>
                        )}
                        <span className="text-[10px] text-slate-600">
                          {relativeDate(memory.createdAt || memory.updatedAt)}
                        </span>
                        {memory.confidence != null && (
                          <span className="text-[10px] text-slate-600">
                            conf: {(memory.confidence * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                      {/* Content */}
                      {editingId === memory.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full input-glow text-slate-100 rounded-lg px-3 py-2 text-sm resize-none min-h-[80px]"
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSave(memory.id)}
                              className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 transition-colors"
                            >
                              <Check className="w-3 h-3" /> Save
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-slate-400 hover:text-white transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p
                          className={`text-sm text-slate-300 cursor-pointer ${!isExpanded ? "line-clamp-3" : ""}`}
                          onClick={() =>
                            setExpandedId(isExpanded ? null : memory.id)
                          }
                        >
                          {memory.content}
                        </p>
                      )}
                    </div>
                    {/* Pin + Edit + Delete buttons */}
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        onClick={() => handleTogglePin(memory)}
                        className={`p-1 rounded transition-all ${
                          memory.pinned
                            ? "text-amber-400 opacity-100"
                            : "text-slate-500 opacity-0 group-hover:opacity-100 hover:text-amber-400"
                        }`}
                        title={
                          memory.pinned
                            ? "Unpin — allow auto-pruning"
                            : "Pin — protect from auto-pruning"
                        }
                        aria-label={memory.pinned ? "Unpin memory" : "Pin memory"}
                      >
                        <Pin
                          className={`w-4 h-4 ${memory.pinned ? "fill-current" : ""}`}
                        />
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(memory.id);
                          setEditContent(memory.content);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-indigo-400 p-1 rounded transition-all"
                        title="Edit memory"
                        aria-label="Edit memory"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(memory.id)}
                        className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 p-1 rounded transition-all"
                        title="Delete memory"
                        aria-label="Delete memory"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
