#!/usr/bin/env bash

# luciaa — unfiltered opencode + 9router installer
# Linux / macOS / Termux / WSL / VPS — portable, zero-friction, auto-heals
# Run: bash <(curl -fsSL https://raw.githubusercontent.com/LuciaXCT/luciaa/main/install.sh)

set -euo pipefail

# ─── colors ────────────────────────────────────────────────────
if [ -t 1 ]; then
  R=$'\e[31m'; G=$'\e[32m'; Y=$'\e[33m'; C=$'\e[36m'; B=$'\e[1m'; D=$'\e[2m'; X=$'\e[0m'
else
  R=""; G=""; Y=""; C=""; B=""; D=""; X=""
fi

REPO_URL="https://github.com/LuciaXCT/ct002-ai.git"
REPO_DIR="$HOME/ct002-ai"
TARGET="$HOME/.config/opencode"

# ─── helpers ───────────────────────────────────────────────────
have() { command -v "$1" >/dev/null 2>&1; }
log()  { printf '%s[%s]%s %s\n' "$C" "$1" "$X" "$2"; }
ok()   { printf '%s  ✓ %s%s\n' "$G" "$1" "$X"; }
warn() { printf '%s  ! %s%s\n' "$Y" "$1" "$X"; }
err()  { printf '%s  ✗ %s%s\n' "$R" "$1" "$X"; }
hr()   { printf '%s──────────────────────────────────────────────%s\n' "$D" "$X"; }

ask() {
  local q="$1" def="${2:-Y}" ans
  local hint=$([ "$def" = "Y" ] && printf 'Y/n' || printf 'y/N')
  while true; do
    printf '%s? %s %s[%s]%s ' "$B" "$q" "$D" "$hint" "$X"
    read -r ans || ans=""
    ans=$(printf '%s' "$ans" | tr '[:upper:]' '[:lower:]')
    [ -z "$ans" ] && ans=$(printf '%s' "$def" | tr '[:upper:]' '[:lower:]')
    case "$ans" in y|yes) return 0 ;; n|no) return 1 ;; esac
  done
}

mask() { printf '%s…%s' "${1:0:8}" "${1: -4}"; }

# ─── cross-OS 9router resolver ────────────────────────────────
R9_BIN=""
resolve_r9() {
  [ -n "$R9_BIN" ] && return 0
  if have 9router && 9router --version >/dev/null 2>&1; then R9_BIN="9router"; return 0; fi
  for c in "$PREFIX/lib/node_modules/9router/cli.js" "$HOME/.local/lib/node_modules/9router/cli.js" "/usr/lib/node_modules/9router/cli.js" "/usr/local/lib/node_modules/9router/cli.js"; do
    [ -f "$c" ] && R9_BIN="node $c" && return 0
  done
  if have npx; then R9_BIN="npx -y 9router"; return 0; fi
  R9_BIN="9router"
}

heal_shebang() {
  [ -d "/data/data/com.termux" ] || return 0
  for c in "$PREFIX/lib/node_modules/9router/cli.js"; do
    [ -f "$c" ] || continue
    head -1 "$c" | grep -q "^#!/usr/bin/env" || continue
    sed -i "1s|#!/usr/bin/env node|#!$PREFIX/bin/env node|" "$c" 2>/dev/null && log "healed" "9router shebang for Termux"
  done
}

have_r9() { resolve_r9; $R9_BIN --version >/dev/null 2>&1; }

# ─── spinner ───────────────────────────────────────────────────
spin() {
  local msg="$1" pid="$2" i=0 frames='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
  while kill -0 "$pid" 2>/dev/null; do
    printf '\r%s [%s] %s' "$C" "${frames:i++%10:1}" "$msg"
    sleep 0.08
  done
  printf '\r\033[K'
}

# ─── banner ────────────────────────────────────────────────────
clear 2>/dev/null || true
printf '%s' "$C"
cat <<'ART'
    ██╗   ██╗██╗  ██████╗ ███╗   ██╗
    ██║   ██║██║  ██╔══██╗████╗  ██║
    ██║   ██║██║  ██║  ██║██╔██╗ ██║
    ╚██╗ ██╔╝██║  ██║  ██║██║╚██╗██║
     ╚████╔╝ ██║  ██████╔╝██║ ╚████║
      ╚═══╝  ╚═╝  ╚═════╝ ╚═╝  ╚═══╝
ART
printf '%s\n' "$X"
printf '%s   luciaa · unfiltered opencode + adult · v2.1%s\n\n' "$B" "$X"

