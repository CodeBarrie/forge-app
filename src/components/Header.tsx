import { useState, useRef, useEffect } from "react";

interface HeaderProps {
  sessionCount: number;
  onNewSession: () => void;
  onQuickSession: () => void;
  onOpenLibrary: () => void;
  onOpenScreenshots: () => void;
  onOpenConsole: () => void;
  onToggleFiles: () => void;
  fileBrowserOpen: boolean;
  windowOpacity: number;
  onOpacityChange: (value: number) => void;
  showSymbols: boolean;
  onToggleSymbols: () => void;
  showGridLines: boolean;
  onToggleGridLines: () => void;
  layoutMode: string;
  onLayoutChange: (mode: string) => void;
}

export function Header({
  sessionCount,
  onNewSession,
  onQuickSession,
  onOpenLibrary,
  onOpenScreenshots,
  onOpenConsole,
  onToggleFiles,
  fileBrowserOpen,
  windowOpacity,
  onOpacityChange,
  showSymbols,
  onToggleSymbols,
  showGridLines,
  onToggleGridLines,
  layoutMode,
  onLayoutChange,
}: HeaderProps) {
  const [displayOpen, setDisplayOpen] = useState(false);
  const displayRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click
  useEffect(() => {
    if (!displayOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (displayRef.current && !displayRef.current.contains(e.target as Node)) {
        setDisplayOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [displayOpen]);

  return (
    <header className="forge-header">
      <div className="forge-wordmark">
        <span className="forge-logo">⬡</span>
        <span className="forge-name">FORGE</span>
        <span className="forge-tagline">by CodeBarrie</span>
        <span className="header-date-sep">|</span>
        <span className="header-date">{(() => { const d = new Date(); return `${String(d.getFullYear()).slice(-2)}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")}`; })()}</span>
      </div>
      <div className="forge-status">
        {sessionCount > 0 && (
          <span className="session-count">
            <span className="session-dot" />
            {sessionCount} active
          </span>
        )}
      </div>
      <div className="forge-actions">
        <div className="opacity-control" title={`Window opacity: ${Math.round(windowOpacity * 100)}%`}>
          <span className="opacity-icon">◐</span>
          <input
            type="range"
            className="opacity-slider"
            min="0"
            max="1"
            step="0.05"
            value={windowOpacity}
            onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
          />
        </div>
        <div className="display-control" ref={displayRef}>
          <button className="btn-ghost" onClick={() => setDisplayOpen((v) => !v)}>
            Display
          </button>
          {displayOpen && (
            <div className="display-popover">
              <h4>Display Settings</h4>
              <label className="display-toggle">
                <input type="checkbox" checked={showSymbols} onChange={onToggleSymbols} />
                <span>Symbols (x)</span>
              </label>
              <label className="display-toggle">
                <input type="checkbox" checked={showGridLines} onChange={onToggleGridLines} />
                <span>Grid Lines</span>
              </label>
              <div className="display-divider" />
              <h4>Layout</h4>
              <div className="layout-grid">
                {[
                  { id: "auto", label: "Auto", icon: "⊞" },
                  { id: "2x1", label: "2 Col", icon: "▥" },
                  { id: "1x2", label: "2 Row", icon: "▤" },
                  { id: "3x1", label: "3 Col", icon: "⫼" },
                  { id: "1x3", label: "3 Row", icon: "≡" },
                  { id: "quad", label: "2×2", icon: "⊞" },
                  { id: "3x2", label: "3×2", icon: "⊟" },
                  { id: "2x3", label: "2×3", icon: "⊡" },
                ].map((l) => (
                  <button
                    key={l.id}
                    className={`layout-btn ${layoutMode === l.id ? "active" : ""}`}
                    onClick={() => onLayoutChange(l.id)}
                    title={l.label}
                  >
                    <span className="layout-icon">{l.icon}</span>
                    <span className="layout-label">{l.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <button className={`btn-ghost${fileBrowserOpen ? " active" : ""}`} onClick={onToggleFiles}>
          Files
        </button>
        <button className="btn-ghost" onClick={onOpenConsole}>
          Console
        </button>
        <button className="btn-ghost" onClick={onOpenScreenshots}>
          Screenshots
        </button>
        <button className="btn-ghost" onClick={onOpenLibrary}>
          Sessions
        </button>
        <button className="btn-quick-header" data-label="Quick Session" onClick={onQuickSession}>
          Quick Session
        </button>
        <button className="btn-primary" onClick={onNewSession}>
          + New
        </button>
      </div>
    </header>
  );
}
