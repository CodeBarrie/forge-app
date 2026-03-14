import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { PromptTemplate, Session } from "../types";

const CATEGORIES = ["Review", "Debug", "Refactor", "Test", "General"] as const;

const BUILTIN_TEMPLATES: PromptTemplate[] = [
  {
    id: "builtin-code-review",
    name: "Code Review",
    text: "Review this code for bugs, performance issues, and best practices",
    category: "Review",
  },
  {
    id: "builtin-write-tests",
    name: "Write Tests",
    text: "Write comprehensive tests for the current code",
    category: "Test",
  },
  {
    id: "builtin-refactor",
    name: "Refactor",
    text: "Refactor this code to be cleaner and more maintainable",
    category: "Refactor",
  },
  {
    id: "builtin-explain",
    name: "Explain",
    text: "Explain what this code does step by step",
    category: "General",
  },
  {
    id: "builtin-debug",
    name: "Debug",
    text: "Help me debug this issue:",
    category: "Debug",
  },
];

const CATEGORY_COLORS: Record<string, string> = {
  Review: "#3b82f6",
  Debug: "#ef4444",
  Refactor: "#a855f7",
  Test: "#4ade80",
  General: "#fbbf24",
};

interface PromptTemplatesProps {
  onClose: () => void;
  focusedSessionId: string | null;
  sessions: Session[];
  addToast: (text: string, type?: "info" | "success" | "error") => void;
}

export function PromptTemplates({
  onClose,
  focusedSessionId,
  sessions,
  addToast,
}: PromptTemplatesProps) {
  const [savedTemplates, setSavedTemplates] = useState<PromptTemplate[]>([]);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState<string>("General");
  const [formText, setFormText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Load saved templates
  useEffect(() => {
    invoke<PromptTemplate[]>("load_prompt_templates")
      .then(setSavedTemplates)
      .catch(() => {});
  }, []);

  const allTemplates = useMemo(() => {
    return [...BUILTIN_TEMPLATES, ...savedTemplates];
  }, [savedTemplates]);

  const filtered = useMemo(() => {
    let list = allTemplates;
    if (categoryFilter) {
      list = list.filter((t) => t.category === categoryFilter);
    }
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.text.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q)
      );
    }
    return list;
  }, [allTemplates, query, categoryFilter]);

  const handleUse = useCallback(
    (template: PromptTemplate) => {
      const targetId =
        focusedSessionId ||
        (sessions.length > 0 ? sessions[0].id : null);

      if (!targetId) {
        addToast("No active session to send template to", "error");
        return;
      }

      const targetSession = sessions.find((s) => s.id === targetId);
      if (targetSession && targetSession.status === "closed") {
        addToast("Target session is closed", "error");
        return;
      }

      invoke("write_to_session", {
        sessionId: targetId,
        data: template.text + "\r",
      })
        .then(() => {
          addToast(`Template "${template.name}" sent`, "success");
          onClose();
        })
        .catch((err) => {
          addToast(`Failed to send template: ${err}`, "error");
        });
    },
    [focusedSessionId, sessions, addToast, onClose]
  );

  const handleSave = useCallback(() => {
    if (!formName.trim() || !formText.trim()) return;

    const template: PromptTemplate = {
      id: editingId || `template-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: formName.trim(),
      text: formText.trim(),
      category: formCategory,
    };

    invoke("save_prompt_template", { template })
      .then(() => {
        setSavedTemplates((prev) => {
          if (editingId) {
            return prev.map((t) => (t.id === editingId ? template : t));
          }
          return [...prev, template];
        });
        setShowForm(false);
        setFormName("");
        setFormText("");
        setFormCategory("General");
        setEditingId(null);
        addToast(`Template "${template.name}" saved`, "success");
      })
      .catch((err) => addToast(`Failed to save: ${err}`, "error"));
  }, [formName, formText, formCategory, editingId, addToast]);

  const handleDelete = useCallback(
    (id: string) => {
      invoke("delete_prompt_template", { templateId: id })
        .then(() => {
          setSavedTemplates((prev) => prev.filter((t) => t.id !== id));
          addToast("Template deleted", "info");
        })
        .catch((err) => addToast(`Failed to delete: ${err}`, "error"));
    },
    [addToast]
  );

  const isBuiltin = (id: string) => id.startsWith("builtin-");

  return (
    <div className="prompt-templates-overlay" onClick={onClose}>
      <div className="prompt-templates-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="pt-header">
          <div className="pt-title-row">
            <span className="pt-icon">&#9638;</span>
            <span className="pt-title">Prompt Templates</span>
            <span className="pt-count">{filtered.length} templates</span>
          </div>
          <div className="pt-search-row">
            <input
              ref={inputRef}
              className="pt-search"
              placeholder="Search templates..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") onClose();
              }}
            />
            <button
              className="pt-new-btn"
              onClick={() => {
                setShowForm(true);
                setEditingId(null);
                setFormName("");
                setFormText("");
                setFormCategory("General");
              }}
            >
              + New
            </button>
          </div>
          <div className="pt-category-filters">
            <button
              className={`pt-cat-btn${categoryFilter === null ? " active" : ""}`}
              onClick={() => setCategoryFilter(null)}
            >
              All
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                className={`pt-cat-btn${categoryFilter === cat ? " active" : ""}`}
                style={
                  {
                    "--cat-color": CATEGORY_COLORS[cat],
                  } as React.CSSProperties
                }
                onClick={() =>
                  setCategoryFilter(categoryFilter === cat ? null : cat)
                }
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* New/Edit Form */}
        {showForm && (
          <div className="pt-form">
            <input
              className="pt-form-input"
              placeholder="Template name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              autoFocus
            />
            <select
              className="pt-form-select"
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <textarea
              className="pt-form-textarea"
              placeholder="Template prompt text..."
              value={formText}
              onChange={(e) => setFormText(e.target.value)}
              rows={3}
            />
            <div className="pt-form-actions">
              <button className="pt-form-cancel" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button
                className="pt-form-save"
                onClick={handleSave}
                disabled={!formName.trim() || !formText.trim()}
              >
                {editingId ? "Update" : "Save"}
              </button>
            </div>
          </div>
        )}

        {/* Template List */}
        <div className="pt-list">
          {filtered.map((template) => (
            <div key={template.id} className="pt-card">
              <div className="pt-card-header">
                <span className="pt-card-name">{template.name}</span>
                <span
                  className="pt-card-tag"
                  style={{ background: CATEGORY_COLORS[template.category] || "#4a5568" }}
                >
                  {template.category}
                </span>
              </div>
              <p className="pt-card-preview">{template.text}</p>
              <div className="pt-card-actions">
                <button className="pt-use-btn" onClick={() => handleUse(template)}>
                  Use
                </button>
                {!isBuiltin(template.id) && (
                  <button
                    className="pt-delete-btn"
                    onClick={() => handleDelete(template.id)}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="pt-empty">No templates match your search</div>
          )}
        </div>
      </div>
    </div>
  );
}
