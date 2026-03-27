# Forge

A desktop app for running multiple Claude Code sessions side by side. Built on Tauri v2 and React.

Each session runs in its own PTY terminal. When you close a session, Forge generates a summary with Claude and saves it locally. Reopen it later and Claude picks up where it left off.

## What's in the box

- **Session grid** with 8 layout modes (2-col, 3-col, 2x2, 3x2, etc.) and drag-to-reorder
- **Session library** with search, sort, markdown export, and two resume modes:
  - *Resume* restores the exact Claude Code conversation via `--resume`
  - *New + Context* starts fresh but hands Claude the summary so it's oriented
- **Quick Session** launches a terminal in one click from the header, system tray, command palette, or keyboard shortcut
- **Pinned sessions** auto-restore when you relaunch the app
- **File browser** sidebar with tree view, back/forward navigation, recent files, and drag-and-drop onto terminals
- **Diff viewer** showing per-session git changes with staging and unified diffs
- **Prompt templates** for reusable starter prompts
- **Broadcast mode** sends the same input to all active sessions at once
- **AI news ticker** pulling headlines from TechCrunch AI and Ars Technica RSS
- **System monitoring** in the status bar: CPU, RAM, GPU, VRAM, temps, uptime
- **Screenshot browser** for pasting image paths into terminals
- **Sound alerts** when Claude finishes a long stretch of work
- **Command palette** (Ctrl+K) with fuzzy search across all actions
- **Window transparency** slider that fades the background while keeping text crisp
- **Display settings** for GUI scale, terminal font size, ticker speed, grid lines, and layout

## Prerequisites

