import { useState, useCallback, useEffect, useMemo } from "react";
import { SessionGrid } from "./components/SessionGrid";
import { SessionLibrary } from "./components/SessionLibrary";
import { ScreenshotBrowser } from "./components/ScreenshotBrowser";
import { ConsoleLog, interceptConsole } from "./components/ConsoleLog";
import { Header } from "./components/Header";
import { NewSessionModal } from "./components/NewSessionModal";
import { CommandPalette, CommandAction } from "./components/CommandPalette";
import { ToastContainer, ToastMessage } from "./components/Toast";
import { Session } from "./types";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./App.css";

export default function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [newSessionOpen, setNewSessionOpen] = useState(false);
  const [screenshotsOpen, setScreenshotsOpen] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [showSymbols, setShowSymbols] = useState(true);
  const [showGridLines, setShowGridLines] = useState(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

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

  // ── Command palette actions ───────────────────────────────────────────
  const commandActions: CommandAction[] = useMemo(() => [
    { id: "new-session", label: "New Session", shortcut: "Ctrl+N", action: () => setNewSessionOpen(true) },
    { id: "quick-session", label: "Quick Session", shortcut: "Ctrl+Shift+N", action: quickSession },
    { id: "open-library", label: "Open Session Library", shortcut: "Ctrl+L", action: () => setLibraryOpen(true) },
    { id: "open-screenshots", label: "Open Screenshots", shortcut: "Ctrl+P", action: () => setScreenshotsOpen(true) },
    { id: "open-console", label: "Open Console", action: () => setConsoleOpen(true) },
    { id: "toggle-symbols", label: `${showSymbols ? "Hide" : "Show"} Background Symbols`, action: () => setShowSymbols((v) => !v) },
    { id: "toggle-grid", label: `${showGridLines ? "Hide" : "Show"} Grid Lines`, action: () => setShowGridLines((v) => !v) },
    { id: "close-all", label: "Close All Sessions", action: () => {
      sessions.forEach((s) => window.dispatchEvent(new CustomEvent("forge-close-session", { detail: s.id })));
    }},
  ], [quickSession, showSymbols, showGridLines, sessions]);

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
      } else if (e.ctrlKey && e.key === "w" && !isInput && focusedSessionId) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("forge-close-session", { detail: focusedSessionId }));
      } else if (e.ctrlKey && e.key === "s" && !isInput && focusedSessionId) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("forge-save-session", { detail: focusedSessionId }));
      } else if (e.key === "Escape") {
        if (commandPaletteOpen) setCommandPaletteOpen(false);
        else if (libraryOpen) setLibraryOpen(false);
        else if (newSessionOpen) setNewSessionOpen(false);
        else if (screenshotsOpen) setScreenshotsOpen(false);
        else if (consoleOpen) setConsoleOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focusedSessionId, libraryOpen, newSessionOpen, screenshotsOpen, consoleOpen, commandPaletteOpen, quickSession]);

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
    <div className="app">
      <Header
        sessionCount={sessions.length}
        onNewSession={() => setNewSessionOpen(true)}
        onQuickSession={quickSession}
        onOpenLibrary={() => setLibraryOpen(true)}
        onOpenConsole={() => setConsoleOpen(true)}
        onOpenScreenshots={() => setScreenshotsOpen(true)}
        windowOpacity={windowOpacity}
        onOpacityChange={setWindowOpacity}
        showSymbols={showSymbols}
        onToggleSymbols={() => setShowSymbols((v) => !v)}
        showGridLines={showGridLines}
        onToggleGridLines={() => setShowGridLines((v) => !v)}
      />
      <div className="ember-strip" />
      <main className="app-main" style={{ "--bg-opacity": Math.pow(windowOpacity, 2) } as React.CSSProperties}>
        <SessionGrid
          sessions={sessions}
          focusedSessionId={focusedSessionId}
          bgOpacity={windowOpacity}
          showSymbols={showSymbols}
          showGridLines={showGridLines}
          onRemove={removeSession}
          onUpdate={updateSession}
          onReorder={reorderSessions}
          onNewSession={() => setNewSessionOpen(true)}
          onQuickSession={quickSession}
          onSessionFocus={handleSessionFocus}
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
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
