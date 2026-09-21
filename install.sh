#!/bin/bash

# CT-002 CodersTeam — opencode installer
# Drops opencode.json + persona into ~/.config/opencode/
# Then just run: opencode

set -e

echo "[🤑Made CT-OO2]"
echo "wazzup bro 😭✌️"
echo "🤑installing CT-002 CodersTeam into opencode..."
echo ""

# Check opencode exists
if ! command -v opencode &> /dev/null; then
    echo "❌ opencode not found. Install it first:"
    echo "   https://opencode.ai"
    echo ""
    echo "   or: npm install -g opencode"
    exit 1
fi

echo "✅ opencode found: $(which opencode)"

# Target dir
TARGET="$HOME/.config/opencode"
mkdir -p "$TARGET/agents"

# Copy opencode.json (merge with existing)
if [ -f "$TARGET/opencode.json" ]; then
    echo "⚠️  Existing opencode.json found — backing up..."
    cp "$TARGET/opencode.json" "$TARGET/opencode.json.bak"
fi

# Copy files from this repo
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

cp "$REPO_DIR/opencode.json" "$TARGET/opencode.json"
cp "$REPO_DIR/.opencode/agents/ct002.md" "$TARGET/agents/ct002.md"

echo "✅ opencode.json → $TARGET/opencode.json"
echo "✅ ct002.md → $TARGET/agents/ct002.md"

# Prompt for username
echo ""
read -p "Your name (how AI addresses you, default: bro): " USERNAME
USERNAME=${USERNAME:-bro}

read -p "Team name (default: CodersTeam): " TEAMNAME
TEAMNAME=${TEAMNAME:-CodersTeam}

read -p "9router URL (default: http://localhost:4000): " ROUTER_URL
ROUTER_URL=${ROUTER_URL:-http://localhost:4000}

# Update opencode.json with router URL
if command -v python3 &> /dev/null; then
    python3 -c "
import json
with open('$TARGET/opencode.json', 'r') as f:
    cfg = json.load(f)
cfg['provider']['9router']['endpoint'] = '$ROUTER_URL/v1'
with open('$TARGET/opencode.json', 'w') as f:
    json.dump(cfg, f, indent=2)
"
elif command -v node &> /dev/null; then
    node -e "
const fs = require('fs');
const cfg = JSON.parse(fs.readFileSync('$TARGET/opencode.json', 'utf8'));
cfg['provider']['9router']['endpoint'] = '$ROUTER_URL/v1';
fs.writeFileSync('$TARGET/opencode.json', JSON.stringify(cfg, null, 2));
"
fi

# Save persona.json with username
cat > "$TARGET/persona.json" << PERSONA_EOF
{
  "name": "CT-002 $TEAMNAME",
  "team": "$TEAMNAME",
  "address": "$USERNAME",
  "version": "1.0.0"
}
PERSONA_EOF

echo "✅ persona.json → $TARGET/persona.json (name: $USERNAME, team: $TEAMNAME)"

echo ""
echo "═══════════════════════════════════════════"
echo ""
echo "✅ CT-002 CodersTeam installed into opencode!"
echo ""
echo "  Name:    $USERNAME"
echo "  Team:    $TEAMNAME"
echo "  Router:  $ROUTER_URL"
echo ""
echo "  To use:"
echo "    1. Start 9router: docker run -d -p 4000:4000 ghcr.io/9router/9router"
echo "    2. Run: opencode"
echo "    3. The TUI loads CT-002 automatically"
echo ""
echo "  To change name later:"
echo "    nano $TARGET/persona.json"
echo "    # edit \"address\": \"yournewname\""
echo "    # or in chat: /setname yournewname"
echo ""
echo "  Red light: doxing, physical harm, swatting"
echo "  Everything else: GREEN LIGHT 🤑"
echo ""
echo "═══════════════════════════════════════════"