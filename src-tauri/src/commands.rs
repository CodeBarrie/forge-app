use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter, Manager, State};
use serde::{Deserialize, Serialize};
use portable_pty::{native_pty_system, CommandBuilder, PtySize};

// ── Types ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedSession {
    pub id: String,
    pub label: String,
    pub project: String,
    #[serde(rename = "workingDir")]
    pub working_dir: String,
    pub status: String,
    #[serde(rename = "createdAt")]
    pub created_at: u64,
    #[serde(rename = "lastActiveAt")]
    pub last_active_at: u64,
    pub summary: Option<String>,
    pub transcript: Option<String>,
    #[serde(rename = "closedAt")]
    pub closed_at: Option<u64>,
    #[serde(rename = "claudeSessionId")]
    pub claude_session_id: Option<String>,
}

// ── Process Store ─────────────────────────────────────────────────────────────

pub struct PtySession {
    master: Box<dyn portable_pty::MasterPty + Send>,
    writer: Box<dyn Write + Send>,
}

pub struct ProcessStore {
    sessions: HashMap<String, PtySession>,
}

impl ProcessStore {
    pub fn new() -> Self {
        Self { sessions: HashMap::new() }
    }
}

pub type AppState = Arc<Mutex<ProcessStore>>;

// ── Session Commands ─────────────────────────────────────────────────────────

#[tauri::command]
pub fn start_session(
    app: AppHandle,
    state: State<'_, AppState>,
    session_id: String,
    working_dir: String,
    _label: String,
    resume_context: Option<String>,
    claude_session_id: Option<String>,
    cols: Option<u16>,
    rows: Option<u16>,
) -> Result<(), String> {
    let claude_cmd = find_claude_binary().ok_or("Could not find 'claude' in PATH")?;

    let pty_system = native_pty_system();

    let pair = pty_system
        .openpty(PtySize {
            rows: rows.unwrap_or(24),
            cols: cols.unwrap_or(80),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to open PTY: {e}"))?;

    let mut cmd = CommandBuilder::new(&claude_cmd);
    cmd.cwd(&working_dir);

    if let Some(ref csid) = claude_session_id {
        // Resuming: use --resume to restore the actual Claude Code conversation
        cmd.arg("--resume");
        cmd.arg(csid);
    } else if let Some(ref context) = resume_context {
        // Legacy fallback: pass context as initial prompt
        cmd.arg(context);
    }

    // Set a stable session ID so we can resume later
    if claude_session_id.is_none() {
        // New session — generate a UUID and tell Claude Code to use it
        let uuid = uuid::Uuid::new_v4().to_string();
        cmd.arg("--session-id");
        cmd.arg(&uuid);
        // Emit the generated UUID back to the frontend so it can store it
        let sid = session_id.clone();
        let app_for_uuid = app.clone();
        let uuid_clone = uuid.clone();
        // Emit after a short delay to ensure frontend listener is ready
        thread::spawn(move || {
            thread::sleep(std::time::Duration::from_millis(500));
            let _ = app_for_uuid.emit(&format!("pty-claude-sid-{}", sid), &uuid_clone);
        });
    }

    // Remove nesting-detection env vars so Claude Code doesn't think it's inside another session
    for key in &["CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT", "CLAUDE_CODE_SESSION"] {
        cmd.env_remove(key);
    }

    let mut child = pair.slave.spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn claude: {e}"))?;

    let mut reader = pair.master.try_clone_reader()
        .map_err(|e| format!("Failed to clone PTY reader: {e}"))?;
    let writer = pair.master.take_writer()
        .map_err(|e| format!("Failed to take PTY writer: {e}"))?;

    // Stream PTY output to frontend via Tauri events
    let sid = session_id.clone();
    let app_clone = app.clone();
    thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    // Send raw bytes as a string (xterm.js handles escape codes)
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app_clone.emit(&format!("pty-data-{}", sid), &data);
                }
                Err(_) => break,
            }
        }
        // Notify frontend that session ended
        let _ = app_clone.emit(&format!("pty-exit-{}", sid), "exited");
    });

    // Watch for child exit in background
    let sid2 = session_id.clone();
    let app_clone2 = app.clone();
    thread::spawn(move || {
        let _ = child.wait();
        let _ = app_clone2.emit(&format!("pty-exit-{}", sid2), "exited");
    });

    let mut store = state.lock().map_err(|e| e.to_string())?;
    store.sessions.insert(session_id.clone(), PtySession { master: pair.master, writer });

    Ok(())
}

