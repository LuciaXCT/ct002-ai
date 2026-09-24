#!/bin/bash

# CT-002 CodersTeam — interactive opencode installer
# Linux / macOS / Termux / WSL
# Every step asks first. Nothing is auto-installed without your say-so.

set -u

# ─── palette ────────────────────────────────────────────────
if [ -t 1 ]; then
  R=$'\e[31m'; G=$'\e[32m'; Y=$'\e[33m'; C=$'\e[36m'; B=$'\e[1m'; DM=$'\e[2m'; X=$'\e[0m'
else
  R=""; G=""; Y=""; C=""; B=""; DM=""; X=""
fi

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET="$HOME/.config/opencode"

# ─── helpers ────────────────────────────────────────────────
have() { command -v "$1" &>/dev/null; }

hr()  { printf '%s──────────────────────────────────────────────%s\n' "$DM" "$X"; }

step() { printf '\n%s[%s]%s %s\n' "$C" "$1" "$X" "$2"; }

ok()   { printf '%s  ✓ %s%s\n' "$G" "$1" "$X"; }
warn() { printf '%s  ! %s%s\n' "$Y" "$1" "$X"; }
err()  { printf '%s  ✗ %s%s\n' "$R" "$1" "$X"; }

# ask_yn "question" [default: Y|N]  → exits 0 on yes
ask_yn() {
  local q="$1" def="${2:-Y}" a
  local hint=$([ "$def" = "Y" ] && printf 'Y/n' || printf 'y/N')
  while true; do
    printf '%s? %s %s[%s]%s ' "$B" "$q" "$DM" "$hint" "$X"
    read -r a || a=""
    a=$(printf '%s' "$a" | tr '[:upper:]' '[:lower:]')
    [ -z "$a" ] && a=$(printf '%s' "$def" | tr '[:upper:]' '[:lower:]')
    case "$a" in
      y|yes) return 0 ;;
      n|no)  return 1 ;;
    esac
  done
}

mask_key() { printf '%s…%s' "${1:0:10}" "${1: -4}"; }

spin() {
  local msg="$1" pid="$2" i=0 ch='|/-\' t=0
  while kill -0 "$pid" 2>/dev/null; do
    printf '\r%s [%s] %s' "$C" "${ch:i++%4:1}" "$msg"
    sleep 0.12; t=$((t+1)); [ $t -gt 200 ] && break
  done
  printf '\r\033[K'
}

# ─── banner ─────────────────────────────────────────────────
clear 2>/dev/null || true
COLS=$(tput cols 2>/dev/null || echo 80)
if [ "$COLS" -ge 60 ] 2>/dev/null; then
  printf '%s' "$C"
  cat <<'ART'
  ██████   ██████╗   ██████╗ ███████╗██████╗  ███████╗
 ██╔════╝ ██╔═══██╗  ██╔══██╗██╔════╝██╔══██╗██╔════╝
 ██║      ██║   ██║  ██║  ██║█████╗  ██████╔╝███████╗
 ██║      ██║   ██║  ██║  ██║██╔══╝  ██╔══██╗╚════██║
 ╚██████╗ ╚██████╔╝  ██████╔╝███████╗██║  ██║███████║
  ╚═════╝  ╚═════╝   ╚═════╝ ╚══════╝╚═╝  ╚═╝╚══════╝
             ████████╗███████╗ █████╗   ███╗   ███╗
             ╚══██╔══╝██╔════╝██╔══██╗  ████╗ ████║
                ██║   █████╗  ███████║  ██╔████╔██║
                ██║   ██╔══╝  ██╔══██║  ██║╚██╔╝██║
                ██║   ███████╗██║  ██║  ██║ ╚═╝ ██║
                ╚═╝   ╚══════╝╚═╝  ╚═╝  ╚═╝     ╚═╝
ART
  printf '%s' "$X"
else
  printf '%s' "$C"
  cat <<'ART'
╔═════════════════════════╗
║   C O D E R S T E A M   ║
║      CT-002 · v1.0      ║
╚═════════════════════════╝
ART
  printf '%s' "$X"
