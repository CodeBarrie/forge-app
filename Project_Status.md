# Forge — Project Status

## Current State (v0.8.0)
Tauri v2 + React desktop app that runs multiple Claude Code sessions in parallel within embedded xterm.js terminals. Full-featured session management with drag-to-reorder, pinned sessions, system tray, color picker, command palette, activity indicators, toast notifications, system monitoring status bar, auto-naming, sound alerts, dictation support, broadcast mode, git integration, hotkey pane focus, configurable layouts, persistent display settings, file browser with drag-and-drop, diff viewer, prompt templates, AI news ticker, and a wireframe globe idle animation.

## Working
- Embedded PTY terminals via portable-pty + xterm.js (WebGL renderer with canvas fallback for transparency)
- Configurable grid layouts: Auto, 2 Col, 2 Row, 3 Col, 3 Row, 2×2, 3×2, 2×3
- Session creation with recent projects and directory browser
- Claude Code launches clean (nesting detection bypass), with opt-in `--dangerously-skip-permissions` toggle
- Session save on close with AI-generated summaries (Anthropic API)
- Session library with two restore modes: **Resume** (`--resume` exact session) and **New + Context** (fresh instance with summary), mustard yellow theme
- Auto-save every 5 minutes (silent, green border pulse indicator)
- Quick Session: zero-friction instant launch from header, empty state, tray, and command palette
- Save flow includes edit step for label/project before generating summary
- Screenshot browser with path pasting into terminals
- Background-only transparency slider (text/UI stays crisp, WebGL auto-toggles for alpha support)
- Dark title bar, animated pastel gradient on FORGE wordmark, Quick Session button, and empty state
- Rainbow hue-cycling glass strip between header and content
- Header date display (YY.MM.DD format, bright red)
- Visual polish: glow effects, animated logo, hover states, entrance animations, white-bordered buttons
- Keyboard shortcuts: Ctrl+N (new), Ctrl+Shift+N (quick), Ctrl+K (command palette), Ctrl+L (library), Ctrl+Tab (cycle), Ctrl+W (close), Ctrl+S (save), Ctrl+P (screenshots), Ctrl+B (broadcast), Ctrl+E (files), Ctrl+D (diffs), Ctrl+T (templates), Ctrl+1-9 (focus pane), Escape (close modals)
- Session tab bar for 5+ sessions with page-based visibility (page size adapts to layout)
- Session library search/filter + sort (recent, A-Z, project) + markdown export
- **Wireframe globe**: canvas-rendered 3D sphere with latitude/longitude lines, slow rotation, orbital rings with glow and wobble, split ring rendering for faux 3D depth
- **Power clock**: 24h digital clock on empty state, red glow, kanji subtitle
- Display settings popover: toggles for symbols/grid lines + layout selector + GUI text scale + terminal font size + ticker speed, all persistent
- Grid lines at 2x density with responsive alignment on resize
- **Drag-to-reorder panes**: drag session panes to swap positions, visual drop indicator
- **Pinned sessions**: pin toggle on pane header, persist to localStorage, auto-restore on app launch
- **System tray**: tray icon with right-click menu (Quick Session, Show Window, Quit), left-click to focus
- **Session color picker**: 8 preset accent colors, popover on pane header, persists with session
- **Command palette** (Ctrl+K): fuzzy search across all actions with keyboard navigation
- **Activity indicator**: pulsing green dot when Claude is outputting, auto-idle after 3s silence
- **Toast notifications**: bottom-right stack, auto-dismiss, color-coded (success/info/error)
- **Dictation bar**: visible input field for voice dictation tools, sends text + Enter to terminal
- **Auto-naming**: quick sessions auto-rename to first user prompt
- **Sound alerts**: two-tone chime when Claude finishes sustained work (>10s), toggleable from status bar
- **Status bar**: session count, active count, CPU/RAM/GPU/VRAM usage, CPU/GPU temps, app uptime, sound toggle
- **System monitoring**: real-time stats via sysinfo crate + nvidia-smi, polled every 2s
- **Broadcast mode** (Ctrl+B): type once, send to all active sessions simultaneously
- **Git integration**: branch name + dirty indicator per session working dir, polled every 10s
- **Hotkey pane focus** (Ctrl+1-9): jump to specific pane by number
- **Configurable layouts**: 8 layout modes selectable from Display popover, persistent
- **Persistent display settings**: symbols, grid lines, layout, sound, GUI scale, terminal font size, ticker speed all saved to localStorage
- **File browser** (Ctrl+E): mustard yellow sidebar, tree view, back/forward/home navigation, recent files, breadcrumbs, depth shading, staggered slide-in/out animation
- **File drag-and-drop**: custom mouse-based drag system (bypasses WebView2 DnD issues), rainbow gradient ghost, drop onto terminals or empty state, .md files auto-launch prompt sessions
- **External file drops**: Windows Explorer files can be dropped onto terminals or empty state
- **Diff viewer** (Ctrl+D): per-session git changes with staging/unstaging and unified diff display
- **Prompt templates** (Ctrl+T): built-in starters and custom template creation, send to sessions
- **AI news ticker**: scrolling headlines from TechCrunch AI and Ars Technica RSS feeds, clickable links open in browser, adjustable speed, HTML entity decoding
- **GUI text scale**: zoom slider (75%-150%) for file browser, session headers, and status bar
- **Terminal font size**: adjustable 10-24px with live reflow across all terminals

## Known Issues
- [ ] Ember/hue strip has rendering artifacts in WebView2 — needs investigation
- [ ] Display gamma flicker at certain opacity levels (Windows CABC — hardware level, not fixable in app)

## Completed Build Queue (v0.8.0)
- [x] Drag-to-Reorder Panes
- [x] Pinned Sessions
- [x] System Tray
- [x] Session Color Picker
- [x] Command Palette
- [x] Session Activity Indicator
- [x] Toast Notifications
- [x] Dictation Bar
- [x] Auto-naming Quick Sessions
- [x] Sound Alerts
- [x] System Monitoring Status Bar
- [x] Broadcast Mode
- [x] Git Integration
- [x] Hotkey Pane Focus
- [x] Power Clock → Wireframe Globe
- [x] Configurable Layouts
- [x] Persistent Display Settings
- [x] Header Date Display
- [x] File Browser with Drag-and-Drop
- [x] Diff Viewer
- [x] Prompt Templates
- [x] AI News Ticker
- [x] GUI Scale + Terminal Font Size Controls
- [x] External File Drop Support
- [x] Dangerously-skip-permissions by default

## Future Ideas
- [ ] Embedded web browser panes in the session grid
- [ ] Split/resize panes with draggable dividers
- [ ] Network stats in status bar
- [ ] Custom themes / color schemes
- [ ] Multi-monitor support / detachable panes
- [ ] Session chaining (output feeds into next session)