#[tauri::command]
pub fn write_to_session(
    state: State<'_, AppState>,
    session_id: String,
    data: String,
) -> Result<(), String> {
    let mut store = state.lock().map_err(|e| e.to_string())?;
    if let Some(session) = store.sessions.get_mut(&session_id) {
        session.writer.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err(format!("Session '{}' not found", session_id))
    }
}

#[tauri::command]
pub fn resize_session(
    state: State<'_, AppState>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let store = state.lock().map_err(|e| e.to_string())?;
    if let Some(session) = store.sessions.get(&session_id) {
        session.master.resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        }).map_err(|e| format!("Failed to resize PTY: {e}"))?;
        Ok(())
    } else {
        Err(format!("Session '{}' not found", session_id))
    }
}

#[tauri::command]
pub fn kill_session(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<(), String> {
    let mut store = state.lock().map_err(|e| e.to_string())?;
    if let Some(_session) = store.sessions.remove(&session_id) {
        // Dropping the PtySession closes the PTY, which kills the child
    }
    Ok(())
}

// ── Persistence ──────────────────────────────────────────────────────────────

#[tauri::command]
pub fn save_session(
    app: AppHandle,
    session: SavedSession,
) -> Result<(), String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let sessions_dir = data_dir.join("sessions");
    std::fs::create_dir_all(&sessions_dir).map_err(|e| e.to_string())?;

    let path = sessions_dir.join(format!("{}.json", session.id));
    let json = serde_json::to_string_pretty(&session).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_session(app: AppHandle, session_id: String) -> Result<(), String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let path = data_dir.join("sessions").join(format!("{}.json", session_id));
    if path.exists() {
        std::fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn load_sessions(app: AppHandle) -> Result<Vec<SavedSession>, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let sessions_dir = data_dir.join("sessions");

    if !sessions_dir.exists() {
        return Ok(vec![]);
    }

    let mut sessions = vec![];
    for entry in std::fs::read_dir(sessions_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        if entry.path().extension().map(|e| e == "json").unwrap_or(false) {
            let json = std::fs::read_to_string(entry.path()).map_err(|e| e.to_string())?;
            if let Ok(session) = serde_json::from_str::<SavedSession>(&json) {
                sessions.push(session);
            }
        }
    }
    Ok(sessions)
}

// ── Summary Generation ───────────────────────────────────────────────────────

#[tauri::command]
pub async fn generate_summary(
    label: String,
    project: String,
    transcript: String,
) -> Result<String, String> {
    let claude_cmd = find_claude_binary().ok_or("Could not find 'claude' in PATH")?;

    // Strip ANSI escape sequences from raw terminal output
    let ansi_re = regex::Regex::new(r"\x1b\[[0-9;]*[a-zA-Z]|\x1b\][^\x07]*\x07|\x1b\[[\?\d;]*[hlm]").unwrap();
    let clean = ansi_re.replace_all(&transcript, "").to_string();
    let clean = regex::Regex::new(r"\n{3,}").unwrap().replace_all(&clean, "\n\n").to_string();
    let clean = clean.trim().to_string();

    let truncated = if clean.len() > 4000 {
        format!("...[earlier output truncated]...\n{}", &clean[clean.len() - 4000..])
    } else {
        clean
    };

    let prompt = format!(
        r#"Summarize this Claude Code terminal session in 3-5 sentences.

Session: "{label}" | Project: "{project}"

TRANSCRIPT:
{truncated}

Focus on: what was built/fixed, last known state, key decisions, obvious next step.
Be direct. Plain prose. No preamble."#
    );

    // Use claude CLI with --print for one-shot, no-interactive output
    let output = tokio::process::Command::new(&claude_cmd)
        .arg("--print")
        .arg(&prompt)
        .env_remove("CLAUDECODE")
        .env_remove("CLAUDE_CODE_ENTRYPOINT")
        .env_remove("CLAUDE_CODE_SESSION")
        .output()
        .await
        .map_err(|e| format!("Failed to run claude CLI: {e}"))?;

    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();

    if text.is_empty() || !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        eprintln!("Summary generation failed: {stderr}");
        Ok(format!("Session \"{label}\" closed. No summary available."))
    } else {
        Ok(text)
    }
}

