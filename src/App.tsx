import { useState, useCallback, useEffect, useMemo } from "react";
import { SessionGrid } from "./components/SessionGrid";
import { SessionLibrary } from "./components/SessionLibrary";
import { ScreenshotBrowser } from "./components/ScreenshotBrowser";
import { ConsoleLog, interceptConsole } from "./components/ConsoleLog";
import { Header } from "./components/Header";
import { NewSessionModal } from "./components/NewSessionModal";
import { CommandPalette, CommandAction } from "./components/CommandPalette";
import { PromptTemplates } from "./components/PromptTemplates";
import { ToastContainer, ToastMessage } from "./components/Toast";
import { StatusBar } from "./components/StatusBar";
import { BroadcastBar } from "./components/BroadcastBar";
import { FileBrowser } from "./components/FileBrowser";
import { DiffViewer } from "./components/DiffViewer";
import { NewsTicker } from "./components/NewsTicker";
import { Session } from "./types";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { setDropHandler } from "./lib/fileDrag";
import "./App.css";

export default function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [newSessionOpen, setNewSessionOpen] = useState(false);
  const [screenshotsOpen, setScreenshotsOpen] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [showSymbols, setShowSymbols] = useState(() => localStorage.getItem("forge-show-symbols") !== "false");
  const [showGridLines, setShowGridLines] = useState(() => localStorage.getItem("forge-show-grid") !== "false");
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [fileBrowserOpen, setFileBrowserOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [diffViewerOpen, setDiffViewerOpen] = useState(false);
  const [layoutMode, setLayoutMode] = useState<string>(() => localStorage.getItem("forge-layout") || "auto");
  const [guiScale, setGuiScale] = useState(() => {
    const saved = localStorage.getItem("forge-gui-scale");
    return saved ? parseFloat(saved) : 1;
  });
  const [termFontSize, setTermFontSize] = useState(() => {
    const saved = localStorage.getItem("forge-term-font-size");
    return saved ? parseInt(saved) : 14;
  });
  const [tickerSpeed, setTickerSpeed] = useState(() => {
    const saved = localStorage.getItem("forge-ticker-speed");
    return saved ? parseInt(saved) : 60;
  });
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem("forge-sound-enabled");
    return saved !== null ? saved === "true" : true;
  });

  useEffect(() => { interceptConsole(); }, []);
  const [windowOpacity, setWindowOpacity] = useState(1);
  const [focusedSessionId, setFocusedSessionId] = useState<string | null>(null);

  // ── Toast system ──────────────────────────────────────────────────────
  const addToast = useCallback((text: string, type: "info" | "success" | "error" = "info") => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, text, type }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Session management ────────────────────────────────────────────────
  const addSession = useCallback((session: Session) => {
    setSessions((prev) => [...prev, session]);
    setNewSessionOpen(false);
  }, []);

  const quickSession = useCallback(() => {
    const now = new Date();
    const timeLabel = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const session: Session = {
      id: `session-${Date.now()}`,
      label: `Quick ${timeLabel}`,
      project: "Untitled",
      workingDir: "C:\\Users\\Skate\\Documents\\__CLAUDE ZONE",
      status: "active",
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      color: "#f97316",
    };
    setSessions((prev) => [...prev, session]);
    addToast("Quick session launched", "success");
  }, [addToast]);

  const handleDropPromptFile = useCallback((filePath: string) => {
    const fileName = filePath.split("\\").pop()?.replace(/\.md$/i, "") || "Prompt";
    const now = new Date();
    const timeLabel = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const session: Session = {
      id: `session-${Date.now()}`,
      label: `${fileName} ${timeLabel}`,
      project: "Untitled",
      workingDir: "C:\\Users\\Skate\\Documents\\__CLAUDE ZONE",
      status: "active",
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      color: "#3b82f6",
      initialPrompt: filePath,
    };
    setSessions((prev) => [...prev, session]);
    addToast(`Prompt session: ${fileName}`, "success");
  }, [addToast]);

  // ── Custom drag-and-drop from file browser ──────────────────────────
  useEffect(() => {
    setDropHandler((filePath, target) => {
      if (target === "empty") {
        if (filePath.toLowerCase().endsWith(".md")) {
          handleDropPromptFile(filePath);
        }
      } else {
        invoke("write_to_session", { sessionId: target.sessionId, data: filePath }).catch(() => {});
      }
    });
  }, [handleDropPromptFile]);

  // ── External file drops from Windows Explorer ─────────────────────
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      // Only handle external file drops (not our internal custom drag)
      if (e.dataTransfer?.types.includes("Files")) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }
    };

    const handleDrop = (e: DragEvent) => {
      if (!e.dataTransfer?.files.length) return;
      e.preventDefault();

      const file = e.dataTransfer.files[0];
      // Get the file path — on Windows/Tauri, files have a path property
      const filePath = (file as any).path || file.name;
      if (!filePath) return;

      // Find drop target
      let el = e.target as HTMLElement | null;
      while (el) {
        if (el.classList.contains("session-pane")) {
          const sessionId = el.getAttribute("data-session-id");
          if (sessionId) {
            invoke("write_to_session", { sessionId, data: filePath }).catch(() => {});
          }
          return;
        }
        if (el.classList.contains("grid-empty-state")) {
          if (filePath.toLowerCase().endsWith(".md")) {
            handleDropPromptFile(filePath);
          }
          return;
        }
        el = el.parentElement;
      }

      // Dropped somewhere else — if there's a focused session, paste there
      if (focusedSessionId) {
        invoke("write_to_session", { sessionId: focusedSessionId, data: filePath }).catch(() => {});
      }
    };

    document.addEventListener("dragover", handleDragOver);
    document.addEventListener("drop", handleDrop);
    return () => {
      document.removeEventListener("dragover", handleDragOver);
      document.removeEventListener("drop", handleDrop);
    };
  }, [handleDropPromptFile, focusedSessionId]);

  const removeSession = useCallback((id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setFocusedSessionId((prev) => (prev === id ? null : prev));
  }, []);

  const updateSession = useCallback((id: string, updates: Partial<Session>) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const updated = { ...s, ...updates };
        // Toast on pin/unpin
        if (updates.pinned !== undefined && updates.pinned !== s.pinned) {
          // defer toast to avoid setState during render
          setTimeout(() => {
            const action = updates.pinned ? "pinned" : "unpinned";
            setToasts((t) => [...t, {
              id: `toast-${Date.now()}`,
              text: `Session "${updated.label}" ${action}`,
              type: "info",
            }]);
          }, 0);
        }
        return updated;
      })
    );
  }, []);

  const handleSessionFocus = useCallback((id: string) => {
    setFocusedSessionId(id);
  }, []);

  const reorderSessions = useCallback((fromIdx: number, toIdx: number) => {
    setSessions((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  }, []);

  // ── Pinned sessions: persist & restore ────────────────────────────────
  // Save pinned session configs to localStorage whenever sessions change
  useEffect(() => {
    const pinned = sessions.filter((s) => s.pinned);
    if (pinned.length > 0) {
      localStorage.setItem("forge-pinned-sessions", JSON.stringify(
        pinned.map((s) => ({
          label: s.label,
          project: s.project,
          workingDir: s.workingDir,
          color: s.color,
        }))
      ));
    } else {
      localStorage.removeItem("forge-pinned-sessions");
    }
  }, [sessions]);

  // Restore pinned sessions on first mount
  useEffect(() => {
    const raw = localStorage.getItem("forge-pinned-sessions");
    if (!raw) return;
    try {
      const pinned = JSON.parse(raw) as { label: string; project: string; workingDir: string; color?: string }[];
      const restored: Session[] = pinned.map((p, i) => ({
        id: `session-${Date.now()}-${i}`,
        label: p.label,
        project: p.project,
        workingDir: p.workingDir,
        status: "active" as const,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        color: p.color || "#f97316",
        pinned: true,
      }));
      if (restored.length > 0) {
        setSessions(restored);
        setTimeout(() => {
          setToasts((t) => [...t, {
            id: `toast-${Date.now()}`,
            text: `Restored ${restored.length} pinned session${restored.length > 1 ? "s" : ""}`,
            type: "success",
          }]);
        }, 500);
      }
    } catch {}
  }, []);

  // ── Listen for tray events ────────────────────────────────────────────
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    listen("tray-quick-session", () => {
      quickSession();
    }).then((fn) => { unlisten = fn; });
    return () => { if (unlisten) unlisten(); };
  }, [quickSession]);

  // ── Persist settings ─────────────────────────────────────────────
  useEffect(() => { localStorage.setItem("forge-sound-enabled", String(soundEnabled)); }, [soundEnabled]);
  useEffect(() => { localStorage.setItem("forge-show-symbols", String(showSymbols)); }, [showSymbols]);
  useEffect(() => { localStorage.setItem("forge-show-grid", String(showGridLines)); }, [showGridLines]);
  useEffect(() => { localStorage.setItem("forge-layout", layoutMode); }, [layoutMode]);
  useEffect(() => { localStorage.setItem("forge-gui-scale", String(guiScale)); }, [guiScale]);
  useEffect(() => { localStorage.setItem("forge-term-font-size", String(termFontSize)); }, [termFontSize]);
  useEffect(() => { localStorage.setItem("forge-ticker-speed", String(tickerSpeed)); }, [tickerSpeed]);

  // ── Command palette actions ───────────────────────────────────────────
  const commandActions: CommandAction[] = useMemo(() => [
    { id: "new-session", label: "New Session", shortcut: "Ctrl+N", action: () => setNewSessionOpen(true) },
    { id: "quick-session", label: "Quick Session", shortcut: "Ctrl+Shift+N", action: quickSession },
    { id: "open-library", label: "Open Session Library", shortcut: "Ctrl+L", action: () => setLibraryOpen(true) },
    { id: "open-screenshots", label: "Open Screenshots", shortcut: "Ctrl+P", action: () => setScreenshotsOpen(true) },
    { id: "open-console", label: "Open Console", action: () => setConsoleOpen(true) },
    { id: "toggle-symbols", label: `${showSymbols ? "Hide" : "Show"} Background Symbols`, action: () => setShowSymbols((v) => !v) },
    { id: "toggle-grid", label: `${showGridLines ? "Hide" : "Show"} Grid Lines`, action: () => setShowGridLines((v) => !v) },
    { id: "toggle-files", label: `${fileBrowserOpen ? "Close" : "Open"} File Browser`, shortcut: "Ctrl+E", action: () => setFileBrowserOpen((v) => !v) },
    { id: "open-templates", label: "Open Prompt Templates", shortcut: "Ctrl+T", action: () => setTemplatesOpen(true) },
    { id: "broadcast", label: `${broadcastOpen ? "Close" : "Open"} Broadcast Mode`, shortcut: "Ctrl+B", action: () => setBroadcastOpen((v) => !v) },
    { id: "open-diffs", label: "Open Diff Viewer", shortcut: "Ctrl+D", action: () => setDiffViewerOpen(true) },
    { id: "close-all", label: "Close All Sessions", action: () => {
      sessions.forEach((s) => window.dispatchEvent(new CustomEvent("forge-close-session", { detail: s.id })));
    }},
  ], [quickSession, showSymbols, showGridLines, sessions, broadcastOpen, fileBrowserOpen]);

  // ── Global keyboard shortcuts ─────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA";

      if (e.ctrlKey && e.shiftKey && e.key === "N") {
        e.preventDefault();
        quickSession();
      } else if (e.ctrlKey && e.key === "k" && !isInput) {
        e.preventDefault();
        setCommandPaletteOpen((v) => !v);
      } else if (e.ctrlKey && e.key === "e" && !isInput) {
        e.preventDefault();
        setFileBrowserOpen((v) => !v);
      } else if (e.ctrlKey && e.key === "b" && !isInput) {
        e.preventDefault();
        setBroadcastOpen((v) => !v);
      } else if (e.ctrlKey && e.key === "d" && !isInput) {
        e.preventDefault();
        setDiffViewerOpen((v) => !v);
      } else if (e.ctrlKey && e.key === "t" && !isInput) {
        e.preventDefault();
        setTemplatesOpen((v) => !v);
      } else if (e.ctrlKey && e.key === "n" && !isInput) {
        e.preventDefault();
        setNewSessionOpen(true);
      } else if (e.ctrlKey && e.key === "l" && !isInput) {
        e.preventDefault();
        setLibraryOpen((prev) => !prev);
      } else if (e.ctrlKey && e.key === "p" && !isInput) {
        e.preventDefault();
        setScreenshotsOpen((prev) => !prev);
      } else if (e.ctrlKey && e.key === "Tab") {
        e.preventDefault();
        setSessions((prev) => {
          if (prev.length === 0) return prev;
          const currentIdx = prev.findIndex((s) => s.id === focusedSessionId);
          const nextIdx = e.shiftKey
            ? (currentIdx <= 0 ? prev.length - 1 : currentIdx - 1)
            : (currentIdx + 1) % prev.length;
          setFocusedSessionId(prev[nextIdx].id);
          return prev;
        });
      } else if (e.ctrlKey && !e.shiftKey && e.key >= "1" && e.key <= "9" && !isInput) {
        e.preventDefault();
        const idx = parseInt(e.key) - 1;
        setSessions((prev) => {
          if (idx < prev.length) setFocusedSessionId(prev[idx].id);
          return prev;
        });
      } else if (e.ctrlKey && e.key === "w" && !isInput && focusedSessionId) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("forge-close-session", { detail: focusedSessionId }));
      } else if (e.ctrlKey && e.key === "s" && !isInput && focusedSessionId) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("forge-save-session", { detail: focusedSessionId }));
      } else if (e.key === "Escape") {
        if (commandPaletteOpen) setCommandPaletteOpen(false);
        else if (templatesOpen) setTemplatesOpen(false);
        else if (libraryOpen) setLibraryOpen(false);
        else if (newSessionOpen) setNewSessionOpen(false);
        else if (screenshotsOpen) setScreenshotsOpen(false);
        else if (consoleOpen) setConsoleOpen(false);
        else if (diffViewerOpen) setDiffViewerOpen(false);
        else if (fileBrowserOpen) setFileBrowserOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focusedSessionId, libraryOpen, newSessionOpen, screenshotsOpen, consoleOpen, commandPaletteOpen, templatesOpen, fileBrowserOpen, diffViewerOpen, quickSession]);

  const broadcastToAll = useCallback((text: string) => {
    sessions.forEach((s) => {
      if (s.status !== "closed") {
        invoke("write_to_session", { sessionId: s.id, data: text + "\r" }).catch(() => {});
      }
    });
    addToast(`Broadcast sent to ${sessions.filter((s) => s.status !== "closed").length} sessions`, "success");
  }, [sessions, addToast]);

  const handleScreenshotSelect = useCallback((path: string) => {
    const targetId = focusedSessionId || (sessions.length > 0 ? sessions[0].id : null);
    if (targetId) {
      invoke("write_to_session", {
        sessionId: targetId,
        data: path,
      }).catch((err) => console.error("Failed to paste path:", err));
    }
  }, [sessions, focusedSessionId]);

  return (
    <div className={`app${fileBrowserOpen ? " fb-open" : ""}`} style={{ "--gui-scale": guiScale } as React.CSSProperties}>
      <FileBrowser
        open={fileBrowserOpen}
        onClose={() => setFileBrowserOpen(false)}
      />
      <Header
        sessionCount={sessions.length}
        onNewSession={() => setNewSessionOpen(true)}
        onQuickSession={quickSession}
        onOpenLibrary={() => setLibraryOpen(true)}
        onOpenConsole={() => setConsoleOpen(true)}
        onOpenTemplates={() => setTemplatesOpen(true)}
        onOpenScreenshots={() => setScreenshotsOpen(true)}
        onToggleFiles={() => setFileBrowserOpen((v) => !v)}
        onOpenDiffs={() => setDiffViewerOpen(true)}
        fileBrowserOpen={fileBrowserOpen}
        windowOpacity={windowOpacity}
        onOpacityChange={setWindowOpacity}
        showSymbols={showSymbols}
        onToggleSymbols={() => setShowSymbols((v) => !v)}
        showGridLines={showGridLines}
        onToggleGridLines={() => setShowGridLines((v) => !v)}
        layoutMode={layoutMode}
        onLayoutChange={setLayoutMode}
        guiScale={guiScale}
        onGuiScaleChange={setGuiScale}
        termFontSize={termFontSize}
        onTermFontSizeChange={setTermFontSize}
        tickerSpeed={tickerSpeed}
        onTickerSpeedChange={setTickerSpeed}
      />
      <div className="ember-strip">
        <NewsTicker speed={tickerSpeed} />
      </div>
      {broadcastOpen && (
        <BroadcastBar
          sessionCount={sessions.filter((s) => s.status !== "closed").length}
          onSend={broadcastToAll}
          onClose={() => setBroadcastOpen(false)}
        />
      )}
      <main className="app-main" style={{ "--bg-opacity": Math.pow(windowOpacity, 2) } as React.CSSProperties}>
        <SessionGrid
          sessions={sessions}
          focusedSessionId={focusedSessionId}
          bgOpacity={windowOpacity}
          soundEnabled={soundEnabled}
          terminalFontSize={termFontSize}
          layoutMode={layoutMode}
          showSymbols={showSymbols}
          showGridLines={showGridLines}
          onRemove={removeSession}
          onUpdate={updateSession}
          onReorder={reorderSessions}
          onNewSession={() => setNewSessionOpen(true)}
          onQuickSession={quickSession}
          onSessionFocus={handleSessionFocus}
          onDropPromptFile={handleDropPromptFile}
        />
      </main>
      {libraryOpen && (
        <SessionLibrary
          onClose={() => setLibraryOpen(false)}
          onResume={(session) => {
            addSession(session);
            setLibraryOpen(false);
          }}
        />
      )}
      {newSessionOpen && (
        <NewSessionModal
          onClose={() => setNewSessionOpen(false)}
          onCreate={addSession}
        />
      )}
      {consoleOpen && (
        <ConsoleLog onClose={() => setConsoleOpen(false)} />
      )}
      {screenshotsOpen && (
        <ScreenshotBrowser
          onClose={() => setScreenshotsOpen(false)}
          onSelect={handleScreenshotSelect}
        />
      )}
      {commandPaletteOpen && (
        <CommandPalette
          actions={commandActions}
          onClose={() => setCommandPaletteOpen(false)}
        />
      )}
      {diffViewerOpen && (
        <DiffViewer
          onClose={() => setDiffViewerOpen(false)}
          sessions={sessions}
        />
      )}
      {templatesOpen && (
        <PromptTemplates
          onClose={() => setTemplatesOpen(false)}
          focusedSessionId={focusedSessionId}
          sessions={sessions}
          addToast={addToast}
        />
      )}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <StatusBar
        sessions={sessions}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled((v) => !v)}
      />
    </div>
  );
}
