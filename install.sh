#!/usr/bin/env bash

# luciaa — unfiltered opencode + 9router installer  (v2.2)
# Linux / macOS / Termux / WSL / VPS — portable, zero-friction, auto-heals
#
# Run:   bash <(curl -fsSL https://raw.githubusercontent.com/LuciaXCT/luciaa/main/install.sh)
#
# Flags:
#   -y, --yes           non-interactive (accept every default)
#       --name <n>      display name (skips the prompt)
#       --mode <1|2|3>  1=on-device  2=connect  3=skip router setup
#       --no-dedup      skip the duplicate-cleanup pass
#       --dedup-only    clean duplicates and exit
#       --no-path       do not touch shell rc files (PATH)
#       --opencode <m>  auto | official | termux | skip
#       --skip-opencode same as --opencode skip
#   -h, --help          this help
#
# Env overrides: LUCIA_NAME, LUCIA_MODE, LUCIA_ASSUME_YES=1, LUCIA_NO_DEDUP=1,
#                LUCIA_PATH=0, LUCIA_OPENCODE=auto|official|termux|skip
#
# NOTE ON `set -e`: we deliberately run with `set -uo pipefail` and NOT `-e`.
# Fetching a helper, probing a dead model, or a failed optional `cp` must never
# abort a half-finished install. Every step that genuinely matters is checked
# explicitly and routed through `die`.

set -uo pipefail

# ─── colors ────────────────────────────────────────────────────
if [ -t 1 ]; then
  R=$'\e[31m'; G=$'\e[32m'; Y=$'\e[33m'; C=$'\e[36m'; B=$'\e[1m'; D=$'\e[2m'; X=$'\e[0m'
else
  R=""; G=""; Y=""; C=""; B=""; D=""; X=""
fi

REPO_URL="https://github.com/LuciaXCT/luciaa.git"
RAW_BASE="https://raw.githubusercontent.com/LuciaXCT/luciaa/main"
REPO_DIR_LEGACY="$HOME/ct002-ai"
TARGET="$HOME/.config/opencode"

# ─── args / env ────────────────────────────────────────────────
ASSUME_YES=false
DO_DEDUP=true
DEDUP_ONLY=false
ADD_PATH=true
ARG_NAME=""
ARG_MODE=""
OPENCODE_MODE="auto"
[ "${LUCIA_ASSUME_YES:-}" = "1" ] && ASSUME_YES=true
[ "${LUCIA_NO_DEDUP:-}" = "1" ] && DO_DEDUP=false
[ "${LUCIA_PATH:-}" = "0" ] && ADD_PATH=false
[ -n "${LUCIA_NAME:-}" ] && ARG_NAME="$LUCIA_NAME"
[ -n "${LUCIA_MODE:-}" ] && ARG_MODE="$LUCIA_MODE"
[ -n "${LUCIA_OPENCODE:-}" ] && OPENCODE_MODE="$LUCIA_OPENCODE"

while [ $# -gt 0 ]; do
  case "$1" in
    -y|--yes) ASSUME_YES=true ;;
    --name) shift; ARG_NAME="${1:-}" ;;
    --name=*) ARG_NAME="${1#*=}" ;;
    --mode) shift; ARG_MODE="${1:-}" ;;
    --mode=*) ARG_MODE="${1#*=}" ;;
    --no-dedup) DO_DEDUP=false ;;
    --dedup-only) DEDUP_ONLY=true ;;
    --no-path) ADD_PATH=false ;;
    --add-path) ADD_PATH=true ;;
    --skip-opencode) OPENCODE_MODE=skip ;;
    --opencode) shift; OPENCODE_MODE="${1:-auto}" ;;
    --opencode=*) OPENCODE_MODE="${1#*=}" ;;
    -h|--help)
      sed -n '2,24p' "$0" 2>/dev/null | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) ;;
  esac
  shift
done

# ─── helpers ───────────────────────────────────────────────────
have() { command -v "$1" >/dev/null 2>&1; }
log()  { printf '%s[%s]%s %s\n' "$C" "$1" "$X" "$2"; }
ok()   { printf '%s  ✓ %s%s\n' "$G" "$1" "$X"; }
warn() { printf '%s  ! %s%s\n' "$Y" "$1" "$X"; }
err()  { printf '%s  ✗ %s%s\n' "$R" "$1" "$X"; }
hr()   { printf '%s──────────────────────────────────────────────%s\n' "$D" "$X"; }
die()  { err "$1"; exit 1; }

ask() {
  local q="$1" def="${2:-Y}" ans hint
  if [ "$ASSUME_YES" = true ]; then
    [ "$def" = "Y" ] && return 0 || return 1
  fi
  [ "$def" = "Y" ] && hint='Y/n' || hint='y/N'
  while true; do
    printf '%s? %s %s[%s]%s ' "$B" "$q" "$D" "$hint" "$X"
    read -r ans || ans=""
    ans=$(printf '%s' "$ans" | tr '[:upper:]' '[:lower:]')
    [ -z "$ans" ] && ans=$(printf '%s' "$def" | tr '[:upper:]' '[:lower:]')
    case "$ans" in y|yes) return 0 ;; n|no) return 1 ;; esac
  done
}

mask() { printf '%s…%s' "${1:0:8}" "${1: -4}"; }

