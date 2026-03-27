import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { startFileDrag, setRecentCallback } from "../lib/fileDrag";

interface DirEntry {
  name: string;
  isDir: boolean;
  size: number;
  extension: string | null;
}

interface TreeNode extends DirEntry {
  path: string;
  children?: TreeNode[];
  expanded?: boolean;
  loaded?: boolean;
}

interface FileBrowserProps {
  open: boolean;
  onClose: () => void;
}

// Dynamic: resolved at mount via get_home_dir command
const DEFAULT_ROOT = "";

const EXT_ICONS: Record<string, string> = {
  ts: "\u{1D54B}",  tsx: "\u{1D54B}",
  js: "\u{1D541}",  jsx: "\u{1D541}",
  rs: "\u{211B}",
  py: "\u{1D513}",
  json: "{}",
  toml: "\u2699",
  yaml: "\u2699",  yml: "\u2699",
  md: "\u2193",
  css: "#",
  html: "<>",
  svg: "\u25CB",
  png: "\u25A3",  jpg: "\u25A3",  jpeg: "\u25A3",  webp: "\u25A3",  gif: "\u25A3",
  lock: "\u2416",
  txt: "\u2261",
  sh: "$",   bat: "$",   cmd: "$",   ps1: "$",
  exe: "\u25B6",
  dll: "\u229E",
  zip: "\u2338",  tar: "\u2338",  gz: "\u2338",
};

