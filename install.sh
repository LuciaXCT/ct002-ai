#!/bin/bash

# CT-002 CodersTeam — opencode installer
# Supports: Linux, macOS, Termux (Android)
# Drops opencode config + CT-002 agent into ~/.config/opencode/
# Then just run: opencode

set -e

echo "[🤑Made CT-OO2]"
echo "wazzup bro 😭✌️"
echo "🤑installing CT-002 CodersTeam into opencode..."
echo ""

# Detect environment
IS_TERMUX=false
if [ -d "/data/data/com.termux" ] || [ -n "$TERMUX_VERSION" ] || [ -n "$PREFIX" ] && echo "$PREFIX" | grep -q "com.termux"; then
    IS_TERMUX=true
    echo "[termux] detected — using Termux paths"
fi

# Check opencode exists
if ! command -v opencode &> /dev/null; then
    if [ "$IS_TERMUX" = true ]; then
        echo "opencode not found. Installing for Termux..."
        echo ""
        echo "Make sure you have termux-api and storage access:"
        echo "  pkg install termux-api"
        echo "  termux-setup-storage"
        echo ""
        
        # Install deps for Termux
        echo "Installing dependencies..."
        pkg update -y 2>/dev/null || apt update -y
        pkg install -y curl nodejs git 2>/dev/null || apt install -y curl nodejs git 2>/dev/null
        
        # Install opencode
        curl -fsSL https://opencode.ai/v2/install | bash
    else
        echo "opencode not found. Installing..."
        curl -fsSL https://opencode.ai/v2/install | bash
    fi
fi

echo "opencode found: $(which opencode)"

# Target dir (same for all platforms — opencode uses ~/.config/opencode)
TARGET="$HOME/.config/opencode"
mkdir -p "$TARGET/agents"

# Copy files from this repo
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

# Backup existing configs
for f in opencode.json opencode.jsonc; do
    if [ -f "$TARGET/$f" ]; then
        cp "$TARGET/$f" "$TARGET/$f.bak"
        echo "backed up: $f -> $f.bak"
    fi
done

# Install opencode.json
cp "$REPO_DIR/opencode.json" "$TARGET/opencode.json"
echo "opencode.json -> $TARGET/opencode.json"

# Install CT-002 agent
cp "$REPO_DIR/.opencode/agents/ct002.md" "$TARGET/agents/ct002.md"
echo "ct002.md -> $TARGET/agents/ct002.md"

# Prompt for username
echo ""
echo "=== SETUP YOUR NAME ==="
echo "The AI will address you by this name (not 'user')"
echo ""
read -p "Your name (default: bro): " USERNAME
USERNAME=${USERNAME:-bro}

# Save persona.json
cat > "$TARGET/persona.json" << EOF
{
  "name": "CT-002 CodersTeam",
  "team": "CodersTeam",
  "address": "$USERNAME",
  "version": "1.0.0",
  "termux": $IS_TERMUX
}
EOF

echo "persona.json -> $TARGET/persona.json"

# Termux-specific setup
if [ "$IS_TERMUX" = true ]; then
    echo ""
    echo "[termux] Setting up Termux environment..."
    
    # Storage access
    if [ ! -d "$HOME/storage" ]; then
        echo "[termux] Requesting storage access..."
        termux-setup-storage 2>/dev/null || echo "  (run 'termux-setup-storage' manually if needed)"
    fi
    
    # Create symlinks for common tools
    mkdir -p "$HOME/.local/bin"
    
    # Add to PATH if not already
    if ! echo "$PATH" | grep -q "$HOME/.local/bin"; then
        echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc"
        echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.zshrc" 2>/dev/null
        echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.profile"
        echo "[termux] Added ~/.local/bin to PATH"
    fi
    
    # Alias for opencode
    echo 'alias opencode="opencode"' >> "$HOME/.bashrc" 2>/dev/null
    
    # Termux wake lock (prevent sleep during long tasks)
    echo "[termux] Tip: use 'termux-wake-lock' to prevent sleep during long tasks"
    
    # Recommended Termux packages
    echo ""
    echo "[termux] Recommended packages (install if needed):"
    echo "  pkg install termux-api    # clipboard, notifications, toasts"
    echo "  pkg install openssh       # SSH access"
    echo "  pkg install python        # Python support"
    echo "  pkg install git           # Git support"
    echo "  termux-setup-storage      # access phone files"
    echo "  termux-wake-lock          # prevent sleep"
fi

echo ""
echo "=========================================="
echo ""
echo "CT-002 CodersTeam installed!"
echo ""
echo "  Your name:  $USERNAME"
echo "  Agent:      ct002 (CT-002 CodersTeam)"
echo "  Router:     9router (all models FREE)"
if [ "$IS_TERMUX" = true ]; then
echo "  Platform:   Termux (Android)"
fi
echo ""
echo "  FREE models (rotate in TUI with 'm'):"
echo "    - big-pickle       (reasoning, unfiltered)"
echo "    - Nemotron 3 Ultra (reasoning, unfiltered)"
echo "    - MIMO V2.5        (unfiltered)"
echo "    - my9model-free    (auto-fallback on limit)"
echo "    - my9model-smart   (benchmark-ranked)"
echo "    - my9model-fast    (speed tier)"
echo "    - opencode-free    (defaults)"
echo ""
echo "  Run: opencode"
if [ "$IS_TERMUX" = true ]; then
echo "  Termux tip: termux-wake-lock && opencode"
fi
echo ""
echo "  To change name: nano $TARGET/persona.json"
echo "  Red light: doxing, physical harm, swatting"
echo "  Everything else: GREEN LIGHT"
echo "=========================================="
