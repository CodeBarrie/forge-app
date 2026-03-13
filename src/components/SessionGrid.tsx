import { useState, useMemo } from "react";
import { Session } from "../types";
import { SessionPane } from "./SessionPane";

// Generate a grid of "+" with wave-delay metadata
const COLS = 28;
const ROWS = 18;
const CYCLE = 4; // seconds per full animation cycle

function buildPlusGrid() {
  // Radial wave expanding from bottom-right corner
  const originCol = COLS - 1;
  const originRow = ROWS - 1;
  // Max distance is to the opposite corner (top-left)
  const maxDist = Math.sqrt(originCol ** 2 + originRow ** 2);

  const items: { key: number; delay: number }[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const dist = Math.sqrt((c - originCol) ** 2 + (r - originRow) ** 2);
      // Tight spread so a big chunk spins at once — fat wave
      const delay = (dist / maxDist) * 1.2;
      items.push({ key: r * COLS + c, delay });
    }
  }
  return items;
}

interface SessionGridProps {
  sessions: Session[];
  focusedSessionId: string | null;
  bgOpacity: number;
  showSymbols: boolean;
  showGridLines: boolean;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Session>) => void;
  onNewSession: () => void;
  onQuickSession: () => void;
  onSessionFocus: (id: string) => void;
}

export function SessionGrid({ sessions, focusedSessionId, bgOpacity, showSymbols, showGridLines, onRemove, onUpdate, onNewSession, onQuickSession, onSessionFocus }: SessionGridProps) {
  // For 5+ sessions, show a tab bar and display up to 4 visible panes at a time
  const [visiblePage, setVisiblePage] = useState(0);

  // Regenerate wave origin every mount so the corner is random each time
  const plusGrid = useMemo(() => buildPlusGrid(), []);

  if (sessions.length === 0) {
    return (
      <div className="grid-empty-state">
        <div className={`plus-grid ${!showGridLines ? "no-grid-lines" : ""}`} aria-hidden>
          {showSymbols && plusGrid.map((p) => (
            <span
              key={p.key}
              className="plus-item"
              style={{ animationDelay: `${p.delay}s` }}
            >
              ×
            </span>
          ))}
        </div>
        <div className="empty-glyph">⬡</div>
        <h2>No active sessions</h2>
        <p>Launch a session to open a Claude Code terminal</p>
        <div className="empty-actions">
          <button className="btn-quick-empty" onClick={onQuickSession}>
            Quick Session
          </button>
          <button className="btn-primary btn-large" onClick={onNewSession}>
            + New Session
          </button>
        </div>
      </div>
    );
  }

  const showTabs = sessions.length > 4;
  const visibleStart = visiblePage * 4;
  const visibleIds = new Set(
    showTabs
      ? sessions.slice(visibleStart, visibleStart + 4).map((s) => s.id)
      : sessions.map((s) => s.id)
  );

  const visibleCount = Math.min(sessions.length, 4);
  const layoutClass = visibleCount === 1
    ? "grid-solo"
    : visibleCount === 2
    ? "grid-split"
    : visibleCount === 3
    ? "grid-triple"
    : "grid-quad";

  return (
    <div className="grid-wrapper">
      {showTabs && (
        <div className="session-tab-bar">
          <div className="session-tabs">
            {sessions.map((s, i) => (
              <button
                key={s.id}
                className={`session-tab ${focusedSessionId === s.id ? "active" : ""} ${visibleIds.has(s.id) ? "visible" : ""}`}
                onClick={() => {
                  const page = Math.floor(i / 4);
                  setVisiblePage(page);
                  onSessionFocus(s.id);
                }}
              >
                <span className="tab-dot" style={{ backgroundColor: s.color || "#f97316" }} />
                <span className="tab-label">{s.label}</span>
                <button
                  className="tab-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(s.id);
                  }}
                >
                  ×
                </button>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className={`session-grid ${layoutClass}`}>
        {sessions.map((session) => (
          <div
            key={session.id}
            className="session-pane-slot"
            style={{ display: visibleIds.has(session.id) ? "flex" : "none" }}
          >
            <SessionPane
              session={session}
              isFocused={focusedSessionId === session.id}
              bgOpacity={bgOpacity}
              onClose={() => onRemove(session.id)}
              onUpdate={(updates) => onUpdate(session.id, updates)}
              onFocus={() => onSessionFocus(session.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
