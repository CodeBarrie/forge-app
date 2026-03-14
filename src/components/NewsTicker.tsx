import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-shell";

interface Headline {
  title: string;
  url: string;
}

interface NewsTickerProps {
  speed: number;
}

export function NewsTicker({ speed }: NewsTickerProps) {
  const [headlines, setHeadlines] = useState<Headline[]>([]);

  useEffect(() => {
    invoke<Headline[]>("fetch_ai_headlines")
      .then(setHeadlines)
      .catch(() => setHeadlines([{ title: "Unable to fetch headlines", url: "" }]));

    const interval = setInterval(() => {
      invoke<Headline[]>("fetch_ai_headlines")
        .then(setHeadlines)
        .catch(() => {});
    }, 600_000);

    return () => clearInterval(interval);
  }, []);

  if (headlines.length === 0) return null;

  const sep = "\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0";

  const items = headlines.map((h, i) => (
    <span key={i}>
      {i > 0 && <span className="news-ticker-sep">{sep}◆{sep}</span>}
      <span
        className="news-ticker-link"
        onClick={() => { if (h.url) open(h.url); }}
      >
        {h.title}
      </span>
    </span>
  ));

  return (
    <div className="news-ticker" style={{ "--ticker-speed": `${speed}s` } as React.CSSProperties}>
      <div className="news-ticker-track">
        <span className="news-ticker-content">{items}</span>
        <span className="news-ticker-content" aria-hidden>{items}</span>
      </div>
    </div>
  );
}
