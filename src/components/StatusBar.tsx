import { useState, useEffect } from "react";
import { Session } from "../types";
import { invoke } from "@tauri-apps/api/core";

interface SystemStats {
  cpu_percent: number;
  cpu_temp: number | null;
  ram_used_gb: number;
  ram_total_gb: number;
  ram_percent: number;
  gpu_percent: number | null;
  gpu_temp: number | null;
  vram_used_mb: number | null;
  vram_total_mb: number | null;
  vram_percent: number | null;
}

interface StatusBarProps {
  sessions: Session[];
  soundEnabled: boolean;
  onToggleSound: () => void;
}

function formatUptime(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${Math.floor(s)}s`;
}

export function StatusBar({ sessions, soundEnabled, onToggleSound }: StatusBarProps) {
  const [uptime, setUptime] = useState(0);
  const [stats, setStats] = useState<SystemStats | null>(null);

  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => setUptime(Date.now() - start), 1000);
    return () => clearInterval(timer);
  }, []);

  // Poll system stats every 2 seconds
  useEffect(() => {
    let active = true;
    const poll = () => {
      invoke<SystemStats>("get_system_stats")
        .then((s) => { if (active) setStats(s); })
        .catch(() => {});
    };
    poll();
    const timer = setInterval(poll, 2000);
    return () => { active = false; clearInterval(timer); };
  }, []);

  const active = sessions.filter((s) => s.status === "active").length;
  const total = sessions.length;

  return (
    <div className="status-bar">
      <div className="status-left">
        <span className="status-item">
          <span className="status-dot" style={{ backgroundColor: total > 0 ? "#4ade80" : "#4a5568" }} />
          {total} session{total !== 1 ? "s" : ""}
        </span>
        {active > 0 && (
          <span className="status-item">
            <span className="status-dot pulse-dot" />
            {active} active
          </span>
        )}
        <span className="status-sep">|</span>
        {stats && (
          <>
            <span className="status-item status-stat">
              <span className="stat-label">CPU</span>
              <span className={`stat-value ${stats.cpu_percent > 80 ? "stat-hot" : ""}`}>
                {stats.cpu_percent.toFixed(0)}%
              </span>
              {stats.cpu_temp !== null && (
                <span className={`stat-temp ${stats.cpu_temp > 85 ? "stat-hot" : ""}`}>
                  {stats.cpu_temp.toFixed(0)}°
                </span>
              )}
            </span>
            <span className="status-item status-stat">
              <span className="stat-label">RAM</span>
              <span className={`stat-value ${stats.ram_percent > 85 ? "stat-hot" : ""}`}>
                {stats.ram_used_gb.toFixed(1)}/{stats.ram_total_gb.toFixed(0)}GB
              </span>
            </span>
            {stats.gpu_percent !== null && (
              <span className="status-item status-stat">
                <span className="stat-label">GPU</span>
                <span className={`stat-value ${stats.gpu_percent > 80 ? "stat-hot" : ""}`}>
                  {stats.gpu_percent.toFixed(0)}%
                </span>
                {stats.gpu_temp !== null && (
                  <span className={`stat-temp ${stats.gpu_temp > 80 ? "stat-hot" : ""}`}>
                    {stats.gpu_temp.toFixed(0)}°
                  </span>
                )}
              </span>
            )}
            {stats.vram_used_mb !== null && stats.vram_total_mb !== null && (
              <span className="status-item status-stat">
                <span className="stat-label">VRAM</span>
                <span className={`stat-value ${(stats.vram_percent ?? 0) > 85 ? "stat-hot" : ""}`}>
                  {(stats.vram_used_mb / 1024).toFixed(1)}/{(stats.vram_total_mb / 1024).toFixed(0)}GB
                </span>
              </span>
            )}
          </>
        )}
      </div>
      <div className="status-right">
        <button
          className={`status-sound-btn ${soundEnabled ? "" : "muted"}`}
          onClick={onToggleSound}
          title={soundEnabled ? "Mute sounds" : "Unmute sounds"}
        >
          {soundEnabled ? "sound on" : "sound off"}
        </button>
        <span className="status-item status-uptime">
          uptime {formatUptime(uptime)}
        </span>
      </div>
    </div>
  );
}