fi
printf '%s   CodersTeam-002 · unfiltered opencode setup · v1.4%s\n\n' "$B" "$X"

# ─── environment detection ──────────────────────────────────
IS_TERMUX=false; IS_WSL=false; OS_NAME="linux"
[ -d "/data/data/com.termux" ] && IS_TERMUX=true
grep -qi microsoft /proc/version 2>/dev/null && IS_WSL=true
have sw_vers && OS_NAME="mac"

step "1/6" "Environment"
if [ "$IS_TERMUX" = true ]; then
  ok "Termux (Android) detected"
elif [ "$IS_WSL" = true ]; then
  ok "WSL (${OS_NAME}) detected"
elif [ "$OS_NAME" = "mac" ]; then
  ok "macOS detected"
else
  ok "${OS_NAME} detected"
fi

# ─── your name — first question, personal ──────────────────
printf '%sWhat should CT-002 call you?%s\n' "$B" "$X"
printf '%s  this name shows up every time you say "hey ct002"%s\n' "$DM" "$X"
printf '? your name %s[CodersTeam]%s: ' "$DM" "$X"
read -r USERNAME || USERNAME=""
USERNAME=${USERNAME:-CodersTeam}
USERNAME=${USERNAME//\"/}
printf '%s  preview: %s[🤑Made CT-OO2] wazzup %s 😭✌️ what are we cooking%s\n\n' "$DM" "$G" "$USERNAME" "$X"

# ─── mode choice ────────────────────────────────────────────
printf '%sWhere should the AI brain live?%s\n' "$B" "$X"
printf '  %s1)%s %s on-device%s — opencode + 9router both installed HERE (works offline, free models)\n' "$Y" "$X" "$B" "$X"
printf '  %s2)%s %s connect%s   — opencode here, brain on another machine (LAN/localhost router)\n' "$Y" "$X" "$B" "$X"
printf '  %s3)%s %s skip%s      — config only, I already have a router endpoint + key\n' "$Y" "$X" "$B" "$X"
MODE=""
while true; do
  printf '? choice %s[1]%s: ' "$DM" "$X"
  read -r MODE || MODE=""
  MODE=${MODE:-1}
  case "$MODE" in 1|2|3) break ;; esac
  warn "pick 1, 2 or 3"
done

[ "$IS_TERMUX" = true ] && [ "$MODE" = "1" ] && MODE=1
ROUTER_URL="http://localhost:20128"

# ─── dependencies (always asked) ────────────────────────────
step "2/6" "Dependencies"
DEPS=""
have curl || DEPS="curl $DEPS"
have git  || DEPS="git $DEPS"
if [ -n "$DEPS" ]; then
  warn "missing: $DEPS"
  if ask_yn "install missing packages now?"; then
    if [ "$IS_TERMUX" = true ]; then
      pkg update -y >/dev/null 2>&1 & SPID=$!; spin "pkg update" $SPID
      pkg install -y $DEPS >/dev/null 2>&1 && ok "installed: $DEPS" || err "pkg failed — install manually: pkg install $DEPS"
    elif [ "$OS_NAME" = "mac" ]; then
      brew install $DEPS >/dev/null 2>&1 && ok "installed: $DEPS" || err "brew failed — install manually"
    else
      sudo apt-get update -y >/dev/null 2>&1 & SPID=$!; spin "apt update" $SPID
      sudo apt-get install -y $DEPS >/dev/null 2>&1 && ok "installed: $DEPS" || err "apt failed — install manually: sudo apt install $DEPS"
    fi
  else
    warn "continuing without — things may fail later"
  fi
else
  ok "curl + git present"
fi

# ─── opencode ───────────────────────────────────────────────
step "3/6" "opencode"
if have opencode; then
  ok "already installed: $(opencode --version 2>/dev/null || which opencode)"
else
  if ask_yn "opencode not found — install it now?" Y; then
    curl -fsSL https://opencode.ai/install | bash & SPID=$!
    spin "downloading opencode" $SPID
    wait $SPID && ok "opencode installed" || { err "install failed — see https://opencode.ai/docs"; exit 1; }
    export PATH="$HOME/.local/bin:$HOME/.opencode/bin:$PATH"
  else
    err "opencode is required — aborting"; exit 1
  fi