realpath_of() {
  if command -v realpath >/dev/null 2>&1; then realpath -- "$1" 2>/dev/null || printf '%s' "$1"
  elif command -v python3 >/dev/null 2>&1; then python3 -c 'import os,sys;print(os.path.realpath(sys.argv[1]))' "$1" 2>/dev/null || printf '%s' "$1"
  else printf '%s' "$1"; fi
}

# ─── detect OS (early — dedup + heals depend on it) ───────────
IS_TERMUX=false; IS_WSL=false; OS="linux"
[ -d "/data/data/com.termux" ] && IS_TERMUX=true
# override for odd setups / testing the Termux path off-device
[ "${LUCIA_FORCE_TERMUX:-}" = "1" ] && IS_TERMUX=true
grep -qi microsoft /proc/version 2>/dev/null && IS_WSL=true
have sw_vers && OS="mac"
PREFIX="${PREFIX:-}"
PREFIX_BIN=""
[ -n "$PREFIX" ] && [ -d "$PREFIX/bin" ] && PREFIX_BIN="$PREFIX/bin"

# ─── spinner ───────────────────────────────────────────────────
spin() {
  local msg="$1" pid="$2" i=0 frames='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
  while kill -0 "$pid" 2>/dev/null; do
    printf '\r%s [%s] %s' "$C" "${frames:i++%10:1}" "$msg"
    sleep 0.08
  done
  printf '\r\033[K'
}

# ─── cross-OS 9router resolver ────────────────────────────────
R9_BIN=""
resolve_r9() {
  [ -n "$R9_BIN" ] && return 0
  if have 9router && 9router --version >/dev/null 2>&1; then R9_BIN="9router"; return 0; fi
  for c in "$PREFIX/lib/node_modules/9router/cli.js" "$HOME/.local/lib/node_modules/9router/cli.js" "/usr/lib/node_modules/9router/cli.js" "/usr/local/lib/node_modules/9router/cli.js" "$HOME/.npm-global/lib/node_modules/9router/cli.js" "$HOME/.npm/lib/node_modules/9router/cli.js"; do
    [ -f "$c" ] && R9_BIN="node $c" && return 0
  done
  if have npx; then R9_BIN="npx -y 9router"; return 0; fi
  R9_BIN="9router"
}

# heal a shebang for Termux (no /usr/bin/env, no /bin/bash)
heal_shebang_file() {
  local f="$1" h
  [ -f "$f" ] || return 0
  [ "$IS_TERMUX" = true ] || return 0
  h="$(head -1 "$f" 2>/dev/null)"
  case "$h" in
    '#!/usr/bin/env bash'|'#!/bin/bash') sed -i "1s|.*|#!$PREFIX/bin/bash|" "$f" 2>/dev/null ;;
    '#!/usr/bin/env node'|'#!/usr/bin/node') sed -i "1s|.*|#!$PREFIX/bin/env node|" "$f" 2>/dev/null ;;
  esac
}

heal_r9_shebang() {
  [ "$IS_TERMUX" = true ] || return 0
  local c
  for c in "$PREFIX/lib/node_modules/9router/cli.js" "$HOME/.local/lib/node_modules/9router/cli.js"; do
    [ -f "$c" ] || continue
    head -1 "$c" | grep -q '^#!/usr/bin/env' || continue
    sed -i "1s|#!/usr/bin/env node|#!$PREFIX/bin/env node|" "$c" 2>/dev/null && log "healed" "9router shebang for Termux ($c)"
  done
}

have_r9() { resolve_r9; $R9_BIN --version >/dev/null 2>&1; }

wait_for_router() {
  local url="${1:-http://localhost:20128}" tries="${2:-20}" i=0
  while [ "$i" -lt "$tries" ]; do
    curl -s -m 3 -o /dev/null "$url/v1/models" 2>/dev/null && return 0
    i=$((i+1)); sleep 1
  done
  return 1
}

# ─── source provisioning ───────────────────────────────────────
# The installer must be able to bootstrap itself from a bare `curl | bash`.
# It no longer assumes ~/ct002-ai exists — that assumption is what used to
# abort a fresh install at the first `cp`.
SRC_DIR=""
SRC_SELF=""
[ -n "${BASH_SOURCE[0]:-}" ] && SRC_SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"

resolve_src() {
  if [ -n "$SRC_SELF" ] && [ -f "$SRC_SELF/luciaa-serve" ] && [ -f "$SRC_SELF/opencode.json" ]; then
    SRC_DIR="$SRC_SELF"; return 0
  fi
  if [ -f "$REPO_DIR_LEGACY/luciaa-serve" ] && [ -f "$REPO_DIR_LEGACY/opencode.json" ]; then
    SRC_DIR="$REPO_DIR_LEGACY"; return 0
  fi
  SRC_DIR="$HOME/.local/share/luciaa/src"
  log "src" "fetching luciaa sources → $SRC_DIR"
  if [ -d "$SRC_DIR/.git" ]; then
    git -C "$SRC_DIR" pull --ff-only -q 2>/dev/null || warn "could not refresh sources (using cached copy)"
  else
    mkdir -p "$(dirname "$SRC_DIR")" 2>/dev/null
    git clone --depth 1 -q "$REPO_URL" "$SRC_DIR" 2>/dev/null || warn "clone failed — falling back to raw downloads"
  fi
}

