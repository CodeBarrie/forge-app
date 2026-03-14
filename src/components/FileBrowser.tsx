import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { startFileDrag } from "../lib/fileDrag";

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

const DEFAULT_ROOT = "C:\\Users\\Skate\\Documents\\__CLAUDE ZONE";

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

  const [currentPath, setCurrentPath] = useState(DEFAULT_ROOT);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [filter, setFilter] = useState("");
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const filterRef = useRef<HTMLInputElement>(null);

  // Load root directory
  const loadDirectory = useCallback(async (path: string) => {
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
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadDirectory(currentPath);
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

  // File preview
  const openPreview = useCallback(async (path: string) => {
    setPreviewPath(path);
    setPreviewLoading(true);
    try {
      const content = await invoke<string>("read_file_preview", { path });
      setPreviewContent(content);
    } catch (err) {
      setPreviewContent(`Error reading file: ${err}`);
    } finally {
      setPreviewLoading(false);
    }
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
    loadDirectory(newPath);
    setPreviewPath(null);
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
          className={`fb-tree-item ${previewPath === node.path ? "fb-tree-active" : ""}`}
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
              openPreview(node.path);
            }
          }}
          onContextMenu={(e) => handleContextMenu(e, node.path)}
          title={`${node.path}\nRight-click to copy path · Drag to terminal`}
        >
          <span className={`fb-icon ${node.isDir ? "fb-icon-dir" : "fb-icon-file"}`}>
            {icon}
          </span>
          <span className="fb-name">{node.name}</span>
          {!node.isDir && (
            <span className="fb-size">{formatSize(node.size)}</span>
          )}
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

  const previewExt = previewPath?.split(".").pop()?.toLowerCase() || "";

  return (
    <div className={`fb-sidebar${entered ? " fb-entered" : ""}${closing ? " fb-closing" : ""}`}>
      <div className="fb-header">
        <div className="fb-title-row">
          <span className="fb-title">Files</span>
          <button className="fb-close" onClick={onClose} title="Close (Ctrl+E)">
            \u2715
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
      </div>

      <div className="fb-tree-container">
        {loading && <div className="fb-loading">Loading...</div>}
        {error && <div className="fb-error">{error}</div>}
        {!loading && !error && filterNodes(tree, filter).map((node) => renderNode(node, 0))}
      </div>

      {previewPath && (
        <div className="fb-preview-panel">
          <div className="fb-preview-header">
            <span className="fb-preview-name">
              {previewPath.split("\\").pop()}
            </span>
            <button
              className="fb-close"
              onClick={() => setPreviewPath(null)}
            >
              \u2715
            </button>
          </div>
          <div className="fb-preview-content">
            {previewLoading ? (
              <div className="fb-loading">Loading preview...</div>
            ) : (
              <pre className={`fb-preview-code lang-${previewExt}`}>
                {previewContent}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
