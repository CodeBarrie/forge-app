import { useState, useEffect, useRef, useMemo } from "react";

export interface CommandAction {
  id: string;
  label: string;
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  actions: CommandAction[];
  onClose: () => void;
}

export function CommandPalette({ actions, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!query) return actions;
    const q = query.toLowerCase();
    return actions.filter((a) => a.label.toLowerCase().includes(q));
  }, [query, actions]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      filtered[selectedIndex].action();
      onClose();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <div className="command-header">
          <span className="command-icon">⌘</span>
          <input
            ref={inputRef}
            className="command-input"
            placeholder="Type a command..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div className="command-list">
          {filtered.map((action, i) => (
            <button
              key={action.id}
              className={`command-item ${i === selectedIndex ? "selected" : ""}`}
              onClick={() => { action.action(); onClose(); }}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <span className="command-label">{action.label}</span>
              {action.shortcut && <span className="command-shortcut">{action.shortcut}</span>}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="command-empty">No matching commands</div>
          )}
        </div>
      </div>
    </div>
  );
}
