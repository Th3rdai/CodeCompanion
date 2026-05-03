import { useState, useEffect, useRef } from "react";
import { Braces, Code2, Wind } from "lucide-react";
import { apiFetch } from "../lib/api-fetch";
import { convertDocument } from "../lib/document-processor";

// Persist folder expand/collapse state in localStorage (survives refresh)
const TREE_STATE_KEY = "cc_file_tree_state";

function getTreeState() {
  try {
    return JSON.parse(localStorage.getItem(TREE_STATE_KEY) || "{}");
  } catch {
    return {};
  }
}

function setTreeState(path, isOpen) {
  const state = getTreeState();
  if (isOpen) {
    state[path] = true;
  } else {
    delete state[path];
  }
  try {
    localStorage.setItem(TREE_STATE_KEY, JSON.stringify(state));
  } catch {}
}

function FileTreeNode({
  node,
  depth,
  onFileClick,
  onQuickAttach,
  onEnterFolder,
  converting,
  rootFolder,
}) {
  const savedState = getTreeState();
  // Only root (depth 0) starts expanded; everything else collapsed unless user previously expanded it
  const [open, setOpen] = useState(
    node.path ? savedState[node.path] === true : depth === 0,
  );
  const [children, setChildren] = useState(node.children);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const indent = depth * 16;

  // Sync children when node prop changes (e.g. tree refresh)
  useEffect(() => {
    setChildren(node.children);
  }, [node.children]);

  const toggleOpen = async () => {
    const next = !open;
    setOpen(next);
    if (node.path) setTreeState(node.path, next);
    // Lazy-load children for truncated directories
    if (
      next &&
      node.truncated &&
      (!children || children.length === 0) &&
      rootFolder
    ) {
      setLoadingChildren(true);
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 15000);
      try {
        const fullPath = rootFolder + "/" + node.path;
        const res = await apiFetch(
          `/api/files/tree?depth=3&folder=${encodeURIComponent(fullPath)}`,
          { signal: ac.signal },
        );
        const data = await res.json();
        if (res.ok && data.tree) {
          setChildren(data.tree);
        }
      } catch {}
      clearTimeout(timer);
      setLoadingChildren(false);
    }
  };

  if (node.type === "dir") {
    return (
      <div
        role="treeitem"
        aria-expanded={open}
        aria-label={`Folder: ${node.name}`}
      >
        <button
          type="button"
          title="Click to expand — double-click to open this folder as the File Browser root"
          className="w-full flex items-center gap-1 py-1.5 px-2 hover:bg-indigo-500/10 rounded cursor-pointer text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-colors"
          style={{ paddingLeft: indent }}
          onClick={toggleOpen}
          onDoubleClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (onEnterFolder && node.path && rootFolder) {
              const base = rootFolder.replace(/\/+$/, "");
              onEnterFolder(`${base}/${node.path}`);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" && !open) toggleOpen();
            if (e.key === "ArrowLeft" && open) toggleOpen();
          }}
        >
          <span className="text-xs text-slate-400" aria-hidden="true">
            {loadingChildren ? "⟳" : open ? "▾" : "▸"}
          </span>
          <span className="text-amber-400 text-xs" aria-hidden="true">
            📁
          </span>
          <span className="truncate">{node.name}</span>
        </button>
        {open && (
          <div role="group">
            {loadingChildren && (
              <div
                style={{ paddingLeft: indent + 16 }}
                className="text-xs text-slate-500 py-1 px-2 animate-pulse"
              >
                Loading...
              </div>
            )}
            {children?.map((child, i) => (
              <FileTreeNode
                key={child.path || i}
                node={child}
                depth={depth + 1}
                onFileClick={onFileClick}
                onQuickAttach={onQuickAttach}
                onEnterFolder={onEnterFolder}
                converting={converting}
                rootFolder={rootFolder}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const extColors = {
    js: "text-yellow-400",
    jsx: "text-cyan-400",
    ts: "text-blue-400",
    tsx: "text-blue-300",
    py: "text-green-400",
    json: "text-amber-300",
    md: "text-slate-300",
    css: "text-pink-400",
    html: "text-orange-400",
    sh: "text-green-300",
  };
  const extColor = extColors[node.ext] || "text-slate-400";

  return (
    <div
      role="treeitem"
      className="group flex items-center hover:bg-indigo-500/10 rounded transition-colors"
      style={{ paddingLeft: indent }}
    >
      <button
        className="flex-1 flex items-center gap-1.5 py-1.5 px-2 cursor-pointer text-sm focus:outline-none"
        onClick={() => onFileClick(node)}
        aria-label={`File: ${node.name}`}
      >
        <span
          className={`text-xs ${node.convertible ? "text-amber-400" : extColor}`}
          aria-hidden="true"
        >
          {node.convertible ? "📑" : "📄"}
        </span>
        <span className="truncate text-slate-300 group-hover:text-white">
          {node.name}
        </span>
        {converting === node.path && (
          <span
            className="text-[10px] text-indigo-300 animate-spin ml-1"
            aria-label="Converting"
          >
            &#x27F3;
          </span>
        )}
        {node.size > 0 && (
          <span className="text-[10px] text-slate-500 ml-auto pr-1">
            {(node.size / 1024).toFixed(0)}k
          </span>
        )}
      </button>
      {onQuickAttach && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onQuickAttach(node);
          }}
          className="opacity-70 group-hover:opacity-100 shrink-0 px-1.5 py-1 mr-1 text-[10px] text-indigo-300 hover:text-white hover:bg-indigo-500/30 rounded transition-all"
          title="Attach to chat"
          aria-label={`Attach ${node.name} to chat`}
        >
          +AI
        </button>
      )}
    </div>
  );
}

// Build a readable text tree for "Share with AI"
function buildTreeText(nodes, prefix = "") {
  let out = "";
  nodes?.forEach((node, i) => {
    const isLast = i === nodes.length - 1;
    const connector = isLast ? "└── " : "├── ";
    const childPrefix = isLast ? "    " : "│   ";
    out +=
      prefix + connector + node.name + (node.type === "dir" ? "/" : "") + "\n";
    if (node.type === "dir" && node.children?.length) {
      out += buildTreeText(node.children, prefix + childPrefix);
    }
  });
  return out;
}

export default function FileBrowser({
  projectFolder,
  onAttachFile,
  onClose,
  onClearFolder,
  onSetFolder,
  attachLabel,
  onToast,
}) {
  const TREE_REQUEST_TIMEOUT_MS = 20000;
  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [_loadingFile, setLoadingFile] = useState(false);
  const [folderInput, setFolderInput] = useState("");
  const [launchingClaude, setLaunchingClaude] = useState(false);
  const [launchingCursor, setLaunchingCursor] = useState(false);
  const [launchingWindsurf, setLaunchingWindsurf] = useState(false);
  const [launchingOpenCode, setLaunchingOpenCode] = useState(false);
  const [launchingVSCode, setLaunchingVSCode] = useState(false);
  const [launchError, setLaunchError] = useState(null);
  const [folderError, setFolderError] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [dropping, setDropping] = useState(null); // { total, done }
  const [converting, setConverting] = useState(null); // path being converted
  const dragCounter = useRef(0);

  const folderPath = tree?.root || projectFolder;

  async function fetchTreeJson(targetPath) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), TREE_REQUEST_TIMEOUT_MS);
    try {
      const res = await apiFetch(
        `/api/files/tree?depth=3&folder=${encodeURIComponent(targetPath)}`,
        { signal: ac.signal },
      );
      const data = await res.json();
      return { res, data };
    } finally {
      clearTimeout(timer);
    }
  }

  async function launchIDE(endpoint, name, setLoading) {
    if (!folderPath) {
      setLaunchError("No project folder set. Browse to a folder first.");
      return;
    }
    setLaunchError(null);
    setLoading(true);
    try {
      const res = await apiFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectPath: folderPath }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setLaunchError(data.error || `Failed to open ${name}`);
      }
    } catch (err) {
      setLaunchError(`Could not reach server to open ${name}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (projectFolder) loadTree(projectFolder);
    // Clear tree expand state when folder changes
    try {
      localStorage.removeItem(TREE_STATE_KEY);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectFolder]);

  function handleEnterFolder(absPath) {
    if (!absPath || !onSetFolder) return;
    onSetFolder(absPath);
  }

  async function loadTree(folder) {
    const target = folder || projectFolder;
    if (!target) return;
    setLoading(true);
    setTree(null);
    setFolderError(null);
    try {
      const { res, data } = await fetchTreeJson(target);
      if (!res.ok) {
        setFolderError(data.error || "Could not load folder");
        setTree(null);
      } else {
        setTree(data);
        setFolderError(null);
        // Server resolved the path — sync it back
        if (data.root && data.root !== target && onSetFolder) {
          onSetFolder(data.root);
        }
      }
    } catch (err) {
      setFolderError(
        err?.name === "AbortError"
          ? "Loading folder timed out. Try a smaller folder."
          : "Could not reach server",
      );
      setTree(null);
    }
    setLoading(false);
  }

  async function handleFileClick(node) {
    // Handle convertible documents (PDF, PPTX, etc.)
    if (node.convertible) {
      setConverting(node.path);
      try {
        const folderParam = tree?.root
          ? `&folder=${encodeURIComponent(tree.root)}`
          : "";
        const rawRes = await apiFetch(
          `/api/files/read-raw?path=${encodeURIComponent(node.path)}${folderParam}`,
        );
        if (!rawRes.ok) throw new Error("Failed to read file");
        const blob = await rawRes.blob();
        const file = new File([blob], node.name);
        const result = await convertDocument(file);
        setPreview({
          path: node.path,
          name: node.name,
          content: result.markdown,
          lines: result.markdown.split("\n").length,
          size: result.markdownSize,
          converted: true,
          truncated: result.truncated,
        });
      } catch (err) {
        console.error("Document conversion failed:", err);
        setPreview({
          path: node.path,
          name: node.name,
          content: `Error converting ${node.name}: ${err.message}\n\nEnsure docling-serve is running. See Settings → General.`,
          lines: 3,
          size: 0,
          error: true,
        });
      } finally {
        setConverting(null);
      }
      return;
    }

    setLoadingFile(true);
    try {
      const folderParam = tree?.root
        ? `&folder=${encodeURIComponent(tree.root)}`
        : "";
      const res = await apiFetch(
        `/api/files/read?path=${encodeURIComponent(node.path)}${folderParam}`,
      );
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.error || `Could not read file (${res.status})`;
        if (onToast) onToast(msg);
        else console.error("File preview failed:", msg);
      } else {
        setPreview(data);
      }
    } catch (err) {
      const msg = err?.message || "Could not reach server to read file";
      if (onToast) onToast(msg);
      else console.error("File preview failed:", err);
    }
    setLoadingFile(false);
  }

  function handleAttach() {
    if (preview) {
      onAttachFile({
        name: preview.name,
        path: preview.path,
        content: preview.content,
        lines: preview.lines,
      });
      setPreview(null);
    }
  }

  async function handleQuickAttach(node) {
    // Handle convertible documents (PDF, PPTX, etc.)
    if (node.convertible) {
      setConverting(node.path);
      try {
        const folderParam = tree?.root
          ? `&folder=${encodeURIComponent(tree.root)}`
          : "";
        const rawRes = await apiFetch(
          `/api/files/read-raw?path=${encodeURIComponent(node.path)}${folderParam}`,
        );
        if (!rawRes.ok) throw new Error("Failed to read file");
        const blob = await rawRes.blob();
        const file = new File([blob], node.name);
        const result = await convertDocument(file);
        onAttachFile({
          name: `${node.name} (converted)`,
          content: result.markdown,
          lines: result.markdown.split("\n").length,
          size: result.markdownSize,
          convertedFrom: node.name,
          truncated: result.truncated,
        });
      } catch (err) {
        console.error("Quick attach conversion failed:", err);
      } finally {
        setConverting(null);
      }
      return;
    }

    try {
      const folderParam = tree?.root
        ? `&folder=${encodeURIComponent(tree.root)}`
        : "";
      const res = await apiFetch(
        `/api/files/read?path=${encodeURIComponent(node.path)}${folderParam}`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.content === undefined) {
        const msg = data?.error || `Could not attach file (${res.status})`;
        if (onToast) onToast(msg);
        else console.error("Quick attach failed:", msg);
        return;
      }
      onAttachFile({
        name: data.name,
        path: data.path,
        content: data.content,
        lines: data.lines,
      });
    } catch (err) {
      const msg = err?.message || "Could not reach server to attach file";
      if (onToast) onToast(msg);
      else console.error("Quick attach failed:", err);
    }
  }

  function handleShareStructure() {
    if (!tree) return;
    const text = `Project: ${tree.root}\n\n${buildTreeText(tree.tree)}`;
    onAttachFile({
      name: "Project Structure",
      path: tree.root,
      content: text,
      lines: text.split("\n").length,
    });
  }

  function handleDragEnter(e) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    setDragging(true);
  }
  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setDragging(false);
  }
  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function isDroppedFolder(e) {
    const items = Array.from(e.dataTransfer.items || []);
    if (items.length === 1 && items[0].webkitGetAsEntry) {
      const entry = items[0].webkitGetAsEntry();
      if (entry && entry.isDirectory) return true;
    }
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 1 && files[0].size === 0 && files[0].type === "")
      return true;
    return false;
  }

  async function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    // Folder dropped — try to open it as the project folder
    if (isDroppedFolder(e)) {
      // Electron: File objects have .path with absolute filesystem path
      if (files[0].path) {
        setDropping({ total: 1, done: 0, message: "Opening folder..." });
        try {
          const { res, data } = await fetchTreeJson(files[0].path);
          if (res.ok && data.tree && onSetFolder) {
            onSetFolder(files[0].path);
            setDropping({ total: 1, done: 1, message: "Folder loaded!" });
            setTimeout(() => setDropping(null), 1200);
            return;
          }
        } catch {}
        setDropping(null);
      }
      // Browser: no absolute path available — try the folder name, server will search for it
      setDropping({ total: 1, done: 0, message: "Opening folder..." });
      if (onSetFolder) onSetFolder(files[0].name);
      setDropping({ total: 1, done: 1, message: "Folder loaded!" });
      setTimeout(() => setDropping(null), 1200);
      return;
    }

    // Regular file drops — attach to chat
    let done = 0;
    setDropping({ total: files.length, done: 0 });
    files.forEach((file) => {
      if (file.size === 0 && file.type === "") {
        done++;
        return;
      } // skip dirs
      const reader = new FileReader();
      reader.onload = (ev) => {
        onAttachFile({
          name: file.name,
          content: ev.target.result,
          lines: ev.target.result.split("\n").length,
        });
        done++;
        setDropping({ total: files.length, done });
        if (done === files.length) setTimeout(() => setDropping(null), 1200);
      };
      reader.onerror = () => {
        done++;
        if (done === files.length) setTimeout(() => setDropping(null), 1200);
      };
      reader.readAsText(file);
    });
  }

  return (
    <div
      className="w-80 glass-heavy border-l border-slate-700/30 flex flex-col h-full relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {dragging && (
        <div className="absolute inset-0 z-50 bg-indigo-900/80 backdrop-blur-sm border-2 border-dashed border-indigo-400 rounded-lg flex flex-col items-center justify-center gap-2 pointer-events-none">
          <span className="text-3xl">📂</span>
          <span className="text-sm text-indigo-200 font-medium">
            Drop files or a folder
          </span>
        </div>
      )}

      {dropping && (
        <div className="absolute inset-0 z-50 bg-slate-900/90 backdrop-blur-sm flex flex-col items-center justify-center gap-3 pointer-events-none">
          <span className="text-2xl">
            {dropping.done === dropping.total ? "✅" : "📂"}
          </span>
          <span className="text-sm text-indigo-200 font-medium">
            {dropping.message
              ? dropping.message
              : dropping.done === dropping.total
                ? `${dropping.total} file${dropping.total !== 1 ? "s" : ""} attached!`
                : `Reading ${dropping.done + 1} of ${dropping.total}...`}
          </span>
          {dropping.total > 1 && (
            <div className="w-40 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                style={{ width: `${(dropping.done / dropping.total) * 100}%` }}
              />
            </div>
          )}
        </div>
      )}

      <div className="p-3 border-b border-slate-700/30 flex items-center gap-2">
        <span className="text-sm font-medium text-slate-200 flex-1">
          📂 File Browser
        </span>
        {tree && onAttachFile && (
          <button
            onClick={handleShareStructure}
            className="text-[10px] px-2 py-1 rounded bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/30 transition-colors whitespace-nowrap"
            title="Attach folder structure to chat so the AI knows what files exist"
          >
            Share with AI
          </button>
        )}
        <button
          onClick={() => loadTree()}
          className="text-slate-400 hover:text-indigo-300 text-sm transition-colors"
          title="Refresh"
          aria-label="Refresh file tree"
        >
          &#x27F3;
        </button>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white text-sm transition-colors"
          title="Close"
          aria-label="Close file browser"
        >
          ✕
        </button>
      </div>

      {projectFolder && (
        <div className="px-3 py-2 border-b border-slate-700/30 flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() =>
                launchIDE("/api/launch-vscode", "VS Code", setLaunchingVSCode)
              }
              disabled={launchingVSCode || !folderPath}
              className="flex-1 min-w-[calc(50%-0.25rem)] text-xs px-2 py-1.5 rounded-lg bg-blue-500/20 text-blue-200 hover:bg-blue-500/30 border border-blue-500/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <Code2 className="w-4 h-4 shrink-0 opacity-90" aria-hidden />
              {launchingVSCode ? "Opening..." : "VS Code"}
            </button>
            <button
              onClick={() =>
                launchIDE("/api/launch-cursor", "Cursor", setLaunchingCursor)
              }
              disabled={launchingCursor || !folderPath}
              className="flex-1 min-w-[calc(50%-0.25rem)] text-xs px-2 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30 border border-emerald-500/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <img
                src="/ide-logos/cursor.jpeg"
                alt=""
                className="w-4 h-4 rounded-sm"
              />
              {launchingCursor ? "Opening..." : "Cursor"}
            </button>
            <button
              onClick={() =>
                launchIDE(
                  "/api/launch-windsurf",
                  "Windsurf",
                  setLaunchingWindsurf,
                )
              }
              disabled={launchingWindsurf || !folderPath}
              className="flex-1 min-w-[calc(50%-0.25rem)] text-xs px-2 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-200 hover:bg-cyan-500/30 border border-cyan-500/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <Wind className="w-4 h-4 shrink-0 opacity-90" aria-hidden />
              {launchingWindsurf ? "Opening..." : "Windsurf"}
            </button>
            <button
              onClick={() =>
                launchIDE(
                  "/api/launch-opencode",
                  "OpenCode",
                  setLaunchingOpenCode,
                )
              }
              disabled={launchingOpenCode || !folderPath}
              className="flex-1 min-w-[calc(50%-0.25rem)] text-xs px-2 py-1.5 rounded-lg bg-orange-500/20 text-orange-200 hover:bg-orange-500/30 border border-orange-500/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <Braces className="w-4 h-4 shrink-0 opacity-90" aria-hidden />
              {launchingOpenCode ? "Opening..." : "OpenCode"}
            </button>
          </div>
          <button
            onClick={() =>
              launchIDE(
                "/api/launch-claude-code",
                "Claude Code",
                setLaunchingClaude,
              )
            }
            disabled={launchingClaude || !folderPath}
            className="w-full text-sm font-medium px-3 py-2.5 rounded-lg bg-indigo-500/25 text-indigo-100 hover:bg-indigo-500/40 border border-indigo-400/40 shadow-sm shadow-indigo-900/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <img
              src="/ide-logos/claude.jpg"
              alt=""
              className="w-5 h-5 rounded-full"
            />
            {launchingClaude ? "Opening..." : "Claude Code"}
          </button>
        </div>
      )}

      {launchError && (
        <div className="mx-3 mt-2 px-3 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-200 text-xs flex items-start gap-2">
          <span className="flex-1">{launchError}</span>
          <button
            onClick={() => setLaunchError(null)}
            className="text-red-300 hover:text-white shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {/* Folder picker — shown when no project folder is set OR as a compact bar when one is set */}
      {!projectFolder ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="space-y-3 w-full max-w-[260px]">
            <p className="text-sm text-slate-400 text-center">
              Enter a folder path to browse
            </p>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={folderInput}
                onChange={(e) => setFolderInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && folderInput.trim() && onSetFolder)
                    onSetFolder(folderInput.trim());
                }}
                placeholder="/path/to/project"
                className="flex-1 input-glow text-slate-200 text-xs rounded-lg px-3 py-2 placeholder-slate-500 font-mono"
              />
              <button
                onClick={async () => {
                  if (window.electronAPI?.pickFolder) {
                    const folder = await window.electronAPI.pickFolder();
                    if (folder && onSetFolder) {
                      setFolderInput(folder);
                      onSetFolder(folder);
                    }
                  } else {
                    // Web fallback: trigger hidden directory input
                    const input = document.createElement("input");
                    input.type = "file";
                    input.webkitdirectory = true;
                    input.onchange = () => {
                      const file = input.files?.[0];
                      if (file?.webkitRelativePath) {
                        const folderName =
                          file.webkitRelativePath.split("/")[0];
                        if (folderName && onSetFolder) {
                          setFolderInput(folderName);
                          onSetFolder(folderName);
                        }
                      }
                    };
                    input.click();
                  }
                }}
                className="text-xs px-2.5 py-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 border border-slate-600/30 transition-colors shrink-0"
                title="Browse for folder"
              >
                📂
              </button>
            </div>
            <button
              onClick={() => {
                if (folderInput.trim() && onSetFolder)
                  onSetFolder(folderInput.trim());
              }}
              disabled={!folderInput.trim()}
              className="w-full text-xs px-3 py-2 rounded-lg bg-indigo-500/20 text-indigo-200 hover:bg-indigo-500/30 border border-indigo-500/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Open Folder
            </button>
            <p className="text-[10px] text-slate-500 text-center">
              Or drag a folder here, set in Settings, or create a project
            </p>
          </div>
        </div>
      ) : (
        <div className="px-3 py-2 border-b border-slate-700/30">
          <div className="flex gap-1.5 items-center">
            <input
              type="text"
              value={folderInput || folderPath || ""}
              onChange={(e) => setFolderInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && folderInput.trim() && onSetFolder) {
                  onSetFolder(folderInput.trim());
                  setFolderInput("");
                }
              }}
              placeholder="Change project folder…"
              className="flex-1 input-glow text-slate-300 text-[11px] rounded-lg px-2.5 py-1.5 placeholder-slate-500 font-mono"
            />
            <button
              onClick={async () => {
                if (window.electronAPI?.pickFolder) {
                  const folder = await window.electronAPI.pickFolder();
                  if (folder && onSetFolder) {
                    setFolderInput("");
                    onSetFolder(folder);
                  }
                } else {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.webkitdirectory = true;
                  input.onchange = () => {
                    const file = input.files?.[0];
                    if (file?.webkitRelativePath) {
                      const folderName = file.webkitRelativePath.split("/")[0];
                      if (folderName && onSetFolder) {
                        setFolderInput("");
                        onSetFolder(folderName);
                      }
                    }
                  };
                  input.click();
                }
              }}
              className="text-xs px-2 py-1.5 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 border border-slate-600/30 transition-colors shrink-0"
              title="Browse for folder"
            >
              📂
            </button>
            {folderInput.trim() && folderInput !== folderPath && (
              <button
                onClick={() => {
                  if (onSetFolder) {
                    onSetFolder(folderInput.trim());
                    setFolderInput("");
                  }
                }}
                className="text-xs px-2 py-1.5 rounded-lg bg-indigo-500/30 text-indigo-200 hover:bg-indigo-500/40 border border-indigo-500/30 transition-colors shrink-0"
              >
                Go
              </button>
            )}
          </div>
        </div>
      )}

      {folderError && (
        <div className="mx-3 mt-2 px-3 py-2 rounded-lg bg-red-500/20 border border-red-500/30 text-red-200 text-xs flex items-start gap-2">
          <span className="flex-1">
            {folderError}. Use a full path like{" "}
            <span className="font-mono text-red-300">
              /home/yourname/my-project
            </span>
          </span>
          <button
            onClick={() => setFolderError(null)}
            className="text-red-300 hover:text-white shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {projectFolder && loading && (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-slate-400 text-sm">Loading...</span>
        </div>
      )}

      {projectFolder && tree && !preview && (
        <div className="flex-1 overflow-y-auto scrollbar-thin p-1">
          <div className="px-3 py-2.5 mb-2 flex items-center gap-2 bg-gradient-to-r from-indigo-600/20 to-purple-600/20 rounded-lg border-2 border-indigo-500/40 shadow-lg">
            <span className="text-sm text-indigo-300 shrink-0 font-bold">
              📁
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[9px] text-indigo-300/60 font-medium mb-0.5">
                PROJECT FOLDER
              </div>
              <div className="text-sm text-white truncate font-mono font-semibold">
                {tree.root}
              </div>
            </div>
            {onClearFolder && (
              <button
                onClick={() => {
                  onClearFolder();
                  setTree(null);
                }}
                className="text-sm text-indigo-300 hover:text-red-300 shrink-0 transition-colors px-2 py-1 hover:bg-red-500/10 rounded"
                title="Clear folder"
              >
                ✕
              </button>
            )}
          </div>
          <div role="tree" aria-label="Project files">
            {tree.tree?.map((node, i) => (
              <FileTreeNode
                key={node.path || i}
                node={node}
                depth={0}
                onFileClick={handleFileClick}
                onQuickAttach={onAttachFile ? handleQuickAttach : null}
                onEnterFolder={handleEnterFolder}
                converting={converting}
                rootFolder={tree.root}
              />
            ))}
          </div>
          {tree.tree?.length === 0 && (
            <div className="text-center py-6 px-4 space-y-2">
              <p className="text-sm text-slate-400">
                No supported files found in this folder.
              </p>
              <p className="text-xs text-slate-500">
                The folder may be empty, or contain only images/binaries.
                Supported: .js .ts .py .md .json .html .css and more.
              </p>
              <p className="text-xs text-indigo-400 mt-1">
                Try a different folder or check Settings → Project folder.
              </p>
            </div>
          )}
        </div>
      )}

      {preview && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-700/30 flex items-center gap-2">
            <button
              onClick={() => setPreview(null)}
              className="text-slate-400 hover:text-indigo-300 text-xs transition-colors"
            >
              ← Back
            </button>
            <span className="text-sm text-slate-200 truncate flex-1">
              {preview.name}
            </span>
            <span className="text-[10px] text-slate-500">
              {preview.lines} lines
            </span>
          </div>
          <div className="flex-1 overflow-auto p-3">
            <pre className="font-mono text-xs text-slate-300 whitespace-pre-wrap">
              {preview.content}
            </pre>
          </div>
          <div className="p-2 border-t border-slate-700/30">
            <button
              onClick={handleAttach}
              className="w-full btn-neon text-white text-sm rounded-lg py-2.5 font-medium"
            >
              {attachLabel || "+ Attach to Chat"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
