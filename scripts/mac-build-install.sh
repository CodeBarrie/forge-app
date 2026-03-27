#!/usr/bin/env bash
set -euo pipefail

# Forge — macOS Auto-Build & Install Script
# Give this to Claude Code on your Mac to build and install Forge.

APP_NAME="Forge"
BUNDLE_ID="dev.codebarrie.forge"
INSTALL_DIR="/Applications"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

red()   { printf '\033[1;31m%s\033[0m\n' "$*"; }
green() { printf '\033[1;32m%s\033[0m\n' "$*"; }
blue()  { printf '\033[1;34m%s\033[0m\n' "$*"; }

step=0
step() { step=$((step + 1)); blue "[$step] $*"; }

fail() { red "ERROR: $*"; exit 1; }

# ── 1. Check prerequisites ──────────────────────────────────────────

step "Checking Xcode Command Line Tools"
if ! xcode-select -p &>/dev/null; then
    echo "Installing Xcode Command Line Tools..."
    xcode-select --install
    echo "After the installer finishes, re-run this script."
    exit 0
fi
green "  OK"

step "Checking Rust toolchain"
if ! command -v rustc &>/dev/null; then
    echo "Installing Rust via rustup..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
fi
rustc_ver=$(rustc --version)
green "  $rustc_ver"

step "Checking Node.js"
if ! command -v node &>/dev/null; then
    if command -v brew &>/dev/null; then
        echo "Installing Node.js via Homebrew..."
        brew install node
    else
        fail "Node.js not found and Homebrew not available. Install Node.js 18+ first."
    fi
fi
node_ver=$(node --version)
green "  node $node_ver"

step "Checking npm"
if ! command -v npm &>/dev/null; then
    fail "npm not found. It should come with Node.js — check your installation."
fi
green "  npm $(npm --version)"

# ── 2. Install dependencies ─────────────────────────────────────────

cd "$PROJECT_DIR"

step "Installing npm dependencies"
npm install
green "  Done"

# ── 3. Build ─────────────────────────────────────────────────────────

step "Building $APP_NAME (release)"
npm run tauri build 2>&1 | tail -20
green "  Build complete"

# ── 4. Locate the .app bundle ───────────────────────────────────────

step "Locating app bundle"
APP_BUNDLE=$(find src-tauri/target/release/bundle -name "${APP_NAME}.app" -type d 2>/dev/null | head -1)
if [ -z "$APP_BUNDLE" ]; then
    fail "Could not find ${APP_NAME}.app in build output."
fi
green "  Found: $APP_BUNDLE"

# ── 5. Install to /Applications ─────────────────────────────────────

step "Installing to $INSTALL_DIR"
DEST="$INSTALL_DIR/$APP_NAME.app"

# Kill running instance if present
if pgrep -xq "$APP_NAME" 2>/dev/null; then
    echo "  Closing running $APP_NAME..."
    pkill -x "$APP_NAME" 2>/dev/null || true
    sleep 1
fi

# Remove old version
if [ -d "$DEST" ]; then
    echo "  Removing previous installation..."
    rm -rf "$DEST"
fi

cp -R "$APP_BUNDLE" "$DEST"
green "  Installed to $DEST"

# ── 6. Clear quarantine (unsigned local build) ───────────────────────

step "Clearing quarantine flag"
xattr -cr "$DEST" 2>/dev/null || true
green "  Done"

# ── 7. Launch ────────────────────────────────────────────────────────

step "Launching $APP_NAME"
open "$DEST"
green "  $APP_NAME is running!"

echo ""
green "All done. $APP_NAME has been built and installed to $INSTALL_DIR."