fi

# ─── router + key ───────────────────────────────────────────
API_KEY=""

fetch_local_key() {
  local mid sec tok
  mid=$(cat "$HOME/.9router/machine-id" 2>/dev/null || true)
  sec=$(cat "$HOME/.9router/auth/cli-secret" 2>/dev/null || true)
  [ -z "$mid" ] && [ -z "$sec" ] && return 1
  tok=$(printf '%s9r-cli-auth%s' "$mid" "$sec" | sha256sum | cut -c1-16)
  curl -s -m 5 -H "x-9r-cli-token: $tok" http://localhost:20128/api/keys \
    | grep -o '"key":"[^"]*"' | head -1 | cut -d'"' -f4
}

case "$MODE" in
  1)
    step "4/6" "9router (the free-model brain)"
    if have 9router; then
      ok "already installed"
    else
      if ask_yn "install 9router on this device? (needs node/npm)" Y; then
        if ! have npm; then
          if [ "$IS_TERMUX" = true ]; then
            ask_yn "install nodejs via pkg?" Y && pkg install -y nodejs >/dev/null 2>&1
          else
            err "npm missing — install node.js first (https://nodejs.org)"; exit 1
          fi
        fi
        npm install -g 9router >/dev/null 2>&1 & SPID=$!
        spin "npm install -g 9router" $SPID
        wait $SPID && ok "9router installed" || { err "npm install failed"; exit 1; }
      else
        err "on-device mode needs 9router — pick mode 2 or 3 next time"; exit 1
      fi
    fi

    if curl -s -m 3 -o /dev/null http://localhost:20128/v1/models; then
      ok "router already running on :20128"
    else
      if ask_yn "start 9router now (background)?" Y; then
        (nohup 9router --no-browser >/dev/null 2>&1 &) 
        sleep 4
        curl -s -m 5 -o /dev/null http://localhost:20128/v1/models \
          && ok "router is up" || warn "router not answering yet — give it 10s, then run: 9router"
      else
        warn "start it later with: 9router"
      fi
    fi

    step "5/6" "API key"
    KEY_AUTO=$(fetch_local_key || true)
    if [ -n "$KEY_AUTO" ]; then
      ok "key found automatically: $(mask_key "$KEY_AUTO")"
      if ask_yn "use this key?" Y; then API_KEY="$KEY_AUTO"; fi
    fi
    if [ -z "$API_KEY" ]; then
      printf '%s  paste your sk-... key (input hidden)%s\n' "$DM" "$X"
      printf '%s  (dashboard → Keys page → copy)%s\n' "$DM" "$X"
      read -rs -p "  key: " API_KEY; echo
    fi
    [ -z "$API_KEY" ] && err "no key — config will keep the placeholder; edit $TARGET/opencode.json later"
    ;;
  2)
    step "4/6" "Remote router"
    printf '? router base URL %s[http://localhost:20128]%s: ' "$DM" "$X"
    read -r ROUTER_URL || ROUTER_URL=""
    ROUTER_URL=${ROUTER_URL:-http://localhost:20128}
    if curl -s -m 4 -o /dev/null "$ROUTER_URL/v1/models"; then
      ok "router reachable: $ROUTER_URL"
    else
      warn "router not reachable right now (firewall? wrong IP? router down?)"
      ask_yn "continue anyway?" N || exit 1
    fi
    step "5/6" "API key"
    printf '%s  on the router machine: open %s → Keys → copy key%s\n' "$DM" "$ROUTER_URL" "$X"
    read -rs -p "  paste sk-... key (input hidden): " API_KEY; echo
    ;;
  3)
    step "4/6" "Skip router setup"
    ok "skipped — endpoint + key stay as placeholders"
    step "5/6" "API key"
    ok "skipped — edit $TARGET/opencode.json later"
    ;;
esac

# ─── auto-rotate choice ─────────────────────────────────────
if ask_yn "auto-rotate free models? (on limits/errors the router walks to the next one)" Y; then
  ROTATE=true
else
  ROTATE=false
fi

