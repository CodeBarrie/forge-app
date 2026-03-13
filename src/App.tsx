import { useState, useCallback, useEffect } from "react";
import { SessionGrid } from "./components/SessionGrid";
import { SessionLibrary } from "./components/SessionLibrary";
import { ScreenshotBrowser } from "./components/ScreenshotBrowser";
import { ConsoleLog, interceptConsole } from "./components/ConsoleLog";
import { Header } from "./components/Header";
import { NewSessionModal } from "./components/NewSessionModal";
import { Session } from "./types";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

export default function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [newSessionOpen, setNewSessionOpen] = useState(false);
  const [screenshotsOpen, setScreenshotsOpen] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [showSymbols, setShowSymbols] = useState(true);
  const [showGridLines, setShowGridLines] = useState(true);

  useEffect(() => { interceptConsole(); }, []);
  const [windowOpacity, setWindowOpacity] = useState(1);
  // Track which session pane was last focused (state so UI can highlight it)
  const [focusedSessionId, setFocusedSessionId] = useState<string | null>(null);

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
  }, []);

  const removeSession = useCallback((id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setFocusedSessionId((prev) => (prev === id ? null : prev));
  }, []);

  const updateSession = useCallback((id: string, updates: Partial<Session>) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  }, []);

  const handleSessionFocus = useCallback((id: string) => {
    setFocusedSessionId(id);
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA";

      if (e.ctrlKey && e.shiftKey && e.key === "N") {
        e.preventDefault();
        quickSession();
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
        if (libraryOpen) setLibraryOpen(false);
        else if (newSessionOpen) setNewSessionOpen(false);
        else if (screenshotsOpen) setScreenshotsOpen(false);
        else if (consoleOpen) setConsoleOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focusedSessionId, libraryOpen, newSessionOpen, screenshotsOpen, consoleOpen, quickSession]);

  const handleScreenshotSelect = useCallback((path: string) => {
    // Paste the file path into the last focused terminal session
    const targetId = focusedSessionId || (sessions.length > 0 ? sessions[0].id : null);
    if (targetId) {
      invoke("write_to_session", {
        sessionId: targetId,
        data: path,
      }).catch((err) => console.error("Failed to paste path:", err));
    }
  }, [sessions]);

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
    </div>
  );
}