| Dependency | Notes |
|---|---|
| [Node.js 18+](https://nodejs.org/) | For the React frontend build |
| [Rust + Cargo](https://rustup.rs/) | For the Tauri backend |
| [Tauri CLI v2](https://tauri.app/start/prerequisites/) | `cargo install tauri-cli` |
| [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) | Must be in your PATH as `claude` |

Claude Code handles its own authentication. Make sure you can run `claude` in a terminal before launching Forge.

## Install

### Windows / Linux

```bash
git clone https://github.com/CodeBarrie/forge-app.git
cd forge-app
npm install
npm run tauri dev          # dev mode with hot reload
npm run tauri build        # release build
```

The installer lands in `src-tauri/target/release/bundle/`.

### macOS

There's a one-shot build script that checks prerequisites, builds, and installs to `/Applications`:

```bash
git clone https://github.com/CodeBarrie/forge-app.git
cd forge-app
bash scripts/mac-build-install.sh
```

Or do it manually with the same `npm install && npm run tauri build` steps above.

## First run

Forge doesn't assume anything about your filesystem. On first launch:

1. Click **+ New** or hit **Ctrl+N** to create a session
2. Pick a working directory with the **Browse** button (or type a path)
3. Give the session a label and hit **Launch Session**

Your recent projects are remembered automatically. Next time you open the New Session modal, they'll appear as quick-start buttons.

For zero-friction launches, **Quick Session** (Ctrl+Shift+N) drops you into a terminal in your home directory.

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| Ctrl+N | New session |
| Ctrl+Shift+N | Quick session |
| Ctrl+K | Command palette |
| Ctrl+L | Session library |
| Ctrl+E | File browser |
| Ctrl+D | Diff viewer |
| Ctrl+T | Prompt templates |
| Ctrl+P | Screenshots |
| Ctrl+B | Broadcast mode |
| Ctrl+S | Save current session |
| Ctrl+W | Close current session |
| Ctrl+Tab | Cycle focus between sessions |
| Ctrl+1-9 | Jump to session by number |
| Escape | Close the topmost modal or panel |

## Session lifecycle

```
Create session  -->  Claude Code runs in PTY  -->  Close session
                                                       |
                                              Summary generated via
                                              Claude CLI (--print)
                                                       |
                                              Saved to app data dir
                                                       |
                                              Appears in Session Library
                                                       |
                                              Resume or start new + context
```

Sessions auto-save every 5 minutes. The green border pulse means an auto-save just happened.

When you close a session, Forge asks Claude to summarize the terminal transcript in 3-5 sentences. That summary is what gets handed back when you resume, so Claude has context on what happened.

## Settings and data

**Session data** is stored in your OS app data directory:
- Windows: `%APPDATA%\dev.codebarrie.forge\sessions\`
- macOS: `~/Library/Application Support/dev.codebarrie.forge/sessions/`
- Linux: `~/.local/share/dev.codebarrie.forge/sessions/`

Each session is a JSON file with the summary, transcript snippet, and metadata.

**Display preferences** (layout, scale, font size, sound, ticker speed, grid lines) persist in the browser's localStorage. They survive restarts but not app data resets.

**Screenshots directory** is configured the first time you open the Screenshots panel. Pick any folder on your system. The choice is saved in localStorage.

## Security notes

- `--dangerously-skip-permissions` is **off by default**. You can enable it per-session from Display > Always Skip Permissions. Only do this if you trust all configured MCP servers and tools.
- A Content Security Policy restricts what the WebView can load. Scripts and connections are limited to the app itself and the two RSS feed domains.
- The screenshot reader is scoped to your chosen screenshots directory. It won't read files outside that folder.
- Log export filenames are sanitized to prevent path traversal.
- No API keys, tokens, or user-specific paths are hardcoded. The app resolves your home directory at runtime.

## Architecture

```
forge-app/
├── src/                           # React frontend
│   ├── App.tsx                    # Root state, routing, keyboard shortcuts
│   ├── components/
│   │   ├── Header.tsx             # Top bar, display settings popover
│   │   ├── SessionGrid.tsx        # Adaptive grid, drag-to-reorder, empty state
│   │   ├── SessionPane.tsx        # Individual terminal (xterm.js + PTY bridge)
│   │   ├── SessionLibrary.tsx     # Browse, search, resume past sessions
│   │   ├── NewSessionModal.tsx    # Session creation, recent projects
│   │   ├── FileBrowser.tsx        # Sidebar file tree with drag-and-drop
│   │   ├── DiffViewer.tsx         # Per-session git diff and staging
│   │   ├── ScreenshotBrowser.tsx  # Image grid with thumbnails and preview
│   │   ├── PromptTemplates.tsx    # Reusable prompt management
│   │   ├── CommandPalette.tsx     # Ctrl+K fuzzy action search
│   │   ├── BroadcastBar.tsx       # Send input to all sessions
│   │   ├── NewsTicker.tsx         # RSS headline scroller
│   │   ├── StatusBar.tsx          # System stats, session counts, sound toggle
│   │   ├── ConsoleLog.tsx         # Internal debug log viewer
│   │   └── Toast.tsx              # Notification stack
│   ├── lib/
│   │   ├── summarizer.ts          # Calls backend for AI summaries
│   │   ├── sounds.ts              # Chime system for activity alerts
│   │   └── fileDrag.ts            # Custom drag system (bypasses WebView2 DnD bugs)
│   └── types.ts                   # Session, Project, Template types
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs                 # Tauri setup, tray, window config
│   │   └── commands.rs            # All backend commands:
│   │                                 PTY spawning, session persistence,
│   │                                 file I/O, git operations, system stats,
│   │                                 screenshot reading, RSS fetching,
│   │                                 summary generation
│   ├── capabilities/
│   │   └── default.json           # Tauri permission scopes
│   ├── tauri.conf.json            # App config, CSP, window settings
│   └── Cargo.toml                 # Rust dependencies
├── scripts/
│   └── mac-build-install.sh       # One-shot macOS build + install
└── Project_Status.md              # Detailed feature list and changelog
```

## How the terminal works

Each session spawns a real PTY (pseudo-terminal) using the `portable-pty` crate. The PTY runs `claude` as a child process. Terminal output streams to the frontend over Tauri events, where xterm.js renders it. Keyboard input goes the other direction: frontend to backend to PTY.

This means you get full terminal behavior: colors, cursor movement, line editing, scroll history. It's not a simplified text box.

The WebGL renderer is used by default for performance. When you lower the window opacity below 1.0, Forge switches to the canvas renderer (WebGL doesn't support alpha transparency) and switches back when you return to full opacity.

## How resume works

When you create a new session, Forge generates a UUID and passes it to Claude Code via `--session-id`. This ID is stored with the session data.

When you resume, Forge calls `claude --resume <session-id>`, which restores the full Claude Code conversation state server-side. This is different from the "New + Context" mode, which starts a fresh Claude instance and passes the summary as the first message.

## Contributing

Issues and PRs welcome at [github.com/CodeBarrie/forge-app](https://github.com/CodeBarrie/forge-app).

## License

MIT. See [LICENSE](LICENSE).
