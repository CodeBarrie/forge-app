import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

interface LogEntry {
  time: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
}

interface ConsoleLogProps {
  onClose: () => void;
}

// Global log buffer accessible from anywhere
const LOG_BUFFER: LogEntry[] = [];
const MAX_LOGS = 500;
let listeners: (() => void)[] = [];

function addLog(level: LogEntry["level"], ...args: unknown[]) {
  const message = args.map((a) =>
    typeof a === "object" ? JSON.stringify(a, null, 2) : String(a)
  ).join(" ");
  const time = new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  LOG_BUFFER.push({ time, level, message });
  if (LOG_BUFFER.length > MAX_LOGS) LOG_BUFFER.shift();
  listeners.forEach((fn) => fn());
}

// Intercept console methods
const origLog = console.log;
const origWarn = console.warn;
const origError = console.error;
const origDebug = console.debug;

let intercepted = false;
export function interceptConsole() {
  if (intercepted) return;
  intercepted = true;
  console.log = (...args) => { origLog(...args); addLog("info", ...args); };
  console.warn = (...args) => { origWarn(...args); addLog("warn", ...args); };
  console.error = (...args) => { origError(...args); addLog("error", ...args); };
  console.debug = (...args) => { origDebug(...args); addLog("debug", ...args); };
}

// Public log function for explicit logging
export function forgeLog(level: LogEntry["level"], message: string) {
  addLog(level, `[forge] ${message}`);
}

export function ConsoleLog({ onClose }: ConsoleLogProps) {
  const [logs, setLogs] = useState<LogEntry[]>([...LOG_BUFFER]);
  const [filter, setFilter] = useState<string>("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const pendingUpdate = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const update = () => {
      // Debounce rapid log updates to avoid cascade re-renders
      if (pendingUpdate.current) return;
      pendingUpdate.current = setTimeout(() => {
        pendingUpdate.current = null;
        setLogs([...LOG_BUFFER]);
      }, 100);
    };
    listeners.push(update);
    return () => {
      listeners = listeners.filter((fn) => fn !== update);
      if (pendingUpdate.current) clearTimeout(pendingUpdate.current);
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleOpenLogsDir = useCallback(async () => {
    try {
      await invoke("open_logs_dir");
    } catch (err) {
      console.error("Failed to open logs dir:", err);
    }
  }, []);

  const handleExport = useCallback(async () => {
    const id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    const content = LOG_BUFFER.map(
      (e) => `[${e.time}] [${e.level.toUpperCase()}] ${e.message}`
    ).join("\n");
    try {
      const path = await invoke<string>("export_log", { filename: `log_${id}.log`, content });
      addLog("info", `[forge] Log exported to ${path}`);
    } catch (err) {
      console.error("Failed to export log:", err);
    }
  }, []);

  const filtered = filter
    ? logs.filter((l) => l.message.toLowerCase().includes(filter.toLowerCase()) || l.level === filter)
    : logs;

  const levelColor = { info: "#e8edf5", warn: "#fbbf24", error: "#f87171", debug: "#6b7280" };

  return (
    <div className="library-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="console-panel">
        <div className="library-header">
          <h2>Console Log</h2>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input
              className="console-filter"
              placeholder="Filter..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <button className="btn-ghost" onClick={handleExport} style={{ fontSize: "11px" }}>
              Export
            </button>
            <button className="btn-ghost" onClick={handleOpenLogsDir} style={{ fontSize: "11px" }}>
              Open Folder
            </button>
            <button className="btn-ghost" onClick={() => { LOG_BUFFER.length = 0; setLogs([]); }} style={{ fontSize: "11px" }}>
              Clear
            </button>
            <button className="btn-close" onClick={onClose}>×</button>
          </div>
        </div>
        <div className="console-body">
          {filtered.length === 0 && (
            <div className="console-empty">No log entries yet.</div>
          )}
          {filtered.map((entry, i) => (
            <div key={i} className={`console-entry console-${entry.level}`}>
              <span className="console-time">{entry.time}</span>
              <span className="console-level" style={{ color: levelColor[entry.level] }}>{entry.level.toUpperCase()}</span>
              <span className="console-msg">{entry.message}</span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