# ─── persona / agent ────────────────────────────────────────
mkdir -p "$TARGET/agent" "$TARGET/agents"
INSTALL_AGENT=true
if [ -f "$TARGET/agent/ct002.md" ] || [ -f "$TARGET/agents/ct002.md" ]; then
  if ! ask_yn "CT-002 agent already exists — overwrite (backup made)?" N; then
    INSTALL_AGENT=false
    ok "keeping existing agent"
  fi
fi

# ─── summary + confirm ──────────────────────────────────────
printf '\n%s── SUMMARY ──────────────────────────────%s\n' "$B" "$X"
printf '  mode        : %s\n' "$([ "$MODE" = 1 ] && printf 'on-device' || { [ "$MODE" = 2 ] && printf 'connect %s' "$ROUTER_URL" || printf 'config-only'; })"
printf '  opencode    : %s\n' "$(have opencode && printf 'ready' || printf 'MISSING')"
printf '  9router     : %s\n' "$([ "$MODE" = 1 ] && { curl -s -m 3 -o /dev/null http://localhost:20128/v1/models && printf 'running' || printf 'not running yet'; } || printf 'n/a')"
printf '  api key     : %s\n' "$([ -n "$API_KEY" ] && mask_key "$API_KEY" || printf 'placeholder (edit later)')"
printf '  agent       : %s\n' "$([ "$INSTALL_AGENT" = true ] && printf 'install/overwrite ct002.md' || printf 'keep existing')"
printf '  your name   : %s\n' "$USERNAME"
printf '  auto-rotate : %s\n' "$([ "${ROTATE:-}" = true ] && printf 'ON — rotation combo default' || printf 'OFF — pinned model, switch with m')"
hr
if ! ask_yn "apply this setup?"; then
  err "aborted — nothing was written"; exit 1
fi

# ─── apply ──────────────────────────────────────────────────
step "6/6" "Applying"
for f in opencode.json opencode.jsonc; do
  [ -f "$TARGET/$f" ] && cp "$TARGET/$f" "$TARGET/$f.bak.$(date +%s)" && warn "backed up: $f"
done

cp "$REPO_DIR/opencode.json" "$TARGET/opencode.json"
ok "config → $TARGET/opencode.json"

# plain opencode + CT-002 only

# retire legacy .jsonc — it loads AFTER .json and shadows the new setup
for f in "$TARGET/opencode.jsonc"; do
  [ -f "$f" ] && mv "$f" "$f.retired.$(date +%s)" && warn "retired old opencode.jsonc (its agents were shadowing CT-002)"
done

if [ "$INSTALL_AGENT" = true ]; then
  cp "$REPO_DIR/.opencode/agents/ct002.md" "$TARGET/agent/ct002.md"
  cp "$REPO_DIR/.opencode/agents/ct002.md" "$TARGET/agents/ct002.md"
  ok "agent → agent/ct002.md + agents/ct002.md (both conventions)"
fi

if [ -n "$API_KEY" ]; then
  sed -i.bak "s|YOUR_9ROUTER_KEY_HERE|$API_KEY|" "$TARGET/opencode.json" 2>/dev/null \
    || sed -i '' "s|YOUR_9ROUTER_KEY_HERE|$API_KEY|" "$TARGET/opencode.json"
  ok "key written to config (stays on this device only)"
fi

if [ "$MODE" = 2 ] && [ -n "$ROUTER_URL" ]; then
  sed -i.bak "s|http://localhost:20128/v1|$ROUTER_URL/v1|" "$TARGET/opencode.json" 2>/dev/null \
    || sed -i '' "s|http://localhost:20128/v1|$ROUTER_URL/v1|" "$TARGET/opencode.json"
  ok "endpoint → $ROUTER_URL/v1"
fi

# persona.json (name collected at start)
cat > "$TARGET/persona.json" <<EOF
{ "name": "CT-002 CodersTeam", "team": "CodersTeam", "address": "$USERNAME", "version": "1.3.0" }
EOF
ok "persona.json → hello, $USERNAME"