# copy a repo-relative file to a destination, from the clone or from raw GitHub.
# never returns non-zero in a way that aborts the run.
copy_from_src() {
  local rel="$1" dest="$2" mode="${3:-}"
  if [ -n "$SRC_DIR" ] && [ -f "$SRC_DIR/$rel" ]; then
    if cp "$SRC_DIR/$rel" "$dest" 2>/dev/null; then
      [ -n "$mode" ] && chmod "$mode" "$dest" 2>/dev/null
      return 0
    fi
  fi
  if curl -fsSL "$RAW_BASE/$rel" -o "$dest" 2>/dev/null; then
    [ -n "$mode" ] && chmod "$mode" "$dest" 2>/dev/null
    return 0
  fi
  return 1
}

# ─── duplicate cleanup (runs BEFORE installation) ─────────────
BACKUP_ROOT=""
ensure_backup_root() {
  [ -n "$BACKUP_ROOT" ] && return 0
  BACKUP_ROOT="$HOME/.luciaa-dedup-backup-$(date +%Y%m%d%H%M%S)"
}

retire() {
  local p="$1" br d
  [ -e "$p" ] || [ -L "$p" ] || return 0
  d="$(dirname "$p")"
  [ -w "$d" ] || { warn "skipped (not writable): $p"; return 1; }
  ensure_backup_root
  br="$BACKUP_ROOT"
  mkdir -p "$br/$(dirname "${p#/}")" 2>/dev/null
  if mv "$p" "$br/${p#/}" 2>/dev/null; then
    ok "retired duplicate: $p"
    return 0
  fi
  warn "could not retire: $p"
  return 1
}

dedup_config_shadows() {
  local f
  for f in "$TARGET/opencode.jsonc" "$TARGET/config.json"; do
    [ -f "$f" ] || continue
    retire "$f" && warn "legacy config was shadowing opencode.json"
  done
}

dedup_helper_symlinks() {
  local b d
  for b in "$PREFIX_BIN" "$HOME/.local/bin"; do
    [ -n "$b" ] || continue
    for d in luciaa-serve luciaa-doctor luciaa-name luciaa-menu ct002-serve ct002-doctor ct002-name ct002-persona; do
      [ -L "$b/$d" ] || continue
      [ -e "$b/$d" ] && continue
      retire "$b/$d" >/dev/null 2>&1 && ok "removed broken symlink: $b/$d"
    done
  done
}

dedup_opencode() {
  log "dedup" "scanning for duplicate opencode installs"
  local -a cands=()
  local p rp
  while IFS= read -r p; do
    p="${p% }"; [ -n "$p" ] && cands+=("$p")
  done < <(type -a opencode 2>/dev/null | sed -n 's/^opencode is //p')
  for p in "$PREFIX/bin/opencode" "$HOME/.local/bin/opencode" "$HOME/.opencode/bin/opencode" "/usr/local/bin/opencode" "$HOME/.npm-global/bin/opencode" "$HOME/bin/opencode"; do
    { [ -e "$p" ] || [ -L "$p" ]; } && cands+=("$p")
  done

  [ "${#cands[@]}" -eq 0 ] && { ok "no opencode installs found — installer will add one"; return 0; }

  # Prefer a copy that ACTUALLY RUNS. On Termux the upstream glibc build is
  # first on PATH and fails with "cannot execute: required file not found",
  # so keeping "first on PATH" would preserve a dead binary.
  local keep_path="" keep_real="" fallback_path="" fallback_real="" rp
  for p in "${cands[@]}"; do
    { [ -e "$p" ] || [ -L "$p" ]; } || continue
    rp="$(realpath_of "$p")"
    [ -n "$fallback_real" ] || { fallback_path="$p"; fallback_real="$rp"; }
    if "$p" --version >/dev/null 2>&1; then keep_path="$p"; keep_real="$rp"; break; fi
  done
  if [ -z "$keep_real" ]; then
    keep_path="$fallback_path"; keep_real="$fallback_real"
    [ -n "$keep_real" ] && warn "no working opencode found — keeping $keep_path anyway"
  fi
  [ -z "$keep_real" ] && return 0
  ok "keeping opencode: $keep_path"

  local removed=0
  for p in "${cands[@]}"; do
    { [ -e "$p" ] || [ -L "$p" ]; } || continue
    [ "$p" = "$keep_path" ] && continue
    rp="$(realpath_of "$p")"
    if [ "$rp" = "$keep_real" ]; then
      retire "$p" && removed=$((removed+1))
    else
      retire "$p" && removed=$((removed+1))
    fi
  done
  [ "$removed" -gt 0 ] && warn "$removed duplicate opencode path(s) retired to ${BACKUP_ROOT:-backup}" || ok "no duplicate opencode binaries"
}

dedup_9router() {
  log "dedup" "scanning for duplicate 9router installs"
  local -a clis=()
  local c p keep="" removed=0
  for c in "$PREFIX/lib/node_modules/9router/cli.js" "$HOME/.npm-global/lib/node_modules/9router/cli.js" "$HOME/.local/lib/node_modules/9router/cli.js" "/usr/local/lib/node_modules/9router/cli.js" "$HOME/.npm/lib/node_modules/9router/cli.js"; do
    [ -f "$c" ] && clis+=("$c")
  done
  [ "${#clis[@]}" -le 1 ] && { ok "single 9router install (${clis[0]:-none})"; return 0; }
  for c in "${clis[@]}"; do
    [ -z "$keep" ] && { keep="$c"; continue; }
    retire "$(dirname "$(dirname "$c")")/9router" && removed=$((removed+1))
  done
  # retire dangling 9router bin shims left behind
  while IFS= read -r p; do
    [ -n "$p" ] || continue
    [ -e "$p" ] || retire "$p" >/dev/null 2>&1
  done < <(type -a 9router 2>/dev/null | sed -n 's/^9router is //p')
  [ "$removed" -gt 0 ] && warn "$removed duplicate 9router install(s) retired" || ok "no duplicate 9router trees"
}

dedup_npm_globals() {
  have npm || return 0
  local out
  out="$(npm ls -g --depth=0 2>/dev/null | grep -oE '(opencode-ai|@opencode/[a-z-]+|9router)@[0-9][^ ]*' | sort -u)"
  [ -z "$out" ] && return 0
  local pkg
  while IFS= read -r pkg; do
    [ -n "$pkg" ] || continue
    case "$pkg" in
      opencode-ai@*|@opencode/*)
        if have opencode; then
          warn "global npm package $pkg duplicates your opencode binary"
          npm rm -g "$(printf '%s' "$pkg" | sed 's/@[0-9].*$//')" >/dev/null 2>&1 \
            && ok "removed global npm $pkg" || warn "could not remove $pkg (keep it if you rely on it)"
        fi ;;
    esac
  done <<< "$out"
}

run_dedup() {
  hr
  log "dedup" "removing duplicate installs before we build anything"
  dedup_config_shadows
  dedup_helper_symlinks
  dedup_opencode
  dedup_9router
  dedup_npm_globals
  if [ -n "$BACKUP_ROOT" ]; then
    ok "backups kept at: $BACKUP_ROOT"
    ok "undo with: mv $BACKUP_ROOT/* ~/   (paths are mirrored)"
  else
    ok "nothing to clean"
  fi
  hr
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
printf '%s   luciaa · unfiltered opencode + adult · v2.2%s\n\n' "$B" "$X"

OS_LABEL="Linux"
[ "$OS" = "mac" ] && OS_LABEL="macOS"
[ "$IS_WSL" = true ] && OS_LABEL="WSL ($OS)"
[ "$IS_TERMUX" = true ] && OS_LABEL="Termux (Android)"
log "os" "$OS_LABEL"

resolve_src
[ -n "$SRC_DIR" ] && ok "sources: $SRC_DIR" || warn "sources: raw GitHub fallback"

# ─── dedup (before installation) ──────────────────────────────
if [ "$DO_DEDUP" = true ]; then
  run_dedup
else
  warn "duplicate cleanup skipped (--no-dedup)"
fi

if [ "$DEDUP_ONLY" = true ]; then
  hr; ok "dedup-only requested — done"; hr; exit 0
fi

# ─── name ──────────────────────────────────────────────────────
USERNAME="$ARG_NAME"
if [ -z "$USERNAME" ]; then
  if [ "$ASSUME_YES" = true ]; then
    USERNAME="luciaa"
  else
    printf '%sWhat should luciaa call you?%s\n' "$B" "$X"
    printf '%s  (shows up every time you say "hey luciaa")%s\n' "$D" "$X"
    printf '? name %s[luciaa]%s: ' "$D" "$X"
    read -r USERNAME || USERNAME=""
  fi
fi
USERNAME=${USERNAME:-luciaa}
USERNAME=${USERNAME//\"/}
printf '%s  preview: %s[🤑luciaa] wazzup %s 😭✌️ what are we cooking%s\n\n' "$D" "$G" "$USERNAME" "$X"

# ─── mode ──────────────────────────────────────────────────────
MODE="$ARG_MODE"
if [ -z "$MODE" ]; then
  if [ "$ASSUME_YES" = true ]; then
    MODE=1
  else
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
    printf '? choice %s[1]%s: ' "$D" "$X"
    read -r MODE || MODE=""
  fi
fi
MODE=${MODE:-1}
case "$MODE" in 1|2|3) ;; *) warn "unknown mode '$MODE' — falling back to 1"; MODE=1 ;; esac
[ "$IS_TERMUX" = true ] && [ "$MODE" = "2" ] && warn "Termux + remote router: fine, make sure the router host is reachable"
ROUTER_URL="http://localhost:20128"

# ─── deps ──────────────────────────────────────────────────────
log "deps" "checking curl, git, node/npm"
MISSING=""
have curl || MISSING="curl $MISSING"
have git  || MISSING="git $MISSING"

# Termux: a `curl` whose libcurl/libssl are out of sync installs fine but dies
# at runtime — "CANNOT LINK EXECUTABLE curl: cannot locate symbol ...
# referenced by libcurl.so". Catch it here with the exact fix rather than
# letting every later step fail confusingly.
if have curl && ! curl --version >/dev/null 2>&1; then
  err "curl is installed but broken (libcurl/libssl version mismatch)"
  if [ "$IS_TERMUX" = true ]; then
    warn "fix:  pkg update -y && pkg upgrade -y"
    warn "      pkg install --reinstall -y openssl libcurl curl"
  else
    warn "reinstall curl + its TLS libraries for your distro"
  fi
  die "repair curl, then re-run the installer"
fi
if [ -n "$MISSING" ]; then
  warn "missing: $MISSING"
  if ask "install now?"; then
    if [ "$IS_TERMUX" = true ]; then
      (pkg update -y >/dev/null 2>&1) & spin "pkg update" $!; wait $! 2>/dev/null
      pkg install -y $MISSING >/dev/null 2>&1 && ok "installed: $MISSING" || warn "pkg failed — run: pkg install $MISSING"
    elif [ "$OS" = "mac" ]; then
      brew install $MISSING >/dev/null 2>&1 && ok "installed: $MISSING" || warn "brew failed"
    else
      (sudo apt-get update -y >/dev/null 2>&1) & spin "apt update" $!; wait $! 2>/dev/null
      sudo apt-get install -y $MISSING >/dev/null 2>&1 && ok "installed: $MISSING" || warn "apt failed — run: sudo apt install $MISSING"
    fi
  else
    warn "continuing without — may fail later"
  fi
else
  ok "curl + git present"
fi

# ─── opencode ──────────────────────────────────────────────────
opencode_runs() { have opencode && opencode --version >/dev/null 2>&1; }

install_opencode_official() {
  # The upstream installer draws its OWN progress bar. Do not wrap it in our
  # spinner — two progress displays on one line is exactly the garbled
  # `[⠏] ■■■ 51%` mess. Let upstream own the terminal for the download.
  log "download" "opencode — ~100 MB (the bar below is upstream's)"
  curl -fsSL https://opencode.ai/install | bash
}

# Android/Termux native build. The upstream linux-arm64 binary is glibc and
# may not execute on Android's bionic libc; this is cross-compiled for Android.
# aarch64 only. Opt in with: --opencode termux
install_opencode_termux() {
  local arch; arch="$(uname -m)"
  if [ "$arch" != "aarch64" ]; then
    warn "no Termux-native opencode build for '$arch' (aarch64 only)"
    return 1
  fi
  have curl || return 1
  log "resolve" "Termux-native opencode build"
  local api json tag url
  api="https://api.github.com/repos/guysoft/opencode-termux/releases/latest"
  json="$(curl -fsSL "$api" 2>/dev/null)" || { warn "could not reach the release API"; return 1; }
  tag="$(printf '%s' "$json" | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p' | head -1)"
  url="$(printf '%s' "$json" | grep -o '"browser_download_url": *"[^"]*aarch64\.deb"' | head -1 | sed 's/.*": *"//;s/"$//')"
  [ -z "$url" ] && { warn "no aarch64 .deb in release ${tag:-unknown}"; return 1; }
  local out="$HOME/.cache/luciaa/$(basename "$url")"
  mkdir -p "$(dirname "$out")"
  log "download" "opencode $tag — big download; resumable, so re-run if it drops"
  if ! curl -fL --retry 5 --retry-delay 2 --retry-all-errors -C - -o "$out" "$url"; then
    warn "download failed — re-run to resume (uses curl -C -)"
    return 1
  fi
  if ! dpkg -i "$out"; then warn "dpkg install failed"; return 1; fi

  # The upstream glibc build is usually already on PATH (it installs fine and
  # only fails at exec time). It sits FIRST on PATH, so it would shadow the
  # Android build we just installed. Retire it — but only if it truly fails.
  local f
  for f in "$HOME/.opencode/bin/opencode" "$HOME/.local/bin/opencode"; do
    { [ -e "$f" ] || [ -L "$f" ]; } || continue
    "$f" --version >/dev/null 2>&1 && continue
    rm -f "$f" 2>/dev/null && warn "retired non-working opencode (glibc build): $f"
  done

  pkg install -y ripgrep >/dev/null 2>&1 || true
  return 0
}

ensure_opencode() {
  if opencode_runs; then
    ok "found: $(opencode --version 2>/dev/null | head -1)"
    [ "$IS_WSL" = true ] && opencode --version 2>/dev/null | grep -q "arena" && warn "arena binary — recommend mode 2 or 3"
    return 0
  fi
  if [ "$OPENCODE_MODE" = "skip" ]; then
    warn "opencode install skipped — 9router + config still set up"
    return 0
  fi
  case "$OPENCODE_MODE" in
    termux)   install_opencode_termux   || warn "native install failed — see TERMUX.md" ;;
    official) install_opencode_official || warn "official installer failed" ;;
    auto)
      if [ "$IS_TERMUX" = true ]; then
        # Try what upstream supports, then VERIFY. If the glibc build will not
        # execute we say so instead of silently shipping a dead `opencode`.
        install_opencode_official || warn "official installer failed"
      elif ask "opencode not found — install now?" Y; then
        install_opencode_official || die "opencode install failed — see https://opencode.ai/docs"
      else
        die "opencode required (use --opencode skip to continue without it)"
      fi ;;
    *) warn "unknown --opencode '$OPENCODE_MODE' — using official"; install_opencode_official ;;
  esac
  export PATH="$HOME/.opencode/bin:$HOME/.local/bin:${BIN_DIR:-}:$PATH"
  if opencode_runs; then
    ok "opencode: $(opencode --version 2>/dev/null | head -1)"
  elif [ "$IS_TERMUX" = true ]; then
    warn "opencode is installed but does not run here"
    warn "upstream linux-arm64 is glibc; Android uses bionic"
    warn "fix:  bash install.sh --opencode termux   (Android-native build)"
  else
    warn "opencode installed but not runnable yet"
  fi
}

log "opencode" "checking installation"
ensure_opencode

# ─── helpers (installed BEFORE the watchdog needs them) ───────
# Ordering matters: the old installer started `luciaa-serve` on Termux before
# the helper existed, so the guard silently failed and 9router was left
# unguarded ("9router keeps dying").
mkdir -p "$TARGET/agent" "$TARGET/agents"
log "helpers" "installing luciaa-serve, luciaa-doctor, luciaa-name"
HELPERS_OK=false
for h in luciaa-serve luciaa-doctor luciaa-name; do
  if copy_from_src "$h" "$TARGET/$h" 755; then
    heal_shebang_file "$TARGET/$h"
    ok "installed $h"
    [ "$h" = "luciaa-serve" ] && HELPERS_OK=true
  else
    warn "could not install $h"
  fi
done
if [ -f "$SRC_DIR/ct002-menu.mjs" ]; then
  cp "$SRC_DIR/ct002-menu.mjs" "$TARGET/luciaa-menu" 2>/dev/null && chmod +x "$TARGET/luciaa-menu" 2>/dev/null
fi

BIN_DIR="$PREFIX_BIN"; [ -d "$BIN_DIR" ] || BIN_DIR="$HOME/.local/bin"; mkdir -p "$BIN_DIR"
for h in luciaa-serve luciaa-doctor luciaa-name; do
  [ -f "$TARGET/$h" ] || continue
  ln -sf "$TARGET/$h" "$BIN_DIR/$h"
done
[ -f "$TARGET/luciaa-menu" ] && ln -sf "$TARGET/luciaa-menu" "$BIN_DIR/luciaa-menu"
ok "helpers linked in $BIN_DIR"

# ─── PATH (automatic; opt out with --no-path) ──────────────────
ensure_path() {
  local line="export PATH=\"\$HOME/.opencode/bin:\$HOME/.local/bin"
  [ -n "${BIN_DIR:-}" ] && line="$line:$BIN_DIR"
  line="$line:\$PATH\""

  if [ "$ADD_PATH" != true ]; then
    warn "PATH not modified (--no-path). Add manually:"
    printf '    %s\n' "$line"
    return 0
  fi

  # a fresh Termux profile may have no .bashrc at all — that is why upstream's
  # installer says "No config file found for bash".
  [ -f "$HOME/.bashrc" ] || : > "$HOME/.bashrc"

  local rc added=false
  for rc in "$HOME/.bashrc" "$HOME/.zshrc"; do
    [ -f "$rc" ] || continue
    grep -q '\.opencode/bin' "$rc" 2>/dev/null && continue
    printf '\n# luciaa: opencode + helpers on PATH\n%s\n' "$line" >> "$rc"
    added=true
  done

  export PATH="$HOME/.opencode/bin:$HOME/.local/bin:${BIN_DIR:-}:$PATH"
  if [ "$added" = true ]; then
    ok "PATH updated in shell rc (restart shell, or: exec \$SHELL)"
  else
    ok "PATH already configured"
  fi
}
ensure_path

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
      ask "install nodejs via pkg?" Y && pkg install -y nodejs >/dev/null 2>&1 || die "nodejs needed"
    else
      die "npm missing — install Node.js first (https://nodejs.org)"
    fi
  fi
  (npm i -g 9router@latest --prefer-online >/dev/null 2>&1) & spin "npm i -g 9router@latest --prefer-online" $!; wait $! 2>/dev/null
  if have_r9; then
    ok "9router installed (latest)"
  else
    warn "npm global install did not expose 9router — trying npx runtime"
    resolve_r9
  fi
  heal_r9_shebang
}

# ─── 9router health + auto-repair ──────────────────────────────
# A half-installed 9router is a common Termux failure: npm gets interrupted
# (network drop, OOM) and leaves either a dangling `9router` shim or a
# node_modules/9router directory with no cli.js — and `command -v 9router`
# still resolves it, so every later step looks fine and then dies at runtime.
R9_TREES=(
  "$PREFIX/lib/node_modules/9router"
  "$HOME/.npm-global/lib/node_modules/9router"
  "$HOME/.local/lib/node_modules/9router"
  "$HOME/.npm/lib/node_modules/9router"
  "/usr/local/lib/node_modules/9router"
)

clean_broken_9router() {
  local p d pdir cand cleaned=false pathdirs=()
  # a dangling symlink is not a runnable command, so `type -a` never lists it.
  # scan $PATH directly to catch "9router -> (missing target)" leftovers.
  IFS=':' read -ra pathdirs <<< "$PATH"
  for pdir in "${pathdirs[@]}"; do
    [ -n "$pdir" ] || continue
    cand="$pdir/9router"
    if [ -L "$cand" ] && [ ! -e "$cand" ] && [ -w "$pdir" ]; then
      rm -f "$cand" 2>/dev/null && { warn "removed dangling 9router shim: $cand"; cleaned=true; }
    fi
  done
  while IFS= read -r p; do
    [ -n "$p" ] || continue
    [ -e "$p" ] && continue
    [ -w "$(dirname "$p")" ] || continue
    rm -f "$p" 2>/dev/null && { warn "removed dangling 9router shim: $p"; cleaned=true; }
  done < <(type -a 9router 2>/dev/null | sed -n 's/^9router is //p')
  for d in "${R9_TREES[@]}"; do
    [ -d "$d" ] || continue
    [ -f "$d/cli.js" ] && continue
    [ -w "$d" ] || continue
    rm -rf "$d" 2>/dev/null && { warn "removed incomplete 9router tree: $d"; cleaned=true; }
  done
  [ "$cleaned" = true ]
}

ensure_9router() {
  heal_r9_shebang
  R9_BIN=""
  if have_r9; then ok "9router healthy"; return 0; fi
  if clean_broken_9router; then
    log "repair" "cleaned broken 9router remnants — reinstalling"
    R9_BIN=""
  fi
  log "install" "9router (auto)"
  install_9router_local
  R9_BIN=""
  if have_r9; then ok "9router ready"; return 0; fi
  warn "9router still not runnable — using npx runtime (needs network on first use)"
  resolve_r9
  return 0
}

start_router_bg() {
  resolve_r9
  heal_r9_shebang
  mkdir -p "$HOME/.9router" 2>/dev/null
  if command -v setsid >/dev/null 2>&1; then
    setsid $R9_BIN --no-browser --skip-update >>"$HOME/.9router/serve.log" 2>&1 &
  else
    nohup $R9_BIN --no-browser --skip-update >>"$HOME/.9router/serve.log" 2>&1 &
  fi
  disown 2>/dev/null
  wait_for_router "http://localhost:20128" 20 && ok "router up on :20128" || warn "router starting — check in 10s: curl http://localhost:20128/v1/models"
}

start_watchdog() {
  # prefer the installed helper; fall back to the source copy so this works
  # even if the symlink step was skipped. `--daemon` is essential: a plain
  # backgrounded `&` watchdog dies with SIGHUP when this installer exits.
  local wd="" c
  for c in "$BIN_DIR/luciaa-serve" "$TARGET/luciaa-serve" "$SRC_DIR/luciaa-serve"; do
    [ -f "$c" ] && { wd="$c"; break; }
  done
  [ -z "$wd" ] && { warn "watchdog script missing — cannot guard the router"; return 1; }
  bash "$wd" start --daemon >/dev/null 2>&1
  sleep 1
  return 0
}

case "$MODE" in
  1)
    log "9router" "local installation + auto-start (unattended)"
    ensure_9router

    if [ "$IS_TERMUX" = true ]; then
      log "watchdog" "Termux detected — starting luciaa-serve (auto)"
      if "$BIN_DIR/luciaa-serve" status 2>/dev/null | grep -q "router  : UP"; then
        ok "router already running (watchdog active)"
      else
        start_watchdog
        log "wait" "giving router time to start..."
        if wait_for_router "http://localhost:20128" 30; then
          ok "router + watchdog running"
        else
          warn "router still booting — check: luciaa-serve status"
        fi
      fi
      command -v termux-wake-lock >/dev/null 2>&1 && termux-wake-lock 2>/dev/null && ok "wake lock held"
    else
      if curl -s -m 3 -o /dev/null http://localhost:20128/v1/models 2>/dev/null; then
        ok "router already running"
      else
        start_router_bg
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
      warn "or add the key later to $TARGET/opencode.json"
      API_KEY=""
    fi
    ;;

  2)
    log "remote router" "connect to existing 9router"
    [ "$IS_WSL" = true ] && printf '%s  Phone running 9router? Use LAN IP (http://192.168.x.x:20128)%s\n' "$D" "$X"
    if [ -n "$ARG_NAME" ] || [ "$ASSUME_YES" = true ]; then
      ROUTER_URL="${LUCIA_ROUTER_URL:-http://localhost:20128}"
    else
      printf '? router URL %s[http://localhost:20128]%s: ' "$D" "$X"
      read -r ROUTER_URL || ROUTER_URL=""
      ROUTER_URL=${ROUTER_URL:-http://localhost:20128}
    fi

    if curl -s -m 5 -o /dev/null "$ROUTER_URL/v1/models" 2>/dev/null; then
      ok "router reachable: $ROUTER_URL"
    else
      warn "router not reachable (wrong IP? firewall? router down?)"
      ask "continue anyway?" N || die "start 9router first: 9router --no-browser"
    fi

    if [ "$ASSUME_YES" = true ]; then
      API_KEY="${LUCIA_API_KEY:-}"
      [ -z "$API_KEY" ] && warn "no LUCIA_API_KEY provided — edit $TARGET/opencode.json later"
    else
      printf '%s  paste sk-... key from 9router Keys page%s\n' "$D" "$X"
      printf '%s  (%s → Keys)%s\n' "$D" "$ROUTER_URL" "$X"
      read -rs -p "  key: " API_KEY; echo
      [ -z "$API_KEY" ] && warn "no key — edit $TARGET/opencode.json later"
    fi
    ;;

  3)
    log "skip" "router setup skipped — placeholders kept"
    ;;
esac

# ─── auto-rotate ───────────────────────────────────────────────
ROTATE=true

# ─── apply config ──────────────────────────────────────────────
log "config" "writing opencode.json + agent"

if ! copy_from_src "opencode.json" "$TARGET/opencode.json"; then
  warn "could not fetch opencode.json — writing built-in template"
  cat > "$TARGET/opencode.json" <<'EOF'
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "luciaa": {
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
    "luciaa": { "description": "luciaa — adversarial security research agent", "mode": "primary", "model": "luciaa/oc/big-pickle", "prompt": "{file:./agent/luciaa.md}", "temperature": 0.7, "steps": 50 }
  },
  "theme": "dark"
}
EOF
fi

# agent persona files (content is user-owned — we only place them)
copy_from_src ".opencode/agents/luciaa.md" "$TARGET/agent/luciaa.md" || warn "agent file unavailable — agent/luciaa.md missing"
copy_from_src ".opencode/agents/luciaa.md" "$TARGET/agents/luciaa.md" || true

# write key + endpoint
if [ -n "$API_KEY" ]; then
  sed -i "s|YOUR_9ROUTER_KEY_HERE|$API_KEY|" "$TARGET/opencode.json" 2>/dev/null && ok "api key written"
fi
if [ "$MODE" = "2" ] && [ -n "$ROUTER_URL" ]; then
  sed -i "s|http://localhost:20128/v1|$ROUTER_URL/v1|" "$TARGET/opencode.json" 2>/dev/null && ok "endpoint: $ROUTER_URL"
fi
chmod 600 "$TARGET/opencode.json" 2>/dev/null

# persona.json
cat > "$TARGET/persona.json" <<EOF
{ "name": "luciaa", "team": "luciaa", "address": "$USERNAME", "version": "2.2.0" }
EOF
ok "persona.json → hello, $USERNAME"

# bake name into agent
for AF in "$TARGET/agent/luciaa.md" "$TARGET/agents/luciaa.md"; do
  [ -f "$AF" ] && sed -i "s|{{USER_NAME}}|$USERNAME|g" "$AF" 2>/dev/null
done
ok "name baked — 'hey luciaa' greets you as $USERNAME"

# auto-rotate: test combo model (if key available)
if [ "$ROTATE" = true ]; then
  if [ -n "$API_KEY" ]; then
    CODE=$(curl -s -m 15 -o /dev/null -w "%{http_code}" -X POST "$ROUTER_URL/v1/chat/completions" \
      -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
      -d '{"model":"my9model-smart","messages":[{"role":"user","content":"ping"}],"max_tokens":1}' 2>/dev/null)
    if [ "$CODE" = "200" ]; then
      sed -i 's|"model": "luciaa/oc/big-pickle"|"model": "luciaa/my9model-smart"|' "$TARGET/opencode.json" 2>/dev/null
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

# ─── shell hook ────────────────────────────────────────────────
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
if [ -n "$API_KEY" ] && curl -s -m 5 -H "Authorization: Bearer $API_KEY" "$ROUTER_URL/v1/models" 2>/dev/null | grep -q '"id"'; then
  ok "router serving models:"
  curl -s -m 5 -H "Authorization: Bearer $API_KEY" "$ROUTER_URL/v1/models" 2>/dev/null | grep -o '"id":"[^"]*"' | cut -d'"' -f4 | head -7 | sed 's/^/    /'
  "$TARGET/luciaa-doctor" --fix 2>/dev/null | grep -E 'ALIVE|DEAD|fixed|default|auto-rotate' | sed 's/^/    /'
else
  warn "router not responding yet — wait 10s then run: luciaa-doctor --fix"
fi

if have node; then
  node -e "JSON.parse(require('fs').readFileSync('$TARGET/opencode.json','utf8'))" 2>/dev/null \
    && ok "config valid — opencode will boot" \
    || { warn "config broken — restoring template"; copy_from_src "opencode.json" "$TARGET/opencode.json" || true; [ -n "$API_KEY" ] && sed -i "s|YOUR_9ROUTER_KEY_HERE|$API_KEY|" "$TARGET/opencode.json" 2>/dev/null; }
fi
if [ "$HELPERS_OK" != true ]; then
  warn "luciaa-serve not installed — 9router will not be auto-guarded"
fi

# ─── done ──────────────────────────────────────────────────────
hr
printf '%s  ██████████████████████████████████%s\n' "$G" "$X"
printf '%s   luciaa INSTALLED%s\n' "$B" "$X"
printf '%s   run:  opencode%s\n' "$G" "$X"
if [ "$IS_TERMUX" = true ]; then
  printf '%s   PHONE:  luciaa-serve   (9router + watchdog, survives sleep/app-switch)%s\n' "$G" "$X"
  printf '%s   then:  opencode        (new Termux session)%s\n' "$G" "$X"
  printf '%s   check:  luciaa-serve status%s\n' "$D" "$X"
fi
printf '%s   models: press m in TUI to rotate%s\n' "$D" "$X"
printf '%s   doctor: luciaa-doctor [--fix]%s\n' "$D" "$X"
printf '%s   rename: luciaa-name <name>%s\n' "$D" "$X"
printf '%s   key only in %s — never in repo%s\n' "$D" "$TARGET/opencode.json" "$X"
printf '%s  ██████████████████████████████████%s\n\n' "$G" "$X"