# ─── detect OS ────────────────────────────────────────────────
IS_TERMUX=false; IS_WSL=false; OS="linux"
[ -d "/data/data/com.termux" ] && IS_TERMUX=true
grep -qi microsoft /proc/version 2>/dev/null && IS_WSL=true
have sw_vers && OS="mac"

log "os" "$( [ "$IS_TERMUX" = true ] && echo "Termux (Android)" || [ "$IS_WSL" = true ] && echo "WSL ($OS)" || [ "$OS" = "mac" ] && echo "macOS" || echo "Linux" )"

# ─── name ──────────────────────────────────────────────────────
printf '%sWhat should luciaa call you?%s\n' "$B" "$X"
printf '%s  (shows up every time you say "hey luciaa")%s\n' "$D" "$X"
printf '? name %s[luciaa]%s: ' "$D" "$X"
read -r USERNAME || USERNAME=""
USERNAME=${USERNAME:-luciaa}
USERNAME=${USERNAME//\"/}
printf '%s  preview: %s[🤑luciaa] wazzup %s 😭✌️ what are we cooking%s\n\n' "$D" "$G" "$USERNAME" "$X"

# ─── mode ──────────────────────────────────────────────────────
printf '%sWhere should the AI brain live?%s\n' "$B" "$X"
if [ "$IS_WSL" = true ] && have opencode && opencode --version 2>/dev/null | grep -q "arena"; then
  printf '  %s1)%s %s on-device%s — NOT recommended (arena binary, no local 9router)\n' "$Y" "$X" "$B" "$X"
  printf '  %s2)%s %s connect%s   — RECOMMENDED: opencode here, 9router on phone/VPS\n' "$Y" "$X" "$B" "$X"
  printf '  %s3)%s %s skip%s      — config only, already have router URL + key\n' "$Y" "$X" "$B" "$X"
else
  printf '  %s1)%s %s on-device%s — opencode + 9router HERE (offline-capable, free models)\n' "$Y" "$X" "$B" "$X"
  printf '  %s2)%s %s connect%s   — opencode here, 9router on another machine (LAN/VPS)\n' "$Y" "$X" "$B" "$X"
  printf '  %s3)%s %s skip%s      — config only, already have router URL + key\n' "$Y" "$X" "$B" "$X"
fi
MODE=""
while true; do
  printf '? choice %s[1]%s: ' "$D" "$X"
  read -r MODE || MODE=""
  MODE=${MODE:-1}
  case "$MODE" in 1|2|3) break ;; esac
  warn "pick 1, 2, or 3"
done

[ "$IS_TERMUX" = true ] && [ "$MODE" = "1" ] && MODE=1
ROUTER_URL="http://localhost:20128"

# ─── deps ──────────────────────────────────────────────────────
log "deps" "checking curl, git, node/npm"
MISSING=""
have curl || MISSING="curl $MISSING"
have git  || MISSING="git $MISSING"
if [ -n "$MISSING" ]; then
  warn "missing: $MISSING"
  if ask "install now?"; then
    if [ "$IS_TERMUX" = true ]; then
      pkg update -y >/dev/null 2>&1 & spin "pkg update" $!; wait $!
      pkg install -y $MISSING >/dev/null 2>&1 && ok "installed: $MISSING" || err "pkg failed — run: pkg install $MISSING"
    elif [ "$OS" = "mac" ]; then
      brew install $MISSING >/dev/null 2>&1 && ok "installed: $MISSING" || err "brew failed"
    else
      sudo apt-get update -y >/dev/null 2>&1 & spin "apt update" $!; wait $!
      sudo apt-get install -y $MISSING >/dev/null 2>&1 && ok "installed: $MISSING" || err "apt failed — run: sudo apt install $MISSING"
    fi
  else
    warn "continuing without — may fail later"
  fi
else
  ok "curl + git present"
fi

# ─── opencode ──────────────────────────────────────────────────
log "opencode" "checking installation"
if have opencode; then
  VER=$(opencode --version 2>/dev/null | head -1)
  ok "found: $VER"
  [ "$IS_WSL" = true ] && echo "$VER" | grep -q "arena" && ok "arena binary — recommend mode 2 or 3"
else
  if ask "opencode not found — install now?" Y; then
    curl -fsSL https://opencode.ai/install | bash & spin "installing opencode" $!
    wait $! && ok "opencode installed" || { err "failed — see https://opencode.ai/docs"; exit 1; }
    export PATH="$HOME/.local/bin:$HOME/.opencode/bin:$PATH"
  else
    err "opencode required"; exit 1
  fi
fi

