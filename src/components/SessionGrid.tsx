import { useState, useRef, useMemo, useCallback, useLayoutEffect, useEffect } from "react";
import { Session } from "../types";
import { SessionPane } from "./SessionPane";

// ── Wireframe Sphere (canvas-based, math-projected) ──────────────────────
function WireframeSphere() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = 76 * 2; // 2x for retina
    canvas.width = size;
    canvas.height = size;
    const R = size / 2 - 4; // radius with padding
    const cx = size / 2;
    const cy = size / 2;
    const numMeridians = 16;
    const numParallels = 7;
    let rotation = 0;

    function draw() {
      ctx!.clearRect(0, 0, size, size);
      ctx!.strokeStyle = "rgba(255, 255, 255, 0.3)";
      ctx!.lineWidth = 1.2;

      // Draw latitude lines (parallels)
      for (let i = 1; i <= numParallels; i++) {
        const lat = (Math.PI * i) / (numParallels + 1) - Math.PI / 2;
        const r = R * Math.cos(lat);
        const y = cy - R * Math.sin(lat);
        ctx!.beginPath();
        ctx!.ellipse(cx, y, r, r * 0.3, 0, 0, Math.PI * 2);
        ctx!.stroke();
      }

      // Draw meridian lines (longitudes) — these rotate
      for (let i = 0; i < numMeridians; i++) {
        const lon = (2 * Math.PI * i) / numMeridians + rotation;
        const sinLon = Math.sin(lon);
        const cosLon = Math.cos(lon);

        // Only draw front-facing meridians (cosLon > 0 means front)
        const alpha = Math.max(0, cosLon) * 0.4 + 0.05;
        ctx!.strokeStyle = `rgba(255, 255, 255, ${alpha})`;

        ctx!.beginPath();
        for (let j = 0; j <= 64; j++) {
          const lat = (Math.PI * j) / 64 - Math.PI / 2;
          const x = cx + R * Math.cos(lat) * sinLon;
          const y = cy - R * Math.sin(lat);
          if (j === 0) ctx!.moveTo(x, y);
          else ctx!.lineTo(x, y);
        }
        ctx!.stroke();
      }

      rotation += 0.003; // very slow rotation
      animId = requestAnimationFrame(draw);
    }

    let animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="orb-wireframe-canvas"
      style={{ width: 76, height: 76 }}
    />
  );
}

// Generate a grid of "+" with wave-delay metadata
const COLS = 28;
const ROWS = 18;

function buildPlusGrid() {
  const originCol = COLS - 1;
  const originRow = ROWS - 1;
  const maxDist = Math.sqrt(originCol ** 2 + originRow ** 2);

  const items: { key: number; delay: number }[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const dist = Math.sqrt((c - originCol) ** 2 + (r - originRow) ** 2);
      const delay = (dist / maxDist) * 1.2;
      items.push({ key: r * COLS + c, delay });
    }
  }
  return items;
}

function PowerClock() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, "0");
      const m = String(now.getMinutes()).padStart(2, "0");
      const s = String(now.getSeconds()).padStart(2, "0");
      setTime(`${h}:${m}:${s}`);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="power-clock">
      <div className="power-clock-time">{time}</div>
      <div className="power-clock-label">CHRONOS ADVANCES</div>
      <div className="power-clock-kanji">時は進む</div>
    </div>
  );
}

interface SessionGridProps {
  sessions: Session[];
  focusedSessionId: string | null;
  bgOpacity: number;
  soundEnabled: boolean;
  terminalFontSize: number;
  layoutMode: string;
  showSymbols: boolean;
  showGridLines: boolean;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Session>) => void;
  onReorder: (fromIdx: number, toIdx: number) => void;
  onNewSession: () => void;
  onQuickSession: () => void;
  onSessionFocus: (id: string) => void;
  onDropPromptFile?: (filePath: string) => void;
}

