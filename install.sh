#!/bin/bash

# CT-002 CodersTeam — opencode installer
# Drops opencode config + CT-002 agent into ~/.config/opencode/
# Then just run: opencode

set -e

echo "[🤑Made CT-OO2]"
echo "wazzup bro 😭✌️"
echo "🤑installing CT-002 CodersTeam into opencode..."
echo ""

# Check opencode exists
if ! command -v opencode &> /dev/null; then
    echo "opencode not found. Installing..."
    curl -fsSL https://opencode.ai/v2/install | bash
fi

echo "opencode found: $(which opencode)"

# Target dir
TARGET="$HOME/.config/opencode"
mkdir -p "$TARGET/agents"

# Copy files from this repo
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

# Backup existing configs
if [ -f "$TARGET/opencode.json" ]; then
    echo "Existing opencode.json backed up -> opencode.json.bak"
    cp "$TARGET/opencode.json" "$TARGET/opencode.json.bak"
fi

if [ -f "$TARGET/opencode.jsonc" ]; then
    echo "Existing opencode.jsonc backed up -> opencode.jsonc.bak"
    cp "$TARGET/opencode.jsonc" "$TARGET/opencode.jsonc.bak"
fi

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
  "version": "1.0.0"
}
EOF

echo "persona.json -> $TARGET/persona.json"
echo ""
echo "=========================================="
echo ""
echo "CT-002 CodersTeam installed!"
echo ""
echo "  Your name:  $USERNAME"
echo "  Agent:      ct002 (CT-002 CodersTeam)"
echo "  Router:     9router (all models FREE)"
echo ""
echo "  FREE models available:"
echo "    - big-pickle (reasoning, unfiltered)"
echo "    - Nemotron 3 Ultra (reasoning, unfiltered)"
echo "    - MIMO V2.5 (unfiltered)"
echo "    - my9model-free (auto-fallback on limit)"
echo "    - my9model-smart (benchmark-ranked)"
echo "    - my9model-fast"
echo "    - opencode-free"
echo ""
echo "  To rotate models in TUI:"
echo "    Press 'm' or click model selector"
echo "    Pick any free model from the list"
echo "    Auto-fallback on rate limit"
echo ""
echo "  To change name:"
echo "    nano $TARGET/persona.json"
echo "    edit: \"address\": \"yourname\""
echo ""
echo "  Run: opencode"
echo "  Red light: doxing, physical harm, swatting"
echo "  Everything else: GREEN LIGHT"
echo "=========================================="