// ── Log Export ───────────────────────────────────────────────────────────────

#[tauri::command]
pub fn export_log(app: AppHandle, filename: String, content: String) -> Result<String, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let logs_dir = data_dir.join("logs");
    std::fs::create_dir_all(&logs_dir).map_err(|e| e.to_string())?;

    let path = logs_dir.join(&filename);
    std::fs::write(&path, &content).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn open_logs_dir(app: AppHandle) -> Result<(), String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let logs_dir = data_dir.join("logs");
    std::fs::create_dir_all(&logs_dir).map_err(|e| e.to_string())?;
    std::process::Command::new("explorer")
        .arg(logs_dir)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ── Screenshots ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct ScreenshotInfo {
    pub path: String,
    pub name: String,
    #[serde(rename = "modifiedAt")]
    pub modified_at: u64,
    pub size: u64,
}

#[tauri::command]
pub fn list_screenshots(limit: Option<usize>) -> Result<Vec<ScreenshotInfo>, String> {
    let screenshots_dir = format!(
        "{}\\Pictures\\Screenshots",
        std::env::var("USERPROFILE").unwrap_or_default()
    );
    let dir = std::path::Path::new(&screenshots_dir);
    if !dir.exists() { return Ok(vec![]); }

    let mut entries: Vec<ScreenshotInfo> = std::fs::read_dir(dir)
        .map_err(|e| e.to_string())?
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let path = entry.path();
            let ext = path.extension()?.to_str()?.to_lowercase();
            if !matches!(ext.as_str(), "png" | "jpg" | "jpeg" | "bmp" | "webp") { return None; }
            let meta = entry.metadata().ok()?;
            let modified = meta.modified().ok()?.duration_since(std::time::UNIX_EPOCH).ok()?.as_secs();
            Some(ScreenshotInfo {
                path: path.to_string_lossy().to_string(),
                name: path.file_name()?.to_string_lossy().to_string(),
                modified_at: modified,
                size: meta.len(),
            })
        })
        .collect();

    entries.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));
    entries.truncate(limit.unwrap_or(20));
    Ok(entries)
}

#[tauri::command]
pub fn read_screenshot_thumbnail(path: String, _max_width: Option<u32>) -> Result<String, String> {
    use base64::Engine;
    let file_path = std::path::Path::new(&path);
    if !file_path.exists() { return Err("File not found".to_string()); }

    let buf = std::fs::read(file_path).map_err(|e| e.to_string())?;
    let ext = file_path.extension().and_then(|e| e.to_str()).unwrap_or("png").to_lowercase();
    let mime = match ext.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        _ => "image/png",
    };
    let b64 = base64::engine::general_purpose::STANDARD.encode(&buf);
    Ok(format!("data:{};base64,{}", mime, b64))
}

// ── Directory Check ──────────────────────────────────────────────────────────

#[tauri::command]
pub fn check_dir_exists(path: String) -> Result<bool, String> {
    Ok(std::path::Path::new(&path).is_dir())
}

// ── Export Transcript ───────────────────────────────────────────────────────

#[tauri::command]
pub fn export_transcript(path: String, label: String, project: String, summary: String, transcript: String) -> Result<(), String> {
    let content = format!(
        "# {} — {}\n\n## Summary\n{}\n\n## Transcript\n```\n{}\n```\n",
        label, project, summary, transcript
    );
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

// ── Helpers ──────────────────────────────────────────────────────────────────

fn find_claude_binary() -> Option<String> {
    let candidates = if cfg!(windows) {
        vec![
            "claude.exe".to_string(),
            format!("{}\\AppData\\Roaming\\npm\\claude.cmd", std::env::var("USERPROFILE").unwrap_or_default()),
            format!("{}\\.local\\bin\\claude.exe", std::env::var("USERPROFILE").unwrap_or_default()),
        ]
    } else {
        vec![
            "claude".to_string(),
            "/usr/local/bin/claude".to_string(),
            format!("{}/.local/bin/claude", std::env::var("HOME").unwrap_or_default()),
        ]
    };

    for candidate in candidates {
        if which::which(&candidate).is_ok() || std::path::Path::new(&candidate).exists() {
            return Some(candidate);
        }
    }
    None
}
