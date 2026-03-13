import { useState } from "react";

interface BroadcastBarProps {
  sessionCount: number;
  onSend: (text: string) => void;
  onClose: () => void;
}

export function BroadcastBar({ sessionCount, onSend, onClose }: BroadcastBarProps) {
  const [text, setText] = useState("");

  const handleSend = () => {
    if (text.trim()) {
      onSend(text);
      setText("");
    }
  };

  return (
    <div className="broadcast-bar">
      <span className="broadcast-badge">BROADCAST</span>
      <input
        className="broadcast-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`Send to ${sessionCount} session${sessionCount !== 1 ? "s" : ""}...`}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSend();
          else if (e.key === "Escape") onClose();
        }}
        autoFocus
      />
      <button className="broadcast-send" onClick={handleSend}>
        send all
      </button>
      <button className="broadcast-close" onClick={onClose}>
        ×
      </button>
    </div>
  );
}