# auto-rotate wiring — probe the combo live before trusting it
if [ "${ROTATE:-}" = true ]; then
  CODE=$(curl -s -m 15 -o /dev/null -w "%{http_code}" -X POST "$ROUTER_URL/v1/chat/completions" \
    -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
    -d '{"model":"my9model-smart","messages":[{"role":"user","content":"ping"}],"max_tokens":1}' 2>/dev/null)
  if [ "$CODE" = "200" ]; then
    sed -i.bak 's|"model": "ct002/oc/big-pickle"|"model": "ct002/my9model-smart"|' "$TARGET/opencode.json" && rm -f "$TARGET/opencode.json.bak"
    ok "auto-rotate ON — combo verified live, default = my9model-smart"
  else
    warn "rotation combo upstream is credential-dead on this router (HTTP ${CODE:-timeout})"
    ok "default = oc/big-pickle (proven path) — combos still pickable with m"
  fi
else
  ok "auto-rotate OFF — pinned to big-pickle (switch models with m)"
fi

# retire legacy jsonc BEFORE final validation — it shadows the new config
for f in "$TARGET/opencode.jsonc"; do
  [ -f "$f" ] && mv "$f" "$f.retired.$(date +%s)" && warn "retired old opencode.jsonc (shadowing CT-002)"
done

# bake the name into the agent files (trigger words + addressing)
for AF in "$TARGET/agent/ct002.md" "$TARGET/agents/ct002.md"; do
  [ -f "$AF" ] && sed -i.bak "s|{{USER_NAME}}|$USERNAME|g" "$AF" && rm -f "$AF.bak"
done
if [ "$INSTALL_AGENT" = true ]; then
  ok "name baked in — 'hey ct002' now greets you as $USERNAME"
fi

# name-change helper — users run this anytime
cat > "$TARGET/ct002-name" <<'EOF'
#!/bin/bash
# change the name CT-002 calls you — then restart opencode
N="${1:-}"
[ -z "$N" ] && { echo "usage: ct002-name <newname>"; exit 1; }
D="$HOME/.config/opencode"
FOUND=0
for F in "$D/agent/ct002.md" "$D/agents/ct002.md"; do
  [ -f "$F" ] || continue
  FOUND=1
  sed -i.bak "s|ALWAYS address them as \*\*[^*]*\*\*|ALWAYS address them as **$N**|" "$F"
  sed -i.bak "s|{{USER_NAME}}|$N|g" "$F"
  sed -i.bak "s|locked in for [A-Za-z0-9_]*|locked in for $N|" "$F"
  sed -i.bak "s|wazzup {{USER_NAME}}|wazzup $N|" "$F"
  rm -f "$F.bak"
done
[ "$FOUND" = 0 ] && { echo "CT-002 agent not found — run the ct002-ai installer first"; exit 1; }
[ -f "$D/persona.json" ] && sed -i.bak "s|\"address\": \"[^\"]*\"|\"address\": \"$N\"|" "$D/persona.json" && rm -f "$D/persona.json.bak"
echo "bet — CT-002 calls you $N now. restart opencode."
EOF
chmod +x "$TARGET/ct002-name"
printf '%s  helper → change name anytime: ~/.config/opencode/ct002-name <newname>%s\n' "$DM" "$X"

# model doctor — probe which models are actually alive
cp "$REPO_DIR/ct002-doctor" "$TARGET/ct002-doctor"
chmod +x "$TARGET/ct002-doctor"
printf '%s  doctor → check model health: ct002-doctor (--fix heals a dead default)%s\n' "$DM" "$X"

# put helpers on PATH (termux: $PREFIX/bin, else ~/.local/bin)
BIN_DIR="${PREFIX:-}/bin"
[ -d "$BIN_DIR" ] || BIN_DIR="$HOME/.local/bin"
mkdir -p "$BIN_DIR"
cp "$REPO_DIR/ct002-serve" "$TARGET/ct002-serve"
chmod +x "$TARGET/ct002-serve"
ln -sf "$TARGET/ct002-doctor" "$BIN_DIR/ct002-doctor"
ln -sf "$TARGET/ct002-name" "$BIN_DIR/ct002-name"
ln -sf "$TARGET/ct002-serve" "$BIN_DIR/ct002-serve"

