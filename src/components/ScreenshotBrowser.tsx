import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

interface ScreenshotInfo {
  path: string;
  name: string;
  modifiedAt: number;
  size: number;
}

interface ScreenshotBrowserProps {
  onClose: () => void;
  onSelect: (path: string) => void;
}

export function ScreenshotBrowser({ onClose, onSelect }: ScreenshotBrowserProps) {
  const [screenshotsDir, setScreenshotsDir] = useState<string | null>(
    () => localStorage.getItem("forge-screenshots-dir")
  );
  const [screenshots, setScreenshots] = useState<ScreenshotInfo[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const loadScreenshots = useCallback((dir: string) => {
    setLoading(true);
    invoke<ScreenshotInfo[]>("list_screenshots", { screenshotsDir: dir, limit: 30 })
      .then((result) => {
        setScreenshots(result);
        setLoading(false);
        result.slice(0, 12).forEach((s) => loadThumbnail(dir, s.path));
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (screenshotsDir) {
      loadScreenshots(screenshotsDir);
    } else {
      setLoading(false);
    }
  }, [screenshotsDir, loadScreenshots]);

  const loadThumbnail = useCallback(async (dir: string, path: string) => {
    try {
      const dataUrl = await invoke<string>("read_screenshot_thumbnail", {
        screenshotsDir: dir,
        path,
        maxWidth: 300,
      });
      setThumbnails((prev) => ({ ...prev, [path]: dataUrl }));
    } catch (err) {
      console.error("Failed to load thumbnail:", err);
    }
  }, []);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
        screenshots.forEach((s) => {
          if (!thumbnails[s.path] && screenshotsDir) loadThumbnail(screenshotsDir, s.path);
        });
      }
    },
    [screenshots, thumbnails, loadThumbnail, screenshotsDir]
  );

  const chooseDirectory = async () => {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (typeof selected === "string") {
        localStorage.setItem("forge-screenshots-dir", selected);
        setScreenshotsDir(selected);
        setThumbnails({});
      }
    } catch {
      // user cancelled
    }
  };

  const formatAge = (ts: number) => {
    const diff = Date.now() / 1000 - ts;
    const mins = Math.floor(diff / 60);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (mins > 0) return `${mins}m ago`;
    return "just now";
  };

  const formatSize = (bytes: number) => {
    if (bytes > 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  const parseScreenshotName = (name: string) => {
    const match = name.match(/Screenshot (\d{4}-\d{2}-\d{2}) (\d{6})/);
    if (match) {
      const [, date, time] = match;
      const t = `${time.slice(0, 2)}:${time.slice(2, 4)}`;
      return { date, time: t };
    }
    return { date: "", time: name };
  };

  return (
    <div
      className="library-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="screenshot-panel">
        <div className="library-header">
          <h2>Screenshots</h2>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              className="btn-ghost"
              style={{ fontSize: "11px", padding: "4px 10px" }}
              onClick={chooseDirectory}
              title={screenshotsDir || "Choose screenshots folder"}
            >
              {screenshotsDir ? "Change Folder" : "Set Folder"}
            </button>
            <span className="screenshot-count">
              {screenshots.length} recent
            </span>
            <button className="btn-close" onClick={onClose}>
              ×
            </button>
          </div>
        </div>

        {preview && (
          <div
            className="screenshot-preview-overlay"
            onClick={() => setPreview(null)}
          >
            <img
              src={thumbnails[preview] || ""}
              alt="Preview"
              className="screenshot-preview-img"
            />
          </div>
        )}

        <div className="screenshot-grid-container" onScroll={handleScroll}>
          {!screenshotsDir && !loading && (
            <div className="library-empty">
              <p>No screenshots directory configured.</p>
              <button
                className="btn-primary"
                style={{ marginTop: "12px" }}
                onClick={chooseDirectory}
              >
                Choose Screenshots Folder
              </button>
            </div>
          )}
          {screenshotsDir && loading && (
            <div className="library-loading">Scanning screenshots...</div>
          )}
          {screenshotsDir && !loading && screenshots.length === 0 && (
            <div className="library-empty">
              <p>No screenshots found in this folder.</p>
              <button
                className="btn-ghost"
                style={{ marginTop: "8px", fontSize: "11px" }}
                onClick={chooseDirectory}
              >
                Choose Different Folder
              </button>
            </div>
          )}
          <div className="screenshot-grid">
            {screenshots.map((s) => {
              const { date, time } = parseScreenshotName(s.name);
              const isSelected = selected === s.path;
              return (
                <div
                  key={s.path}
                  className={`screenshot-card ${isSelected ? "selected" : ""}`}
                  onClick={() => setSelected(isSelected ? null : s.path)}
                  onDoubleClick={() => {
                    onSelect(s.path);
                    onClose();
                  }}
                >
                  <div className="screenshot-thumb">
                    {thumbnails[s.path] ? (
                      <img
                        src={thumbnails[s.path]}
                        alt={s.name}
                        loading="lazy"
                        onLoad={() => {}}
                      />
                    ) : (
                      <div className="screenshot-thumb-loading">
                        <span className="thumb-spinner" />
                      </div>
                    )}
                  </div>
                  <div className="screenshot-info">
                    <span className="screenshot-time">{time}</span>
                    <span className="screenshot-date">{date}</span>
                    <span className="screenshot-size">{formatSize(s.size)}</span>
                  </div>
                  {isSelected && (
                    <div className="screenshot-actions">
                      <button
                        className="btn-primary"
                        style={{ fontSize: "11px", padding: "4px 10px" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect(s.path);
                          onClose();
                        }}
                      >
                        Paste Path
                      </button>
                      <button
                        className="btn-ghost"
                        style={{ fontSize: "11px", padding: "4px 10px" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreview(s.path);
                        }}
                      >
                        Preview
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