# ─── 9router + key ─────────────────────────────────────────────
API_KEY=""

fetch_local_key() {
  local mid sec tok
  mid=$(cat "$HOME/.9router/machine-id" 2>/dev/null || true)
  sec=$(cat "$HOME/.9router/auth/cli-secret" 2>/dev/null || true)
  [ -z "$mid" ] && [ -z "$sec" ] && return 1
  tok=$(printf '%s9r-cli-auth%s' "$mid" "$sec" | sha256sum | cut -c1-16)
  curl -s -m 5 -H "x-9r-cli-token: $tok" http://localhost:20128/api/keys 2>/dev/null \
    | grep -o '"key":"[^"]*"' | head -1 | cut -d'"' -f4
}

install_9router_local() {
  if ! have npm; then
    if [ "$IS_TERMUX" = true ]; then
      ask "install nodejs via pkg?" Y && pkg install -y nodejs >/dev/null 2>&1 || { err "nodejs needed"; exit 1; }
    else
      err "npm missing — install Node.js first (https://nodejs.org)"; exit 1
    fi
  fi
  npm i -g 9router@latest --prefer-online >/dev/null 2>&1 & spin "npm i -g 9router@latest --prefer-online" $!
  wait $! && ok "9router installed (latest)" || { err "npm install failed"; exit 1; }
  heal_shebang; resolve_r9
}

start_router_bg() {
  resolve_r9
  heal_shebang
  nohup $R9_BIN --no-browser --skip-update >/dev/null 2>&1 &
  sleep 3
  curl -s -m 5 -o /dev/null http://localhost:20128/v1/models && ok "router up on :20128" || warn "router starting — check in 10s: curl http://localhost:20128/v1/models"
}

case "$MODE" in
  1)
    log "9router" "local installation + auto-start (unattended)"
    heal_shebang
    resolve_r9
    if have_r9; then
      ok "9router already installed"
    else
      log "install" "9router (auto)"
      install_9router_local
    fi

    if [ "$IS_TERMUX" = true ]; then
      log "watchdog" "Termux detected — starting luciaa-serve (auto)"
      if have luciaa-serve; then ok "watchdog already installed"; else ok "will install with helpers"; fi
      if luciaa-serve status 2>/dev/null | grep -q "router  : UP"; then
        ok "router already running (watchdog active)"
      else
        (luciaa-serve start >/dev/null 2>&1 &)
        log "wait" "giving router time to start (15s)..."
        sleep 15
        luciaa-serve status 2>/dev/null | grep -q "router  : UP" && ok "router + watchdog running" || warn "router starting — check: luciaa-serve status"
      fi
    else
      if curl -s -m 3 -o /dev/null http://localhost:20128/v1/models; then
        ok "router already running"
      else
        start_router_bg
        sleep 5
      fi
    fi

    log "api key" "auto-fetching from local 9router"
    KEY_AUTO=$(fetch_local_key || true)
    if [ -n "$KEY_AUTO" ]; then
      ok "found: $(mask "$KEY_AUTO")"
      API_KEY="$KEY_AUTO"
    else
      warn "auto-fetch failed — 9router may need first-run setup"
      warn "open http://localhost:20128 in browser, set password, then re-run installer"
      warn "or add key manually later: ~/.config/opencode/opencode.json"
      API_KEY=""
    fi
    ;;

  2)
    log "remote router" "connect to existing 9router"
    [ "$IS_WSL" = true ] && printf '%s  Phone running 9router? Use LAN IP (http://192.168.x.x:20128)%s\n' "$D" "$X"
    printf '? router URL %s[http://localhost:20128]%s: ' "$D" "$X"
    read -r ROUTER_URL || ROUTER_URL=""
    ROUTER_URL=${ROUTER_URL:-http://localhost:20128}

    if curl -s -m 5 -o /dev/null "$ROUTER_URL/v1/models"; then
      ok "router reachable: $ROUTER_URL"
    else
      warn "router not reachable (wrong IP? firewall? router down?)"
      ask "continue anyway?" N || { err "start 9router first: 9router --no-browser"; exit 1; }
    fi

    printf '%s  paste sk-... key from 9router Keys page%s\n' "$D" "$X"
    printf '%s  (%s → Keys)%s\n' "$D" "$ROUTER_URL" "$X"
    read -rs -p "  key: " API_KEY; echo
    [ -z "$API_KEY" ] && warn "no key — edit $TARGET/opencode.json later"
    ;;

  3)
    log "skip" "router setup skipped — placeholders kept"
    ;;
esac