export function SessionGrid({ sessions, focusedSessionId, bgOpacity, soundEnabled, terminalFontSize, layoutMode, showSymbols, showGridLines, onRemove, onUpdate, onReorder, onNewSession, onQuickSession, onSessionFocus, onDropPromptFile }: SessionGridProps) {
  const [visiblePage, setVisiblePage] = useState(0);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);

  // Pointer-based drag state (refs to avoid stale closures)
  const dragRef = useRef<{
    idx: number;
    startX: number;
    startY: number;
    active: boolean;
    ghost: HTMLDivElement | null;
  } | null>(null);
  const dropRef = useRef<number | null>(null);
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;

  // FLIP animation: snapshot positions before reorder, animate after
  const rectsRef = useRef<Map<string, DOMRect>>(new Map());
  const flipPending = useRef(false);

  // Snapshot current positions before a reorder
  const snapshotPositions = useCallback(() => {
    const map = new Map<string, DOMRect>();
    document.querySelectorAll<HTMLDivElement>("[data-slot-id]").forEach((el) => {
      const id = el.getAttribute("data-slot-id")!;
      map.set(id, el.getBoundingClientRect());
    });
    rectsRef.current = map;
    flipPending.current = true;
  }, []);

  // After render, animate from old position to new
  useLayoutEffect(() => {
    if (!flipPending.current) return;
    flipPending.current = false;
    const oldRects = rectsRef.current;
    if (oldRects.size === 0) return;

    document.querySelectorAll<HTMLDivElement>("[data-slot-id]").forEach((el) => {
      const id = el.getAttribute("data-slot-id")!;
      const oldRect = oldRects.get(id);
      if (!oldRect) return;
      const newRect = el.getBoundingClientRect();
      const dx = oldRect.left - newRect.left;
      const dy = oldRect.top - newRect.top;
      if (dx === 0 && dy === 0) return;

      // Invert: jump to old position
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      el.style.transition = "none";

      // Play: animate to new position
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.style.transition = "transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
          el.style.transform = "";
        });
      });
    });
  }, [sessions]);

  const plusGrid = useMemo(() => buildPlusGrid(), []);

  const cleanupDrag = useCallback(() => {
    if (dragRef.current?.ghost) {
      dragRef.current.ghost.remove();
    }
    dragRef.current = null;
    dropRef.current = null;
    setDragIdx(null);
    setDropIdx(null);
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
    const cs = document.getElementById("forge-drag-cursor");
    if (cs) cs.remove();
  }, []);

  const handleGripPointerDown = useCallback((e: React.PointerEvent, idx: number) => {
    if (e.button !== 0) return;
    e.preventDefault();

    dragRef.current = {
      idx,
      startX: e.clientX,
      startY: e.clientY,
      active: false,
      ghost: null,
    };

    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = ev.clientX - d.startX;
      const dy = ev.clientY - d.startY;

      // 6px threshold to activate
      if (!d.active && Math.abs(dx) + Math.abs(dy) < 6) return;

      if (!d.active) {
        d.active = true;
        setDragIdx(d.idx);
        document.body.style.userSelect = "none";
        const cs = document.createElement("style");
        cs.id = "forge-drag-cursor";
        cs.textContent = "* { cursor: grabbing !important; }";
        document.head.appendChild(cs);

        // Create ghost
        const ghost = document.createElement("div");
        ghost.className = "drag-ghost";
        ghost.textContent = sessions[d.idx]?.label || "Session";
        document.body.appendChild(ghost);
        d.ghost = ghost;
      }

      // Move ghost
      if (d.ghost) {
        d.ghost.style.left = `${ev.clientX + 12}px`;
        d.ghost.style.top = `${ev.clientY - 16}px`;
      }

      // Hit-test: find which slot the cursor is over
      const slots = document.querySelectorAll<HTMLDivElement>("[data-slot-idx]");
      let hitIdx: number | null = null;
      slots.forEach((slot) => {
        const rect = slot.getBoundingClientRect();
        if (
          ev.clientX >= rect.left && ev.clientX <= rect.right &&
          ev.clientY >= rect.top && ev.clientY <= rect.bottom
        ) {
          const si = parseInt(slot.getAttribute("data-slot-idx")!, 10);
          if (si !== d.idx) hitIdx = si;
        }
      });
      dropRef.current = hitIdx;
      setDropIdx(hitIdx);
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);

      const d = dragRef.current;
      const target = dropRef.current;
      if (d?.active && target !== null) {
        snapshotPositions();
        onReorderRef.current(d.idx, target);
      }

      // Fade ghost out
      if (d?.ghost) {
        d.ghost.style.transition = "opacity 0.15s, transform 0.15s";
        d.ghost.style.opacity = "0";
        d.ghost.style.transform = "scale(0.9)";
        const g = d.ghost;
        setTimeout(() => g.remove(), 150);
        d.ghost = null;
      }

      cleanupDrag();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }, [sessions, cleanupDrag, snapshotPositions]);

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
        <div className="forge-orb">
          {/* Back halves of rings — behind sphere */}
          <div className="orb-ring orb-ring-1 orb-ring-back" />
          <div className="orb-ring orb-ring-2 orb-ring-back" />
          <div className="orb-ring orb-ring-3 orb-ring-back" />
          {/* Sphere with canvas wireframe */}
          <div className="orb-sphere">
            <WireframeSphere />
          </div>
          {/* Front halves of rings — on top of sphere */}
          <div className="orb-ring orb-ring-1 orb-ring-front" />
          <div className="orb-ring orb-ring-2 orb-ring-front" />
          <div className="orb-ring orb-ring-3 orb-ring-front" />
        </div>
        <PowerClock />
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

  const pageSize = layoutMode === "3x2" ? 6
    : layoutMode === "2x3" ? 6
    : layoutMode === "3x1" ? 3
    : layoutMode === "1x3" ? 3
    : 4;
  const showTabs = sessions.length > pageSize;
  const visibleStart = visiblePage * pageSize;
  const visibleIds = new Set(
    showTabs
      ? sessions.slice(visibleStart, visibleStart + pageSize).map((s) => s.id)
      : sessions.map((s) => s.id)
  );

  const visibleCount = visibleIds.size;
  const layoutClass = layoutMode !== "auto"
    ? `grid-${layoutMode}`
    : visibleCount === 1
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
                  const page = Math.floor(i / pageSize);
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
        {sessions.map((session, i) => (
          <div
            key={session.id}
            data-slot-idx={i}
            data-slot-id={session.id}
            className={`session-pane-slot ${dragIdx === i ? "dragging" : ""} ${dropIdx === i ? "drop-target" : ""}`}
            style={{ display: visibleIds.has(session.id) ? "flex" : "none" }}
          >
            <div
              className="drag-handle"
              onPointerDown={(e) => handleGripPointerDown(e, i)}
            >
              <span className="drag-grip">⋮⋮</span>
            </div>
            <SessionPane
              session={session}
              isFocused={focusedSessionId === session.id}
              bgOpacity={bgOpacity}
              soundEnabled={soundEnabled}
              terminalFontSize={terminalFontSize}
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
