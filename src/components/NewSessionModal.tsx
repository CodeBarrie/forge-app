import { useState, useEffect } from "react";
import { Session } from "../types";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";

interface NewSessionModalProps {
  onClose: () => void;
  onCreate: (session: Session) => void;
}

const PROJECT_COLORS = ["#f97316", "#3b82f6", "#8b5cf6", "#10b981", "#ec4899", "#f59e0b"];

const DEFAULT_DIR = "C:\\Users\\Skate\\Documents\\__CLAUDE ZONE";

const QUICK_PROJECTS = [
  { name: "Shadow Server", path: "" },
  { name: "COT Edit Assistant", path: "" },
  { name: "WanGP / LTX", path: "" },
  { name: "CodeBarrie Site", path: "" },
];

export function NewSessionModal({ onClose, onCreate }: NewSessionModalProps) {
  const [label, setLabel] = useState("");
  const [project, setProject] = useState("");
  const [workingDir, setWorkingDir] = useState(DEFAULT_DIR);
  const [dirWarning, setDirWarning] = useState("");
  const [colorIdx, setColorIdx] = useState(0);

  useEffect(() => {
    invoke<boolean>("check_dir_exists", { path: DEFAULT_DIR })
      .then((exists) => {
        if (!exists) {
          setDirWarning(`Default directory not found: ${DEFAULT_DIR}`);
          setWorkingDir("");
        }
      })
      .catch(() => {
        setDirWarning(`Could not verify default directory`);
        setWorkingDir("");
      });
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

    const session: Session = {
      id: `session-${Date.now()}`,
      label: label.trim(),
      project: project.trim() || label.trim(),
      workingDir: workingDir.trim(),
      status: "active",
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      color: PROJECT_COLORS[colorIdx],
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
          {/* Quick project presets */}
          <div className="field-group">
            <label>Quick Start</label>
            <div className="quick-projects">
              {QUICK_PROJECTS.map((qp) => (
                <button
                  key={qp.name}
                  className={`quick-project-btn ${project === qp.name ? "active" : ""}`}
                  onClick={() => {
                    setProject(qp.name);
                    if (!label) setLabel(qp.name);
                    if (qp.path) setWorkingDir(qp.path);
                  }}
                >
                  {qp.name}
                </button>
              ))}
            </div>
          </div>

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
              placeholder="e.g. Shadow Server"
            />
          </div>

          <div className="field-group">
            <label>Working Directory</label>
            <div className="dir-row">
              <input
                className="field-input"
                value={workingDir}
                onChange={(e) => setWorkingDir(e.target.value)}
                placeholder="C:\Users\Skate\Documents\..."
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
