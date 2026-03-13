import { useEffect, useState } from "react";
import { Session, SavedSession } from "../types";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { buildResumeContext } from "../lib/summarizer";

interface SessionLibraryProps {
  onClose: () => void;
  onResume: (session: Session) => void;
}

export function SessionLibrary({ onClose, onResume }: SessionLibraryProps) {
  const [saved, setSaved] = useState<SavedSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "alpha" | "project">("recent");

  const loadAll = () => {
    invoke<SavedSession[]>("load_sessions")
      .then((sessions) => {
        setSaved(sessions.sort((a, b) => b.lastActiveAt - a.lastActiveAt));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { loadAll(); }, []);

  const handleDelete = async (id: string) => {
    try {
      await invoke("delete_session", { sessionId: id });
      setSaved((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  };

  const handleResume = (saved: SavedSession) => {
    console.log(`[resume] Session: ${saved.label}, Claude SID: ${saved.claudeSessionId || "NONE"}`);

    const resumeSession: Session = {
      id: `${saved.id}-resume-${Date.now()}`,
      label: saved.label,
      project: saved.project,
      workingDir: saved.workingDir,
      status: "active",
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      summary: saved.summary,
      claudeSessionId: saved.claudeSessionId,
    };
    onResume(resumeSession);
  };

  const handleNewFromContext = (saved: SavedSession) => {
    console.log(`[new+context] Session: ${saved.label}, pushing summary as context`);

    const context = buildResumeContext(saved.summary || "", saved.project);

    const freshSession: Session = {
      id: `${saved.id}-fresh-${Date.now()}`,
      label: saved.label,
      project: saved.project,
      workingDir: saved.workingDir,
      status: "active",
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      summary: saved.summary,
      resumeContext: context,
      // No claudeSessionId — forces a fresh instance
    };
    onResume(freshSession);
  };

  const handleExport = async (s: SavedSession) => {
    try {
      const path = await save({
        defaultPath: `${s.label.replace(/[^a-zA-Z0-9]/g, "_")}.md`,
        filters: [{ name: "Markdown", extensions: ["md"] }],
      });
      if (path) {
        await invoke("export_transcript", {
          path,
          label: s.label,
          project: s.project,
          summary: s.summary || "",
          transcript: typeof s.transcript === "string" ? s.transcript : "",
        });
      }
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  const formatAge = (ts: number) => {
    // Timestamps are stored as unix seconds — convert to ms for comparison
    const tsMs = ts < 1e12 ? ts * 1000 : ts;
    const diff = Date.now() - tsMs;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (mins > 0) return `${mins}m ago`;
    return "just now";
  };

  const filtered = saved
    .filter((s) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        s.label.toLowerCase().includes(q) ||
        s.project.toLowerCase().includes(q) ||
        (s.summary && s.summary.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      if (sortBy === "alpha") return a.label.localeCompare(b.label);
      if (sortBy === "project") return a.project.localeCompare(b.project) || b.lastActiveAt - a.lastActiveAt;
      return b.lastActiveAt - a.lastActiveAt;
    });

  return (
    <div className="library-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="library-panel">
        <div className="library-header">
          <h2>Session Library</h2>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>

        <div className="library-toolbar">
          <input
            className="field-input library-search"
            placeholder="Search sessions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <div className="library-sort">
            {(["recent", "alpha", "project"] as const).map((s) => (
              <button
                key={s}
                className={`sort-btn ${sortBy === s ? "active" : ""}`}
                onClick={() => setSortBy(s)}
              >
                {s === "recent" ? "Recent" : s === "alpha" ? "A-Z" : "Project"}
              </button>
            ))}
          </div>
        </div>

        <div className="library-body">
          {loading && <div className="library-loading">Loading sessions…</div>}
          {!loading && saved.length === 0 && (
            <div className="library-empty">
              <p>No saved sessions yet.</p>
              <p>Sessions are saved automatically when you close a pane.</p>
            </div>
          )}
          {!loading && saved.length > 0 && filtered.length === 0 && (
            <div className="library-empty">
              <p>No sessions match "{search}"</p>
            </div>
          )}
          {filtered.map((s) => (
            <div
              key={s.id}
              className={`session-card ${selected === s.id ? "selected" : ""}`}
              onClick={() => setSelected(selected === s.id ? null : s.id)}
            >
              <div className="session-card-top">
                <div className="session-card-meta">
                  <span className="session-card-label">{s.label}</span>
                  <span className="session-card-project">{s.project}</span>
                </div>
                <div className="session-card-right">
                  <span className="session-card-age">{formatAge(s.lastActiveAt)}</span>
                  {s.claudeSessionId && (
                    <button
                      className="btn-resume"
                      title="Resume the exact Claude session via --resume"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleResume(s);
                      }}
                    >
                      Resume
                    </button>
                  )}
                  <button
                    className="btn-context"
                    title="Start a fresh Claude instance with the session summary as context"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNewFromContext(s);
                    }}
                  >
                    New + Context
                  </button>
                  <button
                    className="btn-export"
                    title="Export transcript to markdown"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExport(s);
                    }}
                  >
                    Export
                  </button>
                  <button
                    className="btn-close"
                    title="Delete session"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(s.id);
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>

              {selected === s.id && s.summary && (
                <div className="session-card-summary">
                  <span className="summary-label">Last known state</span>
                  <p>{s.summary}</p>
                  <span className="summary-dir">{s.workingDir}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
