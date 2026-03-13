import { useEffect } from "react";

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
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className={`toast toast-${toast.type}`}>
      <span className="toast-text">{toast.text}</span>
      <button className="toast-close" onClick={onDismiss}>×</button>
    </div>
  );
}
