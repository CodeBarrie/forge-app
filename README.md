# ⬡ Forge
### CodeBarrie — Claude Code Console

A lightweight, standalone desktop app for running multiple Claude Code sessions in parallel, with AI-generated session summaries that make sessions resumable.

---

## What It Does

- **Flexible session grid** — 1, 2, 3, or 4 sessions in an adaptive layout
- **Live terminal output** — streams Claude Code output in real time
- **AI summaries on close** — when you close a session, Claude writes a 3-5 sentence brief on what was happening
- **Session Library** — all past sessions saved locally, browse and resume with one click
- **Resume context** — reopening a session hands the summary back to Claude so it walks in oriented
- **Your projects baked in** — Shadow Server, COT Edit Assistant, WanGP, CodeBarrie Site as quick-start presets

---

## Prerequisites

- [Node.js 18+](https://nodejs.org/)
- [Rust + Cargo](https://rustup.rs/)
- [Tauri CLI v2](https://tauri.app/start/prerequisites/)
- [Claude Code CLI](https://docs.anthropic.com/claude-code) — must be in your PATH as `claude`
- Anthropic API key set in your environment (`ANTHROPIC_API_KEY`)

---

## Setup

```bash
# 1. Clone and install
git clone <your-repo>
cd forge-app
npm install

# 2. Run in dev mode
npm run tauri dev

# 3. Build a release .exe
npm run tauri build
```

The built installer will be in `src-tauri/target/release/bundle/`.

---

## Customizing Projects

Edit the `QUICK_PROJECTS` array in `src/components/NewSessionModal.tsx` to add your project paths:

```ts
const QUICK_PROJECTS = [
  { name: "Shadow Server", path: "C:\\Users\\Brent\\Projects\\shadow-server" },
  { name: "COT Edit Assistant", path: "C:\\Users\\Brent\\Projects\\cot-edit" },
  // ...
];
```

---

## Session Storage

Sessions are saved to your app data directory:
- **Windows:** `%APPDATA%\dev.codebarrie.forge\sessions\`
- Each session is a `.json` file with the summary, transcript, and metadata

---

## Architecture

```
forge-app/
├── src/                        # React frontend
│   ├── App.tsx                 # Root — session state management
│   ├── components/
│   │   ├── Header.tsx          # Top bar
│   │   ├── SessionGrid.tsx     # Adaptive grid layout
│   │   ├── SessionPane.tsx     # Individual terminal session
│   │   ├── SessionLibrary.tsx  # Browse & resume past sessions
│   │   └── NewSessionModal.tsx # Session creation
│   ├── lib/
│   │   └── summarizer.ts       # Claude API summary generation
│   └── types.ts
├── src-tauri/
│   └── src/
│       ├── main.rs             # Tauri entry
│       └── commands.rs         # Process spawning, session I/O, persistence
└── README.md
```

---

Built on [Tauri v2](https://tauri.app) · MIT License
