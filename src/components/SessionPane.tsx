import { useEffect, useRef, useState, useCallback } from "react";
import { Session } from "../types";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { generateSessionSummary } from "../lib/summarizer";
import { forgeLog } from "./ConsoleLog";
import "@xterm/xterm/css/xterm.css";

interface SessionPaneProps {
  session: Session;
  isFocused: boolean;
  bgOpacity: number;
  onClose: () => void;
  onUpdate: (updates: Partial<Session>) => void;
  onFocus: () => void;
}

export function SessionPane({ session, isFocused, bgOpacity, onUpdate, onClose, onFocus }: SessionPaneProps) {
  const termRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const [exited, setExited] = useState(false);
  const [ready, setReady] = useState(false);
  const [autosaveFlash, setAutosaveFlash] = useState(false);
  const transcriptRef = useRef<string>("");
  const startedRef = useRef(false);
  const claudeSessionIdRef = useRef<string | null>(session.claudeSessionId || null);
  const webglRef = useRef<WebglAddon | null>(null);

  useEffect(() => {
    if (!termRef.current) return;

    const term = new Terminal({
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      fontSize: 14,
      lineHeight: 1.0,
      cursorBlink: true,
      cursorStyle: "bar",
      allowTransparency: true,
      theme: {
        background: "#0b0e12",
        foreground: "#e8edf5",
        cursor: "#f97316",
        selectionBackground: "#2a3548",
        black: "#0b0e12",
        red: "#f87171",
        green: "#4ade80",
        yellow: "#fbbf24",
        blue: "#3b82f6",
        magenta: "#c084fc",
        cyan: "#22d3ee",
        white: "#e8edf5",
        brightBlack: "#4a5568",
        brightRed: "#fca5a5",
        brightGreen: "#86efac",
        brightYellow: "#fde68a",
        brightBlue: "#93c5fd",
        brightMagenta: "#d8b4fe",
        brightCyan: "#67e8f9",
        brightWhite: "#f8fafc",
      },
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(termRef.current);

    // Load WebGL renderer (only when fully opaque — WebGL ignores alpha)
    if (bgOpacity >= 1) {
      try {
        const webgl = new WebglAddon();
        term.loadAddon(webgl);
        webglRef.current = webgl;
      } catch (e) {
        console.warn("WebGL renderer failed, using canvas fallback:", e);
      }
    }

    xtermRef.current = term;
    fitRef.current = fit;

    // Send terminal size to backend
    const reportSize = () => {
      invoke("resize_session", {
        sessionId: session.id,
        cols: term.cols,
        rows: term.rows,
      }).catch(() => {});
    };

    // Fit immediately with current dimensions
    fit.fit();

    // Start the PTY session — guard against React strict mode double-start
    if (!startedRef.current) {
      startedRef.current = true;
      forgeLog("info", `Starting session "${session.label}" (${session.id})`);
      forgeLog("info", `Working dir: ${session.workingDir}`);
      forgeLog("info", `Claude session ID: ${session.claudeSessionId || "new (will be assigned)"}`);

      invoke("start_session", {
        sessionId: session.id,
        workingDir: session.workingDir,
        label: session.label,
        resumeContext: session.resumeContext || null,
        claudeSessionId: session.claudeSessionId || null,
        cols: term.cols,
        rows: term.rows,
      }).then(() => {
        forgeLog("info", `Session "${session.label}" PTY started successfully`);
      }).catch((err) => {
        forgeLog("error", `Failed to start session: ${err}`);
        term.writeln(`\x1b[31m[forge] Failed to start session: ${err}\x1b[0m`);
        term.writeln(`\x1b[38;5;240m[forge] Make sure 'claude' is installed and in your PATH\x1b[0m`);
      });
    }

    // Listen for Claude session ID (emitted by backend for new sessions)
    let unlistenClaudeSid: (() => void) | null = null;
    listen<string>(`pty-claude-sid-${session.id}`, (event) => {
      claudeSessionIdRef.current = event.payload;
      forgeLog("info", `Captured Claude session ID: ${event.payload}`);
    }).then((fn) => { unlistenClaudeSid = fn; });

    // Listen for PTY output
    let unlistenData: (() => void) | null = null;
    let unlistenExit: (() => void) | null = null;
    let hasReceivedData = false;

    // Force a single resize after Claude Code's async status messages settle
    // This makes the TUI redraw and fixes cursor position
    let startupRedrawDone = false;
    let redrawTimer: ReturnType<typeof setTimeout> | null = null;

    listen<string>(`pty-data-${session.id}`, (event) => {
      if (!hasReceivedData) {
        term.focus();
      }
      hasReceivedData = true;
      term.write(event.payload);
      transcriptRef.current += event.payload;
      setReady(true);
      setExited(false);
      onUpdate({ status: "active", lastActiveAt: Date.now() });

      // Schedule one redraw during the first 8 seconds of startup only
      if (!startupRedrawDone) {
        if (redrawTimer) clearTimeout(redrawTimer);
        redrawTimer = setTimeout(() => {
          startupRedrawDone = true;
          try {
            fit.fit();
            reportSize();
          } catch {}
        }, 800);
      }
    }).then((fn) => { unlistenData = fn; });

    listen<string>(`pty-exit-${session.id}`, () => {
      // Only show exit message if the session actually produced output
      if (hasReceivedData) {
        term.writeln("\r\n\x1b[38;5;240m[forge] Session ended\x1b[0m");
      }
      setExited(true);
      onUpdate({ status: "closed" });
    }).then((fn) => { unlistenExit = fn; });

    // Send keyboard input to PTY
    term.onData((data) => {
      invoke("write_to_session", {
        sessionId: session.id,
        data,
      }).catch(() => {});
    });

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      try {
        fit.fit();
        reportSize();
      } catch {}
    });
    resizeObserver.observe(termRef.current);

    return () => {
      resizeObserver.disconnect();
      if (unlistenData) unlistenData();
      if (unlistenExit) unlistenExit();
      if (unlistenClaudeSid) unlistenClaudeSid();
      term.dispose();
    };
  }, [session.id]);

  // Update xterm background when opacity slider changes
  // Toggle WebGL off when transparent (WebGL ignores alpha), back on when opaque
  useEffect(() => {
    const term = xtermRef.current;
    if (!term) return;

    // Dispose WebGL first so canvas renderer takes over before we set alpha bg
    if (bgOpacity < 1 && webglRef.current) {
      forgeLog("info", `Disposing WebGL renderer for transparency (opacity: ${bgOpacity})`);
      webglRef.current.dispose();
      webglRef.current = null;
    }

    // Apply quadratic curve so low values approach transparency more slowly
    const curved = bgOpacity * bgOpacity;
    const a = Math.round(curved * 255).toString(16).padStart(2, "0");
    term.options.allowTransparency = bgOpacity < 1;
    term.options.theme = {
      ...term.options.theme,
      background: bgOpacity < 1 ? `#0b0e12${a}` : "#0b0e12",
    };

    // Force xterm to re-render
    try { fitRef.current?.fit(); } catch {}

    // Re-enable WebGL when fully opaque
    if (bgOpacity >= 1 && !webglRef.current) {
      try {
        const webgl = new WebglAddon();
        term.loadAddon(webgl);
        webglRef.current = webgl;
        forgeLog("info", "Re-enabled WebGL renderer");
      } catch {}
    }
  }, [bgOpacity]);

  const handleClose = useCallback(() => {
    // Remove from UI immediately — nothing blocks this
    onClose();

    // Kill the PTY (fire-and-forget)
    invoke("kill_session", { sessionId: session.id }).catch(() => {});

    // Save session in background — generate summary first, then save once
    const transcript = transcriptRef.current;
    const nowSecs = Math.floor(Date.now() / 1000);
    const createdSecs = Math.floor(session.createdAt / 1000);

    const doSave = async () => {
      let summary = `Session "${session.label}" closed.`;
      if (transcript.length > 50) {
        try {
          summary = await generateSessionSummary(session.label, session.project, transcript);
        } catch {}
      }
      await invoke("save_session", {
        session: {
          id: session.id,
          label: session.label,
          project: session.project,
          workingDir: session.workingDir,
          status: "closed",
          createdAt: createdSecs,
          lastActiveAt: nowSecs,
          summary,
          transcript: transcript.slice(-8000),
          closedAt: nowSecs,
          claudeSessionId: claudeSessionIdRef.current,
        },
      });
    };
    doSave().catch((err) => console.error("Failed to save session:", err));
  }, [session, onClose]);

  const [saveState, setSaveState] = useState<{
    active: boolean;
    progress: number; // 0-10 chunks
    status: "editing" | "saving" | "done" | "error";
  }>({ active: false, progress: 0, status: "editing" });

  const [saveLabel, setSaveLabel] = useState(session.label);
  const [saveProject, setSaveProject] = useState(session.project);

  const handleSave = useCallback(() => {
    // Show edit step so user can set label/project before saving
    setSaveLabel(session.label);
    setSaveProject(session.project);
    setSaveState({ active: true, progress: 0, status: "editing" });
  }, [session.label, session.project]);

  const confirmSave = useCallback(async () => {
    // Apply edits back to the session
    const label = saveLabel.trim() || session.label;
    const project = saveProject.trim() || session.project;
    onUpdate({ label, project });

    setSaveState({ active: true, progress: 0, status: "saving" });
    forgeLog("info", `Saving session "${label}" (${session.id})`);

    const transcript = transcriptRef.current;
    forgeLog("info", `Transcript length: ${transcript.length} chars`);
    const nowSecs = Math.floor(Date.now() / 1000);
    const createdSecs = Math.floor(session.createdAt / 1000);

    // Simulate progress while waiting for API
    let currentProgress = 0;
    const progressInterval = setInterval(() => {
      currentProgress += 1;
      if (currentProgress <= 7) {
        setSaveState((prev) => ({ ...prev, progress: currentProgress }));
      }
    }, 400);

    try {
      forgeLog("info", "Generating summary via claude CLI...");
      const summary = transcript.length > 50
        ? await generateSessionSummary(label, project, transcript)
        : `Session "${label}" — saved snapshot.`;
      forgeLog("info", `Summary generated: ${summary.slice(0, 200)}`);

      // Jump to 8
      setSaveState((prev) => ({ ...prev, progress: 8 }));

      await invoke("save_session", {
        session: {
          id: session.id,
          label,
          project,
          workingDir: session.workingDir,
          status: "active",
          createdAt: createdSecs,
          lastActiveAt: nowSecs,
          summary,
          transcript: transcript.slice(-8000),
          closedAt: null,
          claudeSessionId: claudeSessionIdRef.current,
        },
      });

      clearInterval(progressInterval);
      // Fill to 10 and show done
      setSaveState({ active: true, progress: 9, status: "saving" });
      await new Promise((r) => setTimeout(r, 200));
      setSaveState({ active: true, progress: 10, status: "done" });
      // Hold "Done!" for a moment then close
      await new Promise((r) => setTimeout(r, 1200));
      setSaveState({ active: false, progress: 0, status: "editing" });
    } catch (err) {
      console.error("Failed to save session:", err);
      clearInterval(progressInterval);
      setSaveState({ active: true, progress: currentProgress, status: "error" });
      await new Promise((r) => setTimeout(r, 1500));
      setSaveState({ active: false, progress: 0, status: "editing" });
    }
  }, [session, saveLabel, saveProject, onUpdate]);

  // Listen for keyboard shortcut events (Ctrl+W close, Ctrl+S save)
  useEffect(() => {
    const onClose = (e: Event) => {
      if ((e as CustomEvent).detail === session.id) handleClose();
    };
    const onSave = (e: Event) => {
      if ((e as CustomEvent).detail === session.id) handleSave();
    };
    window.addEventListener("forge-close-session", onClose);
    window.addEventListener("forge-save-session", onSave);
    return () => {
      window.removeEventListener("forge-close-session", onClose);
      window.removeEventListener("forge-save-session", onSave);
    };
  }, [session.id, handleClose, handleSave]);

  const saving = saveState.active;

  // Auto-save every 5 minutes (silent, no overlay)
  useEffect(() => {
    const AUTOSAVE_INTERVAL = 5 * 60 * 1000;
    const timer = setInterval(() => {
      const transcript = transcriptRef.current;
      if (transcript.length < 50 || exited) return;

      const nowSecs = Math.floor(Date.now() / 1000);
      const createdSecs = Math.floor(session.createdAt / 1000);

      invoke("save_session", {
        session: {
          id: session.id,
          label: session.label,
          project: session.project,
          workingDir: session.workingDir,
          status: "active",
          createdAt: createdSecs,
          lastActiveAt: nowSecs,
          summary: session.summary || `Auto-saved session "${session.label}".`,
          transcript: transcript.slice(-8000),
          closedAt: null,
          claudeSessionId: claudeSessionIdRef.current,
        },
      }).then(() => {
        forgeLog("info", `Auto-saved session "${session.label}"`);
        setAutosaveFlash(true);
        setTimeout(() => setAutosaveFlash(false), 800);
      }).catch((err) => {
        forgeLog("error", `Auto-save failed for "${session.label}": ${err}`);
      });
    }, AUTOSAVE_INTERVAL);

    return () => clearInterval(timer);
  }, [session.id, session.label, session.project, session.workingDir, session.createdAt, exited]);

  const statusColor = {
    active: "#4ade80",
    thinking: "#fbbf24",
    idle: "#6b7280",
    closed: "#374151",
  }[session.status];

  return (
    <div className={`session-pane ${isFocused ? "focused" : ""} ${autosaveFlash ? "autosave-flash" : ""}`}>
      <div className="session-pane-header" style={{ position: "relative" }}>
        {isFocused && <span className="session-target-badge">target</span>}
        <div className="session-meta">
          <span className="session-indicator" style={{ backgroundColor: statusColor }} />
          <span className="session-label">{session.label}</span>
          <span className="session-project" style={session.color ? { color: session.color } : undefined}>{session.project}</span>
        </div>
        <div className="session-controls">
          {exited && <span className="session-exited">exited</span>}
          <button
            className="btn-save"
            onClick={handleSave}
            disabled={saving}
            title="Save session snapshot"
          >
            {saving ? "..." : "save"}
          </button>
          <button className="btn-close" onClick={handleClose} title="Close session">
            ×
          </button>
        </div>
      </div>
      {!ready && (
        <div className="terminal-loading">
          <span className="terminal-loading-text">Starting session...</span>
        </div>
      )}
      {saveState.active && (
        <div className="save-overlay">
          <div className="save-popup">
            {saveState.status === "editing" ? (
              <>
                <div className="save-popup-title">Save Session</div>
                <div className="save-edit-fields">
                  <input
                    className="field-input"
                    value={saveLabel}
                    onChange={(e) => setSaveLabel(e.target.value)}
                    placeholder="Session label"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && confirmSave()}
                  />
                  <input
                    className="field-input"
                    value={saveProject}
                    onChange={(e) => setSaveProject(e.target.value)}
                    placeholder="Project name"
                    onKeyDown={(e) => e.key === "Enter" && confirmSave()}
                  />
                </div>
                <div className="save-edit-actions">
                  <button
                    className="btn-ghost"
                    onClick={() => setSaveState({ active: false, progress: 0, status: "editing" })}
                  >
                    Cancel
                  </button>
                  <button className="btn-primary" onClick={confirmSave}>
                    Save
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="save-popup-title">
                  {saveState.status === "done" ? "Done!" : saveState.status === "error" ? "Save Failed" : "Saving Session..."}
                </div>
                <div className="save-bar-track">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className={`save-bar-chunk ${i < saveState.progress ? "filled" : ""} ${saveState.status === "done" ? "complete" : ""}`}
                    />
                  ))}
                </div>
                <div className="save-popup-sub">
                  {saveState.status === "done"
                    ? "Session saved to library"
                    : saveState.status === "error"
                    ? "Could not generate summary"
                    : "Generating AI summary..."}
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <div
        className="terminal-container"
        ref={termRef}
        onClick={onFocus}
      />
    </div>
  );
}
