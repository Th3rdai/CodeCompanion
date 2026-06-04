import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

export default function TerminalPanel({ projectFolder }) {
  const containerRef = useRef(null);
  const isElectron = Boolean(window.electronAPI?.terminal);

  useEffect(() => {
    if (!isElectron) return;

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: "JetBrains Mono, Fira Code, Menlo, monospace",
      fontSize: 13,
      theme: {
        background: "#0f172a",
        foreground: "#e2e8f0",
        cursor: "#a78bfa",
        selectionBackground: "#4f46e5",
      },
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    const api = window.electronAPI.terminal;
    api.start(projectFolder || undefined);
    // data arrives as a binary string from atob() in preload — convert to
    // Uint8Array so xterm.js treats it as raw UTF-8 bytes, not Unicode code points.
    // Without this, multi-byte sequences (box-drawing chars, etc.) are garbled.
    api.onData((data) =>
      term.write(Uint8Array.from(data, (c) => c.charCodeAt(0))),
    );
    api.onExit(() => term.write("\r\n\x1b[31m[session ended]\x1b[0m\r\n"));

    term.onData((data) => api.write(data));

    const ro = new ResizeObserver(() => {
      fitAddon.fit();
      api.resize(term.cols, term.rows);
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      api.offData();
      api.kill();
      term.dispose();
    };
  }, [isElectron, projectFolder]);

  if (!isElectron) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400 p-8 text-center">
        <span className="text-5xl">⌨️</span>
        <div>
          <p className="text-sm font-medium text-slate-300 mb-1">
            Integrated terminal requires the desktop app
          </p>
          <p className="text-xs text-slate-500">
            Download <strong className="text-slate-400">Code Companion</strong>{" "}
            for macOS, Windows, or Linux.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-hidden bg-[#0f172a] px-1 pt-1"
      />
    </div>
  );
}