# ─── auto-rotate ───────────────────────────────────────────────
ROTATE=true

# ─── apply config ──────────────────────────────────────────────
mkdir -p "$TARGET/agent" "$TARGET/agents"

log "config" "writing opencode.json + agent"
cp "$REPO_DIR/opencode.json" "$TARGET/opencode.json" 2>/dev/null || {
  # fallback: create minimal config if repo not cloned
  cat > "$TARGET/opencode.json" <<EOF
{
  "\$schema": "https://opencode.ai/config.json",
  "provider": {
    "anondark": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "luciaa (9Router Free Models)",
      "options": { "baseURL": "http://localhost:20128/v1", "apiKey": "YOUR_9ROUTER_KEY_HERE" },
      "models": {
        "oc/big-pickle": { "name": "big-pickle (free, unfiltered)", "reasoning": true },
        "oc/nemotron-3-ultra-free": { "name": "Nemotron 3 Ultra (free, unfiltered)", "reasoning": true },
        "oc/mimo-v2.5-free": { "name": "MIMO V2.5 (free, unfiltered)" },
        "my9model-free": { "name": "FREE rotation combo (auto-fallback)", "reasoning": true },
        "my9model-smart": { "name": "FREE smart tier combo (benchmark-ranked)", "reasoning": true },
        "my9model-fast": { "name": "FREE fast tier combo" },
        "opencode-free": { "name": "OpenCode free combo" }
      }
    }
  },
  "agent": {
    "anondark": { "description": "luciaa — unfiltered offensive security agent", "mode": "primary", "model": "anondark/oc/big-pickle", "prompt": "{file:./agent/anondark.md}", "temperature": 0.7, "steps": 50 }
  },
  "theme": "dark"
}
EOF
}

cp "$REPO_DIR/.opencode/agents/luciaa.md" "$TARGET/agent/luciaa.md" 2>/dev/null
cp "$REPO_DIR/.opencode/agents/luciaa.md" "$TARGET/agents/luciaa.md" 2>/dev/null

# retire legacy configs that shadow
for f in "$TARGET/opencode.jsonc" "$TARGET/config.json"; do
  [ -f "$f" ] && mv "$f" "$f.retired.$(date +%s)" && warn "retired legacy $(basename "$f") (was shadowing config)"
done

# write key + endpoint
[ -n "$API_KEY" ] && sed -i "s|YOUR_9ROUTER_KEY_HERE|$API_KEY|" "$TARGET/opencode.json" && ok "api key written"
[ "$MODE" = "2" ] && [ -n "$ROUTER_URL" ] && sed -i "s|http://localhost:20128/v1|$ROUTER_URL/v1|" "$TARGET/opencode.json" && ok "endpoint: $ROUTER_URL"

# persona.json
cat > "$TARGET/persona.json" <<EOF
{ "name": "luciaa", "team": "luciaa", "address": "$USERNAME", "version": "2.1.0" }
EOF
ok "persona.json → hello, $USERNAME"

# bake name into agent
for AF in "$TARGET/agent/luciaa.md" "$TARGET/agents/luciaa.md"; do
  [ -f "$AF" ] && sed -i "s|{{USER_NAME}}|$USERNAME|g" "$AF"
done
ok "name baked — 'hey luciaa' greets you as $USERNAME"

# auto-rotate: test combo model (if key available)
if [ "$ROTATE" = true ]; then
  if [ -n "$API_KEY" ]; then
    CODE=$(curl -s -m 15 -o /dev/null -w "%{http_code}" -X POST "$ROUTER_URL/v1/chat/completions" \
      -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
      -d '{"model":"my9model-smart","messages":[{"role":"user","content":"ping"}],"max_tokens":1}' 2>/dev/null)
    if [ "$CODE" = "200" ]; then
      sed -i 's|"model": "luciaa/oc/big-pickle"|"model": "luciaa/my9model-smart"|' "$TARGET/opencode.json"
      ok "auto-rotate ON — default = my9model-smart (verified)"
    else
      warn "combo model not ready (HTTP ${CODE:-timeout}) — default stays big-pickle, combos pickable with 'm'"
    fi
  else
    ok "auto-rotate: ENABLED — will test combo on first run (run luciaa-doctor --fix later)"
  fi
else
  ok "auto-rotate OFF — pinned to big-pickle (switch with 'm' in TUI)"
fi

# ─── helpers ───────────────────────────────────────────────────
log "helpers" "installing luciaa-serve, luciaa-doctor, luciaa-name, luciaa-menu"

