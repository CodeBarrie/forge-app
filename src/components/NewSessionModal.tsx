import { useState, useEffect } from "react";
import { Session } from "../types";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";

interface NewSessionModalProps {
  onClose: () => void;
  onCreate: (session: Session) => void;
}

const PROJECT_COLORS = ["#f97316", "#3b82f6", "#8b5cf6", "#10b981", "#ec4899", "#f59e0b"];

interface RecentProject {
  name: string;
  path: string;
}

function getRecentProjects(): RecentProject[] {
  try {
    return JSON.parse(localStorage.getItem("forge-recent-projects") || "[]");
  } catch {
    return [];
  }
}

// On first run, seed recent projects from saved sessions so existing users
// don't lose their quick-start buttons after this change
async function seedRecentProjectsFromHistory() {
  if (localStorage.getItem("forge-recent-projects") !== null) return;
  try {
    const sessions: Array<{ project: string; workingDir: string; lastActiveAt: number }> =
      await invoke("load_sessions");
    if (!sessions.length) return;
    // Deduplicate by path, keep most recent
    const byPath = new Map<string, RecentProject>();
    sessions
      .sort((a, b) => b.lastActiveAt - a.lastActiveAt)
      .forEach((s) => {
        if (s.workingDir && !byPath.has(s.workingDir)) {
          byPath.set(s.workingDir, { name: s.project, path: s.workingDir });
        }
      });
    const seeded = Array.from(byPath.values()).slice(0, 8);
    if (seeded.length) {
      localStorage.setItem("forge-recent-projects", JSON.stringify(seeded));
    }
  } catch {
    // No saved sessions — fresh install, nothing to seed
  }
}

function saveRecentProject(name: string, path: string) {
  const recents = getRecentProjects().filter((r) => r.path !== path);
  recents.unshift({ name, path });
  localStorage.setItem("forge-recent-projects", JSON.stringify(recents.slice(0, 8)));
}

export { saveRecentProject };

export function NewSessionModal({ onClose, onCreate }: NewSessionModalProps) {
  const [label, setLabel] = useState("");
  const [project, setProject] = useState("");
  const [workingDir, setWorkingDir] = useState("");
  const [dirWarning, setDirWarning] = useState("");
  const [colorIdx, setColorIdx] = useState(0);
  const [claudeSessionId, setClaudeSessionId] = useState("");
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>(getRecentProjects);

  // Seed recent projects from session history on first run
  useEffect(() => {
    if (recentProjects.length === 0 && localStorage.getItem("forge-recent-projects") === null) {
      seedRecentProjectsFromHistory().then(() => {
        setRecentProjects(getRecentProjects());
      });
    }
  }, []);

  const selectDir = async () => {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (typeof selected === "string") setWorkingDir(selected);
    } catch {
      // fallback: user can type it
    }
  };

  const handleCreate = () => {
    if (!label.trim() || !workingDir.trim()) return;

    saveRecentProject(project.trim() || label.trim(), workingDir.trim());

    const session: Session = {
      id: `session-${Date.now()}`,
      label: label.trim(),
      project: project.trim() || label.trim(),
      workingDir: workingDir.trim(),
      status: "active",
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      color: PROJECT_COLORS[colorIdx],
      ...(claudeSessionId.trim() ? { claudeSessionId: claudeSessionId.trim() } : {}),
    };
    onCreate(session);
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel">
        <div className="modal-header">
          <h2>New Session</h2>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Recent projects — built from usage */}
          {recentProjects.length > 0 && (
            <div className="field-group">
              <label>Recent Projects</label>
              <div className="quick-projects">
                {recentProjects.map((rp) => (
                  <button
                    key={rp.path}
                    className={`quick-project-btn ${project === rp.name ? "active" : ""}`}
                    onClick={() => {
                      setProject(rp.name);
                      if (!label) setLabel(rp.name);
                      setWorkingDir(rp.path);
                    }}
                  >
                    {rp.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="field-group">
            <label>Session Label</label>
            <input
              className="field-input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Phase 6 FFmpeg debug"
              autoFocus
            />
          </div>

          <div className="field-group">
            <label>Project</label>
            <input
              className="field-input"
              value={project}
              onChange={(e) => setProject(e.target.value)}
              placeholder="e.g. My Project"
            />
          </div>

          <div className="field-group">
            <label>Working Directory</label>
            <div className="dir-row">
              <input
                className="field-input"
                value={workingDir}
                onChange={(e) => setWorkingDir(e.target.value)}
                placeholder="Select a directory or type a path"
              />
              <button className="btn-ghost btn-browse" onClick={selectDir}>
                Browse
              </button>
            </div>
            {dirWarning && (
              <span className="dir-warning">{dirWarning}</span>
            )}
          </div>

          <div className="field-group">
            <label>Color Tag</label>
            <div className="color-row">
              {PROJECT_COLORS.map((c, i) => (
                <button
                  key={c}
                  className={`color-swatch ${i === colorIdx ? "active" : ""}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColorIdx(i)}
                />
              ))}
            </div>
          </div>

          <div className="field-group">
            <label>Claude Session ID <span style={{ color: "var(--accent-fire)", fontWeight: 300 }}>(optional — resume a previous session)</span></label>
            <input
              className="field-input"
              value={claudeSessionId}
              onChange={(e) => setClaudeSessionId(e.target.value)}
              placeholder="e.g. abc123-def456-..."
              style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            onClick={handleCreate}
            disabled={!label.trim() || !workingDir.trim()}
          >
            Launch Session →
          </button>
        </div>
      </div>
    </div>
  );
}
