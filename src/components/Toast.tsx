import { useEffect, useRef } from "react";

export interface ToastMessage {
  id: string;
  text: string;
  type: "info" | "success" | "error";
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }) {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    const timer = setTimeout(() => onDismissRef.current(), 4000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={`toast toast-${toast.type}`}>
      <span className="toast-text">{toast.text}</span>
      <button
        className="toast-close"
        onPointerDown={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
      >
        ×
      </button>
    </div>
  );
}
