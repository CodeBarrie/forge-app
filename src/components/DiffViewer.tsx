import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Session } from "../types";

interface ChangedFile {
  path: string;
  status: string;
}

interface SessionFiles {
  sessionId: string;
  label: string;
  workingDir: string;
  files: ChangedFile[];
}

interface DiffViewerProps {
  onClose: () => void;
  sessions: Session[];
}

export function DiffViewer({ onClose, sessions }: DiffViewerProps) {
  const [sessionFiles, setSessionFiles] = useState<SessionFiles[]>([]);
  const [selectedFile, setSelectedFile] = useState<{ workingDir: string; path: string } | null>(null);
  const [diffContent, setDiffContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [diffLoading, setDiffLoading] = useState(false);

  const fetchChangedFiles = useCallback(async () => {
    setLoading(true);
    const results: SessionFiles[] = [];

    // Deduplicate working dirs
    const seen = new Set<string>();
    for (const session of sessions) {
      if (session.status === "closed" || seen.has(session.workingDir)) continue;
      seen.add(session.workingDir);
      try {
        const files = await invoke<ChangedFile[]>("get_git_changed_files", {
          workingDir: session.workingDir,
        });
        results.push({
          sessionId: session.id,
          label: session.label,
          workingDir: session.workingDir,
          files,
        });
      } catch {
        // Not a git repo or error — skip
      }
    }

    setSessionFiles(results);
    setLoading(false);
  }, [sessions]);

  useEffect(() => {
    fetchChangedFiles();
  }, [fetchChangedFiles]);

  const handleFileClick = useCallback(async (workingDir: string, filePath: string) => {
    setSelectedFile({ workingDir, path: filePath });
    setDiffLoading(true);
    try {
      const diff = await invoke<string>("get_git_diff", {
        workingDir,
        filePath,
      });
      setDiffContent(diff || "(No diff — file may be untracked or binary)");
    } catch (err) {
      setDiffContent(`Error loading diff: ${err}`);
    }
    setDiffLoading(false);
  }, []);

  const handleStage = useCallback(async (workingDir: string, filePath: string) => {
    try {
      await invoke("git_stage_file", { workingDir, filePath });
      await fetchChangedFiles();
      // Re-fetch diff if this file is selected
      if (selectedFile?.workingDir === workingDir && selectedFile?.path === filePath) {
        const diff = await invoke<string>("get_git_diff", { workingDir, filePath });
        setDiffContent(diff || "(No diff — file is staged)");
      }
    } catch (err) {
      console.error("Stage failed:", err);
    }
  }, [fetchChangedFiles, selectedFile]);

  const handleUnstage = useCallback(async (workingDir: string, filePath: string) => {
    try {
      await invoke("git_unstage_file", { workingDir, filePath });
      await fetchChangedFiles();
      if (selectedFile?.workingDir === workingDir && selectedFile?.path === filePath) {
        const diff = await invoke<string>("get_git_diff", { workingDir, filePath });
        setDiffContent(diff || "(No diff)");
      }
    } catch (err) {
      console.error("Unstage failed:", err);
    }
  }, [fetchChangedFiles, selectedFile]);

  const getStatusLabel = (status: string) => {
    if (status.includes("A") || status === "??") {
      if (status === "??") return { letter: "?", cls: "dv-status-untracked" };
      return { letter: "A", cls: "dv-status-added" };
    }
    if (status.includes("D")) return { letter: "D", cls: "dv-status-deleted" };
    if (status.includes("M")) return { letter: "M", cls: "dv-status-modified" };
    if (status.includes("R")) return { letter: "R", cls: "dv-status-modified" };
    return { letter: status.trim() || "?", cls: "dv-status-untracked" };
  };

  const isStaged = (status: string) => {
    // In porcelain format, first char is index status, second is worktree
    return status.length >= 1 && status[0] !== " " && status[0] !== "?" && status !== "!!";
  };

  const totalFiles = sessionFiles.reduce((sum, s) => sum + s.files.length, 0);

  const renderDiffLines = (content: string) => {
    const lines = content.split("\n");
    let lineNumOld = 0;
    let lineNumNew = 0;

    return lines.map((line, i) => {
      let cls = "dv-line";
      let oldNum = "";
      let newNum = "";

      // Parse hunk header for line numbers
      const hunkMatch = line.match(/^@@ -(\d+)/);
      if (hunkMatch) {
        lineNumOld = parseInt(hunkMatch[1]) - 1;
        const newMatch = line.match(/\+(\d+)/);
        lineNumNew = newMatch ? parseInt(newMatch[1]) - 1 : 0;
      }

      if (line.startsWith("diff ") || line.startsWith("index ") || line.startsWith("---") || line.startsWith("+++")) {
        cls += " dv-line-header";
      } else if (line.startsWith("@@")) {
        cls += " dv-line-hunk";
      } else if (line.startsWith("-")) {
        cls += " dv-line-del";
        lineNumOld++;
        oldNum = String(lineNumOld);
      } else if (line.startsWith("+")) {
        cls += " dv-line-add";
        lineNumNew++;
        newNum = String(lineNumNew);
      } else {
        lineNumOld++;
        lineNumNew++;
        oldNum = String(lineNumOld);
        newNum = String(lineNumNew);
      }

      return (
        <div key={i} className={cls}>
          <span className="dv-linenum">{oldNum}</span>
          <span className="dv-linenum">{newNum}</span>
          <span className="dv-line-text">{line}</span>
        </div>
      );
    });
  };

  return (
    <div className="dv-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dv-container">
        {/* Header */}
        <div className="dv-header">
          <div className="dv-header-left">
            <span className="dv-header-icon">&lt;/&gt;</span>
            <span className="dv-header-title">Git Changes</span>
            <span className="dv-header-count">{totalFiles} file{totalFiles !== 1 ? "s" : ""}</span>
          </div>
          <div className="dv-header-right">
            <button className="btn-ghost" onClick={fetchChangedFiles}>Refresh</button>
            <button className="dv-close" onClick={onClose}>&times;</button>
          </div>
        </div>

        <div className="dv-body">
          {/* File list */}
          <div className="dv-sidebar">
            {loading ? (
              <div className="dv-empty">Loading...</div>
            ) : totalFiles === 0 ? (
              <div className="dv-empty">No changes detected</div>
            ) : (
              sessionFiles.map((sf) =>
                sf.files.length > 0 ? (
                  <div key={sf.sessionId} className="dv-session-group">
                    <div className="dv-session-label">{sf.label}</div>
                    <div className="dv-session-dir">{sf.workingDir}</div>
                    {sf.files.map((file) => {
                      const { letter, cls } = getStatusLabel(file.status);
                      const active = selectedFile?.workingDir === sf.workingDir && selectedFile?.path === file.path;
                      const staged = isStaged(file.status);
                      return (
                        <div
                          key={file.path}
                          className={`dv-file-item${active ? " active" : ""}`}
                          onClick={() => handleFileClick(sf.workingDir, file.path)}
                        >
                          <span className={`dv-file-status ${cls}`}>{letter}</span>
                          <span className="dv-file-name" title={file.path}>
                            {file.path.split("/").pop() || file.path}
                          </span>
                          <span className="dv-file-path" title={file.path}>
                            {file.path.includes("/") ? file.path.substring(0, file.path.lastIndexOf("/")) : ""}
                          </span>
                          <div className="dv-file-actions">
                            {staged ? (
                              <button
                                className="dv-btn-unstage"
                                title="Unstage"
                                onClick={(e) => { e.stopPropagation(); handleUnstage(sf.workingDir, file.path); }}
                              >
                                -
                              </button>
                            ) : (
                              <button
                                className="dv-btn-stage"
                                title="Stage"
                                onClick={(e) => { e.stopPropagation(); handleStage(sf.workingDir, file.path); }}
                              >
                                +
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null
              )
            )}
          </div>

          {/* Diff panel */}
          <div className="dv-diff-panel">
            {!selectedFile ? (
              <div className="dv-diff-empty">Select a file to view its diff</div>
            ) : diffLoading ? (
              <div className="dv-diff-empty">Loading diff...</div>
            ) : (
              <div className="dv-diff-content">
                <div className="dv-diff-file-header">
                  {selectedFile.path}
                </div>
                <div className="dv-diff-lines">
                  {renderDiffLines(diffContent)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
