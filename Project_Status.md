# Forge — Project Status

## Current State (v0.3.0)
Tauri v2 + React desktop app that runs multiple Claude Code sessions in parallel within embedded xterm.js terminals. Core UX polished and working with full keyboard shortcut support, session management, and visual customization.

## Working
- Embedded PTY terminals via portable-pty + xterm.js (WebGL renderer with canvas fallback for transparency)
- Adaptive grid layout (1x1, 1x2, 2x2)
- Session creation with default working dir (`__CLAUDE ZONE`) + project presets
- Claude Code launches clean (nesting detection bypass)
- Session save on close with AI-generated summaries (Anthropic API)
- Session library with two restore modes: **Resume** (`--resume` exact session) and **New + Context** (fresh instance with summary)
- Auto-save every 5 minutes (silent, green border pulse indicator)
- Quick Session: zero-friction instant launch from header + empty state, label/project editable on save
- Save flow includes edit step for label/project before generating summary
- Screenshot browser with path pasting into terminals
- Background-only transparency slider (text/UI stays crisp, WebGL auto-toggles for alpha support)
- Dark title bar, animated pastel gradient on FORGE wordmark, Quick Session button, and empty state
- Rainbow hue-cycling glass strip between header and content
- Visual polish: glow effects, animated logo, hover states, entrance animations, white-bordered buttons
- Keyboard shortcuts: Ctrl+N (new), Ctrl+Shift+N (quick), Ctrl+L (library), Ctrl+Tab (cycle), Ctrl+W (close), Ctrl+S (save), Ctrl+P (screenshots), Escape (close modals)
- Session tab bar for 5+ sessions with page-based visibility
- Session library search/filter + sort (recent, A-Z, project) + markdown export
- Animated × grid with radial wave animation on empty state (mix-blend-mode: difference)
- Display settings popover: independent toggles for × symbols and grid lines
- Grid lines at 2x density with responsive alignment on resize

## Known Issues
- [ ] Ember/hue strip has rendering artifacts in WebView2 — needs investigation
- [ ] Display gamma flicker at certain opacity levels (Windows CABC — hardware level, not fixable in app)

## Build Queue

### 1. Drag-to-Reorder Panes
- [ ] Drag handle on session pane header
- [ ] Visual drop indicator during drag
- [ ] Reorder updates grid layout in real time

### 2. Pinned Sessions
- [ ] Pin toggle on session pane header
- [ ] Pinned sessions persist across app restart
- [ ] Auto-restore pinned sessions on launch

### 3. System Tray
- [ ] Tray icon with session count badge
- [ ] Right-click menu: Quick Session, open library, quit
- [ ] Session status indicators (active/idle/thinking)

### 4. Session Color Picker
- [ ] Custom pane accent colors beyond default orange
- [ ] Color persists with session save

### 5. Command Palette
- [ ] Ctrl+K to open fuzzy search for all actions
- [ ] Quick access to sessions, settings, and commands

### 6. Session Activity Indicator
- [ ] Visual indicator when Claude is actively outputting vs idle
- [ ] Pulsing dot or border glow on active panes

### 7. Notifications
- [ ] Toast notifications when background sessions complete or error