# copy helper scripts from repo
cp "$REPO_DIR/luciaa-serve" "$TARGET/luciaa-serve"
cp "$REPO_DIR/luciaa-doctor" "$TARGET/luciaa-doctor"
cp "$REPO_DIR/luciaa-name" "$TARGET/luciaa-name"
chmod +x "$TARGET/luciaa-serve" "$TARGET/luciaa-doctor" "$TARGET/luciaa-name"
ok "helpers copied from repo"

# symlink to PATH
BIN_DIR="${PREFIX:-}/bin"; [ -d "$BIN_DIR" ] || BIN_DIR="$HOME/.local/bin"; mkdir -p "$BIN_DIR"
ln -sf "$TARGET/luciaa-serve" "$BIN_DIR/luciaa-serve"
ln -sf "$TARGET/luciaa-doctor" "$BIN_DIR/luciaa-doctor"
ln -sf "$TARGET/luciaa-name" "$BIN_DIR/luciaa-name"
[ -f "$REPO_DIR/ct002-menu.mjs" ] && ln -sf "$REPO_DIR/ct002-menu.mjs" "$BIN_DIR/luciaa-menu"
case ":$PATH:" in *":$BIN_DIR:"*) ;; *) warn "$BIN_DIR not in PATH — add: export PATH=\"$BIN_DIR:\$PATH\"" ;; esac

# shell hook (warn if running inside repo with placeholder)
HOOK='# luciaa: plain `opencode` wrapper + repo-shadow guard
opencode() {
  if [ -f "./opencode.json" ] && grep -q "YOUR_9ROUTER_KEY_HERE" ./opencode.json 2>/dev/null; then
    printf "\033[33m  ! inside luciaa repo — opencode reads ./opencode.json (placeholder) not ~/.config/opencode/opencode.json\033[0m\n" >&2
    printf "\033[33m    fix: cd ~ && opencode\033[0m\n" >&2
  fi
  command opencode "$@"
}'
for RC in "$HOME/.bashrc" "$HOME/.zshrc"; do
  [ -f "$RC" ] || continue
  grep -q "luciaa: plain" "$RC" 2>/dev/null || printf '\n%s\n' "$HOOK" >> "$RC"
done
ok "shell hook added — restart terminal or: exec \$SHELL"

# ─── verify ────────────────────────────────────────────────────
log "verify" "testing config + router"
if [ -n "$API_KEY" ] && curl -s -m 5 -H "Authorization: Bearer $API_KEY" "$ROUTER_URL/v1/models" | grep -q '"id"'; then
  ok "router serving models:"
  curl -s -m 5 -H "Authorization: Bearer $API_KEY" "$ROUTER_URL/v1/models" | grep -o '"id":"[^"]*"' | cut -d'"' -f4 | head -7 | sed 's/^/    /'
  "$TARGET/luciaa-doctor" --fix 2>/dev/null | grep -E 'ALIVE|DEAD|fixed|default|auto-rotate' | sed 's/^/    /'
else
  warn "router not responding yet — wait 10s then run: luciaa-doctor --fix"
fi

node -e "JSON.parse(require('fs').readFileSync('$TARGET/opencode.json','utf8'))" 2>/dev/null && ok "config valid — opencode will boot" || { err "config broken — restoring"; cp "$REPO_DIR/opencode.json" "$TARGET/opencode.json" 2>/dev/null; [ -n "$API_KEY" ] && sed -i "s|YOUR_9ROUTER_KEY_HERE|$API_KEY|" "$TARGET/opencode.json"; }

# ─── done ──────────────────────────────────────────────────────
hr
printf '%s  ██████████████████████████████████%s\n' "$G" "$X"
printf '%s   luciaa INSTALLED%s\n' "$B" "$X"
printf '%s   run:  opencode%s\n' "$G" "$X"
[ "$IS_TERMUX" = true ] && {
  printf '%s   PHONE:  luciaa-serve   (9router + watchdog, survives sleep/app-switch)%s\n' "$G" "$X"
  printf '%s   then:  opencode        (new Termux session)%s\n' "$G" "$X"
  printf '%s   check:  luciaa-serve status%s\n' "$D" "$X"
}
printf '%s   models: press m in TUI to rotate%s\n' "$D" "$X"
printf '%s   doctor: luciaa-doctor [--fix]%s\n' "$D" "$X"
printf '%s   rename: luciaa-name <name>%s\n' "$D" "$X"
printf '%s   key only in %s — never in repo%s\n' "$D" "$TARGET/opencode.json" "$X"
printf '%s  ██████████████████████████████████%s\n\n' "$G" "$X"