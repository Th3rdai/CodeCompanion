import { useState, useEffect, useMemo, useRef } from "react";
import { apiFetch } from "../lib/api-fetch";
import ContextMenu from "./ContextMenu";
import ParticleField from "./3d/ParticleField";
import { use3DEffects } from "../contexts/Effects3DContext";

export default function Sidebar({
  history,
  folders,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onRename,
  onExport,
  onArchive,
  onBulkDelete,
  onBulkExport,
  onBulkArchive,
  onMoveConversation,
  onBulkMove,
  onCreateFolder,
  onRenameFolder,
  onToggleFolderCollapsed,
  onDeleteFolder,
  open,
  onClose,
  collapsed,
  onToggleCollapse: _onToggleCollapse,
  showArchived,
  onToggleArchived,
  modes,
  projectFolder,
  onHealthClick,
}) {
  const [search, setSearch] = useState("");
  const [contextMenu, setContextMenu] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [multiSelect, setMultiSelect] = useState(false);
  const [bulkMoveFolderId, setBulkMoveFolderId] = useState("inbox");
  const [showCreateFolderEditor, setShowCreateFolderEditor] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const { theme } = use3DEffects();
  const [healthIssues, setHealthIssues] = useState(0);
  const [healthDetails, setHealthDetails] = useState([]);
  const healthDebounce = useRef(null);

  const healthSummaryText = useMemo(() => {
    if (healthDetails.length > 0) return healthDetails.join(" · ");
    if (healthIssues > 0) {
      return "Tooling gaps detected — click to open Validate mode for a full scan.";
    }
    return "";
  }, [healthDetails, healthIssues]);

  function formatConversationDate(value) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Unknown date";
    return parsed.toLocaleDateString();
  }

  // Fetch project health on projectFolder change (debounced 1s)
  useEffect(() => {
    setHealthIssues(0);
    setHealthDetails([]);
    if (!projectFolder) return;
    if (healthDebounce.current) clearTimeout(healthDebounce.current);
    const abort = new AbortController();
    healthDebounce.current = setTimeout(() => {
      const hardTimeout = setTimeout(() => abort.abort(), 10000);
      apiFetch("/api/project-health", { signal: abort.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data) return;
          const raw = data.details;
          const details = Array.isArray(raw)
            ? raw.filter((x) => typeof x === "string" && x.trim())
            : [];
          const n =
            typeof data.issues === "number" ? data.issues : details.length;
          setHealthIssues(n);
          setHealthDetails(details);
        })
        .catch(() => {})
        .finally(() => clearTimeout(hardTimeout));
    }, 1000);
    return () => {
      if (healthDebounce.current) clearTimeout(healthDebounce.current);
      abort.abort();
    };
  }, [projectFolder]);

  const multiSelectMode = multiSelect && !collapsed;

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const filteredIds = filtered.map((h) => h.id);
    const allSelected =
      filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));
    setSelectedIds(allSelected ? new Set() : new Set(filteredIds));
  }

  function exitMultiSelect() {
    setMultiSelect(false);
    setSelectedIds(new Set());
  }

  function handleBulkAction(action, ...args) {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    action(ids, ...args);
    exitMultiSelect();
  }

  const orderedFolders = useMemo(() => {
    const list = Array.isArray(folders) ? [...folders] : [];
    const hasInbox = list.some((f) => f.id === "inbox");
    if (!hasInbox) {
      list.unshift({
        id: "inbox",
        name: "Inbox",
        position: 0,
        collapsed: false,
        system: true,
      });
    }
    list.sort((a, b) => {
      const ap = Number.isFinite(a.position) ? a.position : 0;
      const bp = Number.isFinite(b.position) ? b.position : 0;
      return ap - bp || (a.name || "").localeCompare(b.name || "");
    });
    return list;
  }, [folders]);

  const folderById = useMemo(() => {
    return new Map(orderedFolders.map((f) => [f.id, f]));
  }, [orderedFolders]);

  const filtered = useMemo(() => {
    let list = history.filter((h) => (showArchived ? h.archived : !h.archived));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (h) =>
          (h.title || "").toLowerCase().includes(q) ||
          (h.mode || "").toLowerCase().includes(q) ||
          (h.model || "").toLowerCase().includes(q) ||
          (folderById.get(h.folderId || "inbox")?.name || "Inbox")
            .toLowerCase()
            .includes(q),
      );
    }
    return list;
  }, [history, search, showArchived, folderById]);

  const groupedConversations = useMemo(() => {
    const buckets = new Map();
    for (const f of orderedFolders) buckets.set(f.id, []);
    for (const conv of filtered) {
      const folderId =
        typeof conv.folderId === "string" && conv.folderId.trim()
          ? conv.folderId.trim()
          : "inbox";
      if (!buckets.has(folderId)) {
        buckets.set(folderId, []);
      }
      buckets.get(folderId).push(conv);
    }
    const groups = orderedFolders
      .map((folder) => ({ folder, items: buckets.get(folder.id) || [] }))
      .filter((g) => g.items.length > 0 || !search.trim());
    for (const [folderId, items] of buckets.entries()) {
      if (orderedFolders.some((f) => f.id === folderId)) continue;
      groups.push({
        folder: {
          id: folderId,
          name: folderId,
          collapsed: false,
          system: false,
        },
        items,
      });
    }
    return groups;
  }, [orderedFolders, filtered, search]);

  function openCreateFolderEditor() {
    setNewFolderName("");
    setShowCreateFolderEditor(true);
  }

  function submitCreateFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    onCreateFolder?.(name);
    setShowCreateFolderEditor(false);
    setNewFolderName("");
  }

  function promptRenameFolder(folder) {
    if (!folder || folder.system) return;
    const name = window.prompt("Rename folder", folder.name || "");
    if (!name || name === folder.name) return;
    onRenameFolder?.(folder.id, name);
  }

  function handleContextMenu(e, h) {
    e.preventDefault();
    const conversationFolderId = h.folderId || "inbox";
    const moveItems = orderedFolders
      .filter((f) => f.id !== conversationFolderId)
      .slice(0, 12)
      .map((f) => ({
        icon: "📁",
        label: `Move to ${f.name}`,
        action: () => onMoveConversation?.(h.id, f.id),
      }));
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { icon: "✏️", label: "Rename", action: () => onRename(h.id) },
        {
          icon: "📥",
          label: "Export as Markdown",
          action: () => onExport(h.id, "md"),
        },
        {
          icon: "📄",
          label: "Export as Text",
          action: () => onExport(h.id, "txt"),
        },
        { divider: true },
        h.archived
          ? {
              icon: "📂",
              label: "Unarchive",
              action: () => onArchive(h.id, false),
            }
          : {
              icon: "📦",
              label: "Archive",
              action: () => onArchive(h.id, true),
            },
        ...(moveItems.length > 0 ? [{ divider: true }, ...moveItems] : []),
        { divider: true },
        {
          icon: "🗑️",
          label: "Delete",
          action: () => onDelete(h.id),
          danger: true,
        },
      ],
    });
  }

  const isCollapsed = collapsed && !open; // On mobile overlay, always show expanded

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={onClose}
        />
      )}
      <nav
        aria-label="Conversations"
        className={`fixed lg:relative top-0 left-0 h-full glass-heavy border-r border-slate-700/30 z-40 flex flex-col transition-all duration-200 overflow-hidden
          ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          ${isCollapsed ? "lg:w-14" : "w-72"}`}
      >
        <ParticleField particleCount={300} speed={0.15} color={theme.primary} />

        <div
          className={`border-b border-slate-700/30 relative z-10 ${isCollapsed ? "p-2" : "p-4 space-y-2"}`}
        >
          <button
            type="button"
            onClick={onNew}
            className={`btn-neon cursor-pointer text-white font-medium transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900/90
              ${isCollapsed ? "w-10 h-10 rounded-lg flex items-center justify-center text-lg" : "w-full rounded-lg py-2.5 px-4 flex items-center justify-center gap-2"}`}
            title="New conversation"
          >
            <span>+</span>
            {!isCollapsed && <span>New Conversation</span>}
          </button>
          {isCollapsed && (
            <button
              type="button"
              onClick={openCreateFolderEditor}
              className="w-10 h-8 mx-auto rounded-lg border border-slate-600/80 text-slate-300 hover:bg-slate-700/50 hover:text-white transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
              title="Create folder"
              aria-label="Create folder"
            >
              📁
            </button>
          )}
          {!isCollapsed && healthIssues > 0 && (
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => onHealthClick?.()}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs hover:bg-amber-500/20 transition-colors cursor-pointer text-left"
                aria-label={healthSummaryText}
                title={healthSummaryText}
              >
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold shrink-0">
                  {healthIssues}
                </span>
                <span className="truncate min-w-0">
                  {healthIssues === 1
                    ? "1 project gap"
                    : `${healthIssues} project gaps`}
                </span>
              </button>
              {healthSummaryText ? (
                <p className="text-[10px] text-amber-200/80 leading-snug px-1 line-clamp-4">
                  {healthSummaryText}
                </p>
              ) : null}
            </div>
          )}
          {isCollapsed && healthIssues > 0 && (
            <div className="relative w-10 mx-auto group/tooltip">
              <button
                type="button"
                onClick={() => onHealthClick?.()}
                className="w-10 h-6 flex items-center justify-center rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold cursor-pointer"
                aria-label={healthSummaryText}
                title={healthSummaryText}
              >
                {healthIssues}
              </button>
              {healthSummaryText ? (
                <div
                  role="tooltip"
                  className="absolute left-full top-1/2 z-[60] ml-2 w-max max-w-[min(90vw,14rem)] -translate-y-1/2 rounded-md border border-slate-600/80 bg-slate-800/95 px-2 py-1.5 text-left text-[10px] leading-snug text-slate-200 shadow-lg opacity-0 pointer-events-none transition-opacity delay-100 group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100"
                >
                  {healthSummaryText}
                </div>
              ) : null}
            </div>
          )}
          {!isCollapsed && (
            <>
              <label htmlFor="sidebar-search" className="sr-only">
                Search conversations
              </label>
              <input
                id="sidebar-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search chats..."
                className="w-full input-glow text-slate-200 text-sm rounded-lg px-3 py-2 placeholder-slate-500 transition-shadow duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50"
              />
            </>
          )}
        </div>

        {!isCollapsed && (
          <div className="px-4 pt-2 pb-1 flex items-center gap-2 relative z-10">
            <button
              type="button"
              onClick={onToggleArchived}
              className={`cursor-pointer text-xs px-2.5 py-1 rounded-lg transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 ${
                showArchived
                  ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                  : "text-slate-500 hover:text-slate-300 hover:bg-slate-700/50"
              }`}
            >
              {showArchived ? "📦 Archived" : "💬 Active"}
            </button>
            <span className="text-xs text-slate-600">
              {filtered.length} chat{filtered.length !== 1 ? "s" : ""}
            </span>
            <button
              type="button"
              onClick={openCreateFolderEditor}
              className="cursor-pointer text-xs px-2 py-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
              title="Create folder"
            >
              + Folder
            </button>
            <button
              type="button"
              onClick={() =>
                multiSelectMode ? exitMultiSelect() : setMultiSelect(true)
              }
              className={`ml-auto cursor-pointer text-xs px-2 py-1 rounded-lg transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 ${
                multiSelectMode
                  ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                  : "text-slate-500 hover:text-slate-300 hover:bg-slate-700/50"
              }`}
              title={multiSelectMode ? "Cancel selection" : "Select multiple"}
            >
              {multiSelectMode ? "✕ Cancel" : "☐ Select"}
            </button>
          </div>
        )}
        {showCreateFolderEditor && (
          <div
            className={`${isCollapsed ? "absolute left-full top-2 ml-2 w-52" : "mx-3 mb-2"} z-20 glass rounded-lg border border-slate-600/70 p-2 space-y-2`}
          >
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitCreateFolder();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setShowCreateFolderEditor(false);
                }
              }}
              placeholder="Folder name"
              className="w-full input-glow text-slate-200 text-xs rounded-md px-2 py-1.5 placeholder-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
              autoFocus
            />
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={submitCreateFolder}
                className="text-xs px-2 py-1 rounded-md bg-indigo-600/30 text-indigo-200 hover:bg-indigo-600/45 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setShowCreateFolderEditor(false)}
                className="text-xs px-2 py-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {multiSelectMode && (
          <div className="px-3 py-2 border-b border-slate-700/30 relative z-10 flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-indigo-300 font-medium mr-1">
              {selectedIds.size} selected
            </span>
            <button
              type="button"
              onClick={toggleSelectAll}
              className="cursor-pointer text-xs px-2 py-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50"
            >
              {filtered.length > 0 &&
              filtered.every((h) => selectedIds.has(h.id))
                ? "Deselect All"
                : "Select All"}
            </button>
            <div className="flex-1" />
            {selectedIds.size > 0 && (
              <>
                <select
                  value={bulkMoveFolderId}
                  onChange={(e) => setBulkMoveFolderId(e.target.value)}
                  className="text-xs bg-slate-800 border border-slate-600 rounded-md px-2 py-1 text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
                  aria-label="Move selected conversations to folder"
                >
                  {orderedFolders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => handleBulkAction(onBulkMove, bulkMoveFolderId)}
                  className="cursor-pointer text-xs px-2 py-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50"
                  title="Move selected"
                >
                  📁 Move
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkAction(onBulkExport, "md")}
                  className="cursor-pointer text-xs px-2 py-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50"
                  title="Export as Markdown"
                >
                  📥 MD
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkAction(onBulkExport, "txt")}
                  className="cursor-pointer text-xs px-2 py-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50"
                  title="Export as Text"
                >
                  📄 TXT
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleBulkAction(onBulkArchive, showArchived ? false : true)
                  }
                  className="cursor-pointer text-xs px-2 py-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50"
                  title={showArchived ? "Unarchive" : "Archive"}
                >
                  {showArchived ? "📂" : "📦"}
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkAction(onBulkDelete)}
                  className="cursor-pointer text-xs px-2 py-1 rounded-md text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50"
                  title="Delete selected"
                >
                  🗑️
                </button>
              </>
            )}
          </div>
        )}

        <div
          className={`flex-1 overflow-y-auto scrollbar-thin relative z-10 ${isCollapsed ? "p-1" : "p-2"}`}
        >
          {filtered.length === 0 && !isCollapsed && (
            <p className="text-center text-slate-400 text-sm py-8">
              {search
                ? "No matches yet — try different words!"
                : showArchived
                  ? "Nothing archived yet. Right-click any chat to tuck it away."
                  : "No conversations yet — let's start one!"}
            </p>
          )}
          {filtered.length === 0 && isCollapsed && (
            <p className="text-center text-slate-500 text-xs py-4 px-1">
              No chats
            </p>
          )}
          {(isCollapsed
            ? [{ folder: null, items: filtered }]
            : groupedConversations
          ).map((group) => {
            const folder = group.folder;
            const items = group.items;
            const folderCollapsed = !!folder?.collapsed;
            return (
              <div key={folder ? folder.id : "flat-list"} className="mb-1">
                {!isCollapsed && folder && (
                  <div className="flex items-center gap-1 px-2 py-1">
                    <button
                      type="button"
                      onClick={() =>
                        onToggleFolderCollapsed?.(folder.id, !folderCollapsed)
                      }
                      className="text-slate-400 hover:text-slate-200 text-xs px-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
                      aria-label={
                        folderCollapsed
                          ? `Expand ${folder.name}`
                          : `Collapse ${folder.name}`
                      }
                    >
                      {folderCollapsed ? "▸" : "▾"}
                    </button>
                    <span className="text-xs text-slate-400 truncate">
                      {folder.name}
                    </span>
                    <span className="text-[10px] text-slate-600">
                      {items.length}
                    </span>
                    {!folder.system && (
                      <>
                        <button
                          type="button"
                          onClick={() => promptRenameFolder(folder)}
                          className="ml-auto text-[10px] text-slate-500 hover:text-slate-300 px-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
                          title="Rename folder"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Delete folder "${folder.name}"? Conversations will move to Inbox.`,
                              )
                            ) {
                              onDeleteFolder?.(folder.id);
                            }
                          }}
                          className="text-[10px] text-slate-500 hover:text-red-300 px-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60"
                          title="Delete folder"
                        >
                          🗑
                        </button>
                      </>
                    )}
                  </div>
                )}
                {folderCollapsed && !isCollapsed
                  ? null
                  : items.map((h) => {
                      const modeIcon =
                        modes?.find((m) => m.id === h.mode)?.icon || "💬";
                      const isSelected = selectedIds.has(h.id);
                      const rowLabel = `${h.title || "Untitled"}${h.mode ? `, ${h.mode}` : ""}`;
                      return (
                        <div
                          key={h.id}
                          role="button"
                          tabIndex={0}
                          aria-label={isCollapsed ? rowLabel : undefined}
                          aria-current={
                            activeId === h.id && !multiSelectMode
                              ? "true"
                              : undefined
                          }
                          className={`group flex items-center rounded-lg cursor-pointer transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/55 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900/80
                  ${isCollapsed ? "justify-center p-2 mb-1" : "gap-2 px-3 py-2.5 mb-1"}
                  ${
                    isSelected && multiSelectMode
                      ? "bg-indigo-600/20 border border-indigo-500/30"
                      : activeId === h.id
                        ? "bg-indigo-600/20 border border-indigo-500/30 neon-glow-sm"
                        : "hover:bg-indigo-500/10"
                  }`}
                          onClick={() => {
                            if (multiSelectMode) {
                              toggleSelect(h.id);
                            } else {
                              onSelect(h.id);
                              onClose();
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              if (multiSelectMode) toggleSelect(h.id);
                              else {
                                onSelect(h.id);
                                onClose();
                              }
                            }
                          }}
                          onContextMenu={(e) => handleContextMenu(e, h)}
                          title={
                            isCollapsed ? h.title || "Untitled" : undefined
                          }
                        >
                          {isCollapsed ? (
                            <span
                              className="text-base leading-none"
                              role="img"
                              aria-hidden="true"
                            >
                              {modeIcon}
                            </span>
                          ) : (
                            <>
                              {multiSelectMode && (
                                <span
                                  className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors text-xs ${
                                    isSelected
                                      ? "bg-indigo-500 border-indigo-400 text-white"
                                      : "border-slate-500 text-transparent hover:border-slate-400"
                                  }`}
                                >
                                  ✓
                                </span>
                              )}
                              <span className="text-sm shrink-0">
                                {modeIcon}
                              </span>
                              {h.overallGrade && (
                                <span
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                                    h.overallGrade === "A"
                                      ? "bg-emerald-500/20 text-emerald-400"
                                      : h.overallGrade === "B"
                                        ? "bg-lime-500/20 text-lime-400"
                                        : h.overallGrade === "C"
                                          ? "bg-yellow-500/20 text-yellow-400"
                                          : h.overallGrade === "D"
                                            ? "bg-orange-500/20 text-orange-400"
                                            : "bg-red-500/20 text-red-400"
                                  }`}
                                >
                                  {h.overallGrade}
                                </span>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="text-sm text-slate-200 truncate">
                                  {h.title || "Untitled"}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {h.model && (
                                    <span className="text-indigo-400">
                                      {h.model.split(":")[0]}
                                    </span>
                                  )}
                                  {h.model && " · "}
                                  {formatConversationDate(h.createdAt)}
                                </div>
                              </div>
                              {!multiSelectMode && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleContextMenu(e, h);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 text-slate-500 hover:text-slate-300 text-xs transition-opacity px-1 rounded cursor-pointer focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
                                  aria-label="More options"
                                >
                                  ⋯
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
              </div>
            );
          })}
        </div>
      </nav>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
}