function getFileIcon(entry: DirEntry): string {
  if (entry.isDir) return "\u25B8";
  const ext = entry.extension?.toLowerCase() || "";
  return EXT_ICONS[ext] || "\u2022";
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileBrowser({ open, onClose }: FileBrowserProps) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (open) {
      setVisible(true);
      setClosing(false);
      setEntered(false);
      // Wait one frame for DOM mount, then trigger transition
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setEntered(true);
        });
      });
    } else if (visible) {
      setEntered(false);
      setClosing(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setClosing(false);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const [homeDir, setHomeDir] = useState(DEFAULT_ROOT);
  const [currentPath, setCurrentPath] = useState(DEFAULT_ROOT);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const homeDirResolved = useRef(false);

  // Resolve home directory on first mount
  useEffect(() => {
    if (homeDirResolved.current) return;
    homeDirResolved.current = true;
    invoke<string>("get_home_dir").then((dir) => {
      setHomeDir(dir);
      if (!currentPath) {
        setCurrentPath(dir);
        setHistory([dir]);
      }
    }).catch(() => {});
  }, []);

  // Navigation history
  const [history, setHistory] = useState<string[]>([DEFAULT_ROOT]);
  const [historyIdx, setHistoryIdx] = useState(0);

  // Recent files (persisted)
  const [recentFiles, setRecentFiles] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("forge-recent-files") || "[]");
    } catch { return []; }
  });

  const addRecent = useCallback((path: string) => {
    setRecentFiles((prev) => {
      const next = [path, ...prev.filter((p) => p !== path)].slice(0, 8);
      localStorage.setItem("forge-recent-files", JSON.stringify(next));
      return next;
    });
  }, []);

  // Register so drops also add to recents
  useEffect(() => {
    setRecentCallback(addRecent);
  }, [addRecent]);

  // Load root directory
  const loadDirectory = useCallback(async (path: string, addToHistory = true) => {
    setLoading(true);
    setError(null);
    try {
      const entries = await invoke<DirEntry[]>("list_directory", { path });
      const nodes: TreeNode[] = entries.map((e) => ({
        ...e,
        path: `${path}\\${e.name}`,
        expanded: false,
        loaded: false,
      }));
      setTree(nodes);
      setCurrentPath(path);
      if (addToHistory) {
        setHistory((prev) => {
          const trimmed = prev.slice(0, historyIdx + 1);
          return [...trimmed, path];
        });
        setHistoryIdx((prev) => prev + 1);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [historyIdx]);

  const goBack = useCallback(() => {
    if (historyIdx > 0) {
      const newIdx = historyIdx - 1;
      setHistoryIdx(newIdx);
      loadDirectory(history[newIdx], false);
    }
  }, [historyIdx, history, loadDirectory]);

  const goForward = useCallback(() => {
    if (historyIdx < history.length - 1) {
      const newIdx = historyIdx + 1;
      setHistoryIdx(newIdx);
      loadDirectory(history[newIdx], false);
    }
  }, [historyIdx, history, loadDirectory]);

  const goHome = useCallback(() => {
    loadDirectory(homeDir);
  }, [loadDirectory, homeDir]);

  useEffect(() => {
    if (open) {
      loadDirectory(currentPath, false);
      setTimeout(() => filterRef.current?.focus(), 100);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Toggle expand a folder in the tree
  const toggleExpand = useCallback(async (nodePath: string) => {
    setTree((prev) => {
      const update = (nodes: TreeNode[]): TreeNode[] =>
        nodes.map((n) => {
          if (n.path === nodePath) {
            if (n.isDir) {
              if (!n.loaded) {
                // Load children async, then update
                invoke<DirEntry[]>("list_directory", { path: n.path })
                  .then((entries) => {
                    const children: TreeNode[] = entries.map((e) => ({
                      ...e,
                      path: `${nodePath}\\${e.name}`,
                      expanded: false,
                      loaded: false,
                    }));
                    setTree((current) => {
                      const applyChildren = (ns: TreeNode[]): TreeNode[] =>
                        ns.map((node) => {
                          if (node.path === nodePath) {
                            return { ...node, children, loaded: true, expanded: true };
                          }
                          if (node.children) {
                            return { ...node, children: applyChildren(node.children) };
                          }
                          return node;
                        });
                      return applyChildren(current);
                    });
                  })
                  .catch(() => {});
                return { ...n, expanded: true };
              }
              return { ...n, expanded: !n.expanded };
            }
            return n;
          }
          if (n.children) {
            return { ...n, children: update(n.children) };
          }
          return n;
        });
      return update(prev);
    });
  }, []);


  // Right-click to copy path
  const handleContextMenu = useCallback((e: React.MouseEvent, path: string) => {
    e.preventDefault();
    navigator.clipboard.writeText(path).catch(() => {});
  }, []);

  // Breadcrumb navigation
  const breadcrumbs = currentPath.split("\\").filter(Boolean);

  const navigateToBreadcrumb = useCallback((index: number) => {
    const parts = currentPath.split("\\").filter(Boolean);
    const newPath = parts.slice(0, index + 1).join("\\");
    loadDirectory(newPath, true);
  }, [currentPath, loadDirectory]);

  // Filter tree nodes recursively
  const filterNodes = useCallback((nodes: TreeNode[], query: string): TreeNode[] => {
    if (!query) return nodes;
    const q = query.toLowerCase();
    return nodes.filter((n) => {
      if (n.name.toLowerCase().includes(q)) return true;
      if (n.children) {
        const filtered = filterNodes(n.children, query);
        return filtered.length > 0;
      }
      return false;
    });
  }, []);

  // Render tree node
  const renderNode = (node: TreeNode, depth: number = 0): JSX.Element => {
    const icon = node.isDir
      ? (node.expanded ? "\u25BE" : "\u25B8")
      : getFileIcon(node);

    return (
      <div key={node.path}>
        <div
          className="fb-tree-item"
          style={{ paddingLeft: `${12 + depth * 16}px` }}
          onMouseDown={(e) => {
            if (e.button === 0) {
              // Store for potential drag — only start if mouse moves
              const startX = e.clientX;
              const startY = e.clientY;
              const path = node.path;
              const name = node.name;
              const onMove = (me: MouseEvent) => {
                if (Math.abs(me.clientX - startX) > 5 || Math.abs(me.clientY - startY) > 5) {
                  document.removeEventListener("mousemove", onMove);
                  document.removeEventListener("mouseup", onUp);
                  startFileDrag(path, name, e);
                }
              };
              const onUp = () => {
                document.removeEventListener("mousemove", onMove);
                document.removeEventListener("mouseup", onUp);
              };
              document.addEventListener("mousemove", onMove);
              document.addEventListener("mouseup", onUp);
            }
          }}
          onClick={() => {
            if (node.isDir) {
              toggleExpand(node.path);
            } else {
              addRecent(node.path);
            }
          }}
          onContextMenu={(e) => handleContextMenu(e, node.path)}
          title={`${node.path}\nRight-click to copy path · Drag to terminal`}
        >
          <span className={`fb-icon ${node.isDir ? "fb-icon-dir" : "fb-icon-file"}`}>
            {icon}
          </span>
          <span className="fb-name">{node.name}</span>
        </div>
        {node.isDir && node.expanded && node.children && (
          <div className="fb-tree-children">
            {filterNodes(node.children, filter).map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (!visible) return null;


  return (
    <div className={`fb-sidebar${entered ? " fb-entered" : ""}${closing ? " fb-closing" : ""}`}>
      <div className="fb-header">
        <div className="fb-title-row">
          <div className="fb-nav-buttons">
            <button
              className="fb-nav-btn"
              onClick={goBack}
              disabled={historyIdx <= 0}
              title="Back"
            >
              {"\u2190"}
            </button>
            <button
              className="fb-nav-btn"
              onClick={goForward}
              disabled={historyIdx >= history.length - 1}
              title="Forward"
            >
              {"\u2192"}
            </button>
            <button
              className="fb-nav-btn"
              onClick={goHome}
              title="Home"
            >
              {"\u2302"}
            </button>
          </div>
          <span className="fb-title">Files</span>
          <button className="fb-close" onClick={onClose} title="Close · Ctrl+E">
            {"\u2715"}
          </button>
        </div>
        <input
          ref={filterRef}
          className="fb-filter"
          type="text"
          placeholder="Filter files..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <div className="fb-breadcrumbs">
          {breadcrumbs.map((part, i) => (
            <span key={i}>
              {i > 0 && <span className="fb-bread-sep">/</span>}
              <button
                className="fb-bread-btn"
                onClick={() => navigateToBreadcrumb(i)}
              >
                {part}
              </button>
            </span>
          ))}
        </div>
        {recentFiles.length > 0 && (
          <div className="fb-recent">
            <span className="fb-recent-label">Recent</span>
            {recentFiles.map((path) => (
              <button
                key={path}
                className="fb-recent-item"
                onClick={() => {
                  const dir = path.substring(0, path.lastIndexOf("\\"));
                  if (dir !== currentPath) loadDirectory(dir);
                }}
                onMouseDown={(e) => {
                  if (e.button === 0) {
                    const startX = e.clientX;
                    const startY = e.clientY;
                    const name = path.split("\\").pop() || "";
                    const onMove = (me: MouseEvent) => {
                      if (Math.abs(me.clientX - startX) > 5 || Math.abs(me.clientY - startY) > 5) {
                        document.removeEventListener("mousemove", onMove);
                        document.removeEventListener("mouseup", onUp);
                        startFileDrag(path, name, e);
                      }
                    };
                    const onUp = () => {
                      document.removeEventListener("mousemove", onMove);
                      document.removeEventListener("mouseup", onUp);
                    };
                    document.addEventListener("mousemove", onMove);
                    document.addEventListener("mouseup", onUp);
                  }
                }}
                title={path}
              >
                {path.split("\\").pop()}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="fb-tree-container">
        {loading && <div className="fb-loading">Loading...</div>}
        {error && <div className="fb-error">{error}</div>}
        {!loading && !error && filterNodes(tree, filter).map((node) => renderNode(node, 0))}
      </div>

    </div>
  );
}
