// Custom file drag system — bypasses broken HTML5 DnD in WebView2
// Uses mousedown/mousemove/mouseup instead

type DropHandler = (filePath: string, target: "empty" | { sessionId: string }) => void;

let dragPath: string | null = null;
let ghost: HTMLDivElement | null = null;
let onDropCallback: DropHandler | null = null;

export function setDropHandler(handler: DropHandler) {
  onDropCallback = handler;
}

export function startFileDrag(filePath: string, fileName: string, e: React.MouseEvent) {
  e.preventDefault();
  dragPath = filePath;

  // Create ghost element
  ghost = document.createElement("div");
  ghost.className = "file-drag-ghost";
  ghost.textContent = fileName;
  ghost.style.left = `${e.clientX + 12}px`;
  ghost.style.top = `${e.clientY - 10}px`;
  document.body.appendChild(ghost);

  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
}

function onMouseMove(e: MouseEvent) {
  if (ghost) {
    ghost.style.left = `${e.clientX + 12}px`;
    ghost.style.top = `${e.clientY - 10}px`;
  }

  // Highlight drop targets
  const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
  // Remove previous highlights
  document.querySelectorAll(".file-drag-hover").forEach((el) => el.classList.remove("file-drag-hover"));

  if (el) {
    const pane = el.closest(".session-pane");
    const empty = el.closest(".grid-empty-state");
    if (pane) pane.classList.add("file-drag-hover");
    else if (empty) empty.classList.add("file-drag-hover");
  }
}

function onMouseUp(e: MouseEvent) {
  document.removeEventListener("mousemove", onMouseMove);
  document.removeEventListener("mouseup", onMouseUp);

  // Clean up highlights
  document.querySelectorAll(".file-drag-hover").forEach((el) => el.classList.remove("file-drag-hover"));

  // Clean up ghost
  if (ghost) {
    ghost.remove();
    ghost = null;
  }

  if (!dragPath || !onDropCallback) {
    dragPath = null;
    return;
  }

  // Find drop target
  const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
  if (el) {
    const pane = el.closest(".session-pane") as HTMLElement | null;
    const empty = el.closest(".grid-empty-state");

    if (pane) {
      const sessionId = pane.getAttribute("data-session-id");
      if (sessionId) {
        onDropCallback(dragPath, { sessionId });
      }
    } else if (empty) {
      onDropCallback(dragPath, "empty");
    }
  }

  dragPath = null;
}