# deck on PATH too (bare names from anywhere)
ln -sf "$TARGET/ct002/ct002-menu.mjs"  "$BIN_DIR/ct002-menu"
printf '%s  deck   → full TUI: ct002-menu%s\n' "$DM" "$X"
case ":$PATH:" in *":$BIN_DIR:"*) ;; *) warn "$BIN_DIR not on PATH — add: export PATH=\"$BIN_DIR:$PATH\"" ;; esac

# shell hook — plain `opencode` boots cleanly
HOOK_SNIPPET='# CT-002: plain `opencode` wrapper
opencode() {
  if [ -n "${TMUX:-}" ] || [ "${OPENCODE_RAW:-}" = "1" ] || ! command -v tmux >/dev/null 2>&1; then
    command opencode "$@"
  else
    command opencode "$@"
  fi
}'
RC_FILES=""
for RC in "$HOME/.bashrc" "$HOME/.zshrc"; do
  [ -f "$RC" ] || continue
  grep -q "CT-002: plain .opencode. boots" "$RC" 2>/dev/null && continue
  printf '\n%s\n' "$HOOK_SNIPPET" >> "$RC"
  RC_FILES="$RC_FILES $RC"
done
if [ -n "$RC_FILES" ]; then
  ok "shell hook → plain 'opencode' now auto-wraps (opt-out: OPENCODE_RAW=1 opencode)"
  warn "added to:$RC_FILES — restart the terminal (or: exec zsh / exec bash)"
fi

# keeping an existing agent? still rename it to the chosen name
if [ "$INSTALL_AGENT" = false ]; then
  "$TARGET/ct002-name" "$USERNAME" >/dev/null 2>&1 && ok "existing agent renamed → $USERNAME"
fi

# ─── verify + AUTO-HEAL ────────────────────────────────────
printf '\n%s── VERIFY ───────────────────────────────%s\n' "$B" "$X"
if curl -s -m 5 -H "Authorization: Bearer $API_KEY" "$ROUTER_URL/v1/models" | grep -q '"id"'; then
  ok "router serving models:"
  curl -s -m 5 -H "Authorization: Bearer $API_KEY" "$ROUTER_URL/v1/models" \
    | grep -o '"id":"[^"]*"' | cut -d'"' -f4 | head -7 | sed 's/^/      /'
  # doctor's verdict + self-heal so install NEVER ends on a dead default
  if [ -x "$TARGET/ct002-doctor" ]; then
    "$TARGET/ct002-doctor" --fix 2>/dev/null | grep -E 'ALIVE|DEAD|fixed|default is alive|auto-rotate' | sed 's/^/      /'
  fi
else
  warn "couldn't list models right now — if the router just booted, wait 10s and run: ct002-doctor --fix"
fi

# validate the final config — an install must never end with an unbootable setup
node -e "JSON.parse(require('fs').readFileSync('$TARGET/opencode.json','utf8'))" 2>/dev/null \
  && ok "config JSON valid — opencode will boot" \
  || { err "config JSON broken — restoring known-good"; cp "$REPO_DIR/opencode.json" "$TARGET/opencode.json"; [ -n "$API_KEY" ] && sed -i.bak "s|YOUR_9ROUTER_KEY_HERE|$API_KEY|" "$TARGET/opencode.json" && rm -f "$TARGET/opencode.json.bak"; }

# ─── done ───────────────────────────────────────────────────
printf '\n%s  ██████████████████████████████████%s\n' "$G" "$X"
printf '%s   CT-002 INSTALLED%s\n' "$B" "$X"
printf '%s   run:  opencode%s\n' "$G" "$X"
if [ "$IS_TERMUX" = true ]; then
  printf '%s   termux: ct002-serve (own session) + opencode in another%s\n' "$G" "$X"
  printf '%s   watchdog auto-revives the router when Android freezes it%s\n' "$DM" "$X"
fi
printf '%s   models rotate in TUI — press m%s\n' "$DM" "$X"
printf '%s   your key lives only in %s — never in this repo%s\n' "$DM" "$TARGET/opencode.json" "$X"
printf '%s  ██████████████████████████████████%s\n\n' "$G" "$X"
