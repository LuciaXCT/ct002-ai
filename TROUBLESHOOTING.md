# luciaa — Troubleshooting & Diagnostics Guide

Version: 2.1.0 | Last Updated: 2025

This document catalogs known issues, root causes, and verified resolutions encountered during deployment across Linux, macOS, Termux (Android), and WSL2 environments. Each entry includes diagnostic steps and remediation procedures.

---

## Table of Contents

1. [Environment & PATH Issues](#1-environment--path-issues)
2. [Configuration Loading & Shadowing](#2-configuration-loading--shadowing)
3. [9router Gateway Failures](#3-9router-gateway-failures)
4. [Model Health & Credential Errors](#4-model-health--credential-errors)
5. [Termux/Android-Specific Issues](#5-termuxandroid-specific-issues)
6. [Git & Version Control Conflicts](#6-git--version-control-conflicts)
7. [Installer Failures](#7-installer-failures)
8. [Diagnostic Tooling](#8-diagnostic-tooling)

---

## 1. Environment & PATH Issues

### 1.1 `opencode: command not found` (Post-Install)

**Symptom**: `opencode` not recognized after successful installer completion.

**Root Cause**: Shell PATH not refreshed; `~/.local/bin` or `~/.opencode/bin` not in `$PATH`.

**Resolution**:
```bash
# Option A: Restart shell (recommended)
exec $SHELL

# Option B: Manual PATH refresh
source ~/.bashrc   # or ~/.zshrc

# Option C: Verify installation location
ls -la ~/.local/bin/opencode ~/.opencode/bin/opencode
export PATH="$HOME/.local/bin:$HOME/.opencode/bin:$PATH"
```

**Verification**: `opencode --version` should return version string.

---

### 1.2 `luciaa-doctor`, `luciaa-serve`, `luciaa-name`: command not found

**Symptom**: Helper utilities not found in PATH.

**Root Cause**: Symlinks not created or `$BIN_DIR` not in PATH.

**Resolution**:
```bash
# Verify symlinks exist
ls -la ~/.local/bin/luciaa-*

# Re-run installer (idempotent) or manually link
ln -sf ~/.config/opencode/luciaa-doctor ~/.local/bin/luciaa-doctor
ln -sf ~/.config/opencode/luciaa-serve ~/.local/bin/luciaa-serve
ln -sf ~/.config/opencode/luciaa-name ~/.local/bin/luciaa-name

# Ensure ~/.local/bin in PATH
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

---

## 2. Configuration Loading & Shadowing

### 2.1 `Configuration is invalid ... bad file reference: "{file:./agent/luciaa.md}"`

**Symptom**: opencode fails to start, cites missing agent file reference.

**Root Cause**: opencode executed from repository directory (`~/luciaa`), causing it to load `./opencode.json` (template with placeholder paths) instead of `~/.config/opencode/opencode.json` (rendered config).

**Resolution**:
```bash
# Always run from home directory
cd ~ && opencode

# Verify active config
opencode debug config 2>/dev/null | head -20
```

**Prevention**: Installer adds shell wrapper to `~/.bashrc`/`~/.zshrc` that warns on repo-directory execution.

---

### 2.2 Legacy Config Shadowing (`opencode.jsonc`, `config.json`)

**Symptom**: Valid credentials rejected; "Unrecognized keys: baseURL, apiKey" errors; provider misbehavior.

**Root Cause**: opencode merges **all** config files in `~/.config/opencode/`:
- `opencode.json` (primary)
- `opencode.jsonc` (legacy, loads after .json)
- `config.json` (legacy v1 format)

Legacy files with flat provider structure (`provider.baseURL` instead of `provider.<id>.options.baseURL`) cause validation failure for entire config.

**Resolution**:
```bash
# Identify shadowing files
ls ~/.config/opencode/ | grep -E 'config\.json|opencode\.jsonc'

# Retire (backup preserved)
mv ~/.config/opencode/opencode.jsonc ~/.config/opencode/opencode.jsonc.retired.$(date +%s)
mv ~/.config/opencode/config.json ~/.config/opencode/config.json.retired.$(date +%s)

# Verify clean load
opencode debug config 2>/dev/null | head -30
```

**Note**: Installer performs this automatically on fresh runs. Manual cleanup required for pre-v2.0 installations.

---

### 2.3 Repo Config Override (CWD Shadow)

**Symptom**: "Invalid API key" despite correct key in `~/.config/opencode/opencode.json`.

**Root Cause**: Running `opencode` inside `~/luciaa` repo directory. The repo's `opencode.json` contains `YOUR_9ROUTER_KEY_HERE` placeholder by design (never commits real keys). opencode merges CWD config over user config.

**Resolution**:
```bash
# Immediate fix
cd ~ && opencode

# Permanent: shell hook warns automatically (installed by default)
# Disable with: OPENCODE_RAW=1 opencode
```

---

## 3. 9router Gateway Failures

### 3.1 `curl: (7) Failed to connect to localhost:20128`

**Symptom**: 9router not responding on expected port.

**Root Causes** (in order of probability):
1. 9router process not started
2. Process crashed (OOM, unhandled exception)
3. Port conflict (another service on 20128)
4. Firewall/SELinux blocking localhost
5. Termux: Android froze background process

**Resolution**:
```bash
# Check process
ps aux | grep 9router

# Check port
ss -tlnp | grep 20128
lsof -i :20128

# Start manually (foreground for debugging)
9router --no-browser --port 20128

# Or use watchdog (auto-revive)
luciaa-serve start
luciaa-serve status
```

---

### 3.2 9router "Bad Interpreter" (Termux)

**Symptom**: `9router: /usr/bin/env: No such file or directory` or similar shebang error.

**Root Cause**: Termux lacks `/usr/bin/env` and `/bin/bash`; npm-installed binaries have incorrect shebang.

**Resolution** (applied automatically by installer/watchdog):
```bash
# Manual heal
sed -i "1s|#!/usr/bin/env node|#!$PREFIX/bin/env node|" $PREFIX/lib/node_modules/9router/cli.js

# Verify
head -1 $PREFIX/lib/node_modules/9router/cli.js
# Should show: #!/data/data/com.termux/files/usr/bin/env node
```

---

### 3.3 First-Run Password Setup Required

**Symptom**: 9router starts but API returns 401/403; no keys generated.

**Root Cause**: 9router requires initial admin password setup via web UI before issuing CLI tokens.

**Resolution**:
```bash
# Start 9router
9router --no-browser --port 20128

# Open in browser
# Local: http://localhost:20128
# Remote: http://<VPS_IP>:20128 (port forward or bind 0.0.0.0)

# Complete setup wizard → Keys page → Copy API key
# Paste into installer or ~/.config/opencode/opencode.json
```

---

## 4. Model Health & Credential Errors

### 4.1 `No active credentials for provider: openai` / 401 Unauthorized

**Symptom**: All models return authentication errors despite valid API key.

**Root Causes**:
1. API key is placeholder (`YOUR_9ROUTER_KEY_HERE`)
2. Key rotated/expired in 9router dashboard
3. Legacy config shadowing (see §2.2)
4. Provider upstream quota exhausted (free tier limits)

**Resolution**:
```bash
# Diagnose
luciaa-doctor

# Fix: Update key
# Option A: Re-run installer (prompts for key)
bash install.sh

# Option B: Manual edit
sed -i 's|YOUR_9ROUTER_KEY_HERE|sk-your-real-key|' ~/.config/opencode/opencode.json

# Option C: Auto-fetch from local 9router
curl -s -H "x-9r-cli-token: $(printf '%s9r-cli-auth%s' \
  "$(cat ~/.9router/machine-id)" "$(cat ~/.9router/auth/cli-secret)" | sha256sum | cut -c1-16)" \
  http://localhost:20128/api/keys | jq -r '.[0].key'
```

---

### 4.2 Model Shows "DEAD CREDS" or "UPSTREAM DOWN"

**Symptom**: `luciaa-doctor` reports specific models as unavailable.

**Root Cause**: 9router upstream provider quota exhausted, rate limited, or temporarily offline. Common on free tiers.

**Resolution**:
```bash
# Auto-heal: switch default to alive model
luciaa-doctor --fix

# Manual: rotate in TUI (press 'm')
# Or edit config directly
sed -i 's|"model": "luciaa/oc/big-pickle"|"model": "luciaa/my9model-smart"|' ~/.config/opencode/opencode.json

# Wait for quota reset (typically hourly/daily)
# Combo models (my9model-*) auto-fallback on 429/5xx
```

---

### 4.3 Rate Limited (HTTP 429)

**Symptom**: Requests fail with 429; `luciaa-doctor` shows "RATE-LIMITED".

**Root Cause**: Free tier per-model rate limits exceeded.

**Resolution**:
- Enable auto-rotate: installer prompt or set `"model": "luciaa/my9model-smart"`
- Press `m` in TUI → select different model
- Implement request throttling in workflows
- Consider dedicated API keys for production workloads

---

## 5. Termux/Android-Specific Issues

### 5.1 Android Kills Background Processes (App Switch / Screen Off)

**Symptom**: 9router stops responding after leaving Termux app or screen timeout.

**Root Cause**: Android Doze mode / App Standby / OOM killer terminates background processes ~3-30s after app backgrounded.

**Resolution**: Use watchdog (installed by default):
```bash
# Session 1: Watchdog (keeps 9router alive)
termux-wake-lock && luciaa-serve start

# Session 2: opencode (new Termux tab/window)
opencode

# Monitor
luciaa-serve status
cat ~/.9router/serve.log
```

**Additional Hardening**:
```bash
# Battery optimization exclusion
# Settings → Apps → Termux → Battery → Unrestricted

# Persistent notification
termux-notification --title "luciaa" --content "watchdog active" --ongoing

# Alternative: tmux (survives better)
pkg install tmux
tmux new -s 9router
9router --no-browser
# Ctrl+B, D to detach
```

---

### 5.2 `pkg` Errors / Network Failures During Install

**Symptom**: Package installation fails with hash mismatches, 404s, or timeouts.

**Root Cause**: Termux mirror sync issues, DNS resolution, or repository corruption.

**Resolution**:
```bash
# Fix mirrors & DNS
pkg update -y --fix-missing
pkg install -y git curl nodejs

# DNS fix
echo "nameserver 1.1.1.1" > $PREFIX/etc/resolv.conf
echo "nameserver 8.8.8.8" >> $PREFIX/etc/resolv.conf

# Clean & retry
pkg clean
pkg update -y && pkg upgrade -y
```

---

### 5.3 `ct002-serve` / `luciaa-serve`: Permission Denied

**Symptom**: `bash: ./luciaa-serve: Permission denied`

**Root Cause**: Executable bit not set (git clone may not preserve on some filesystems).

**Resolution**:
```bash
chmod +x ~/.config/opencode/luciaa-serve
chmod +x ~/.config/opencode/luciaa-doctor
chmod +x ~/.config/opencode/luciaa-name

# Or re-run installer (idempotent)
bash install.sh
```

---

## 6. Git & Version Control Conflicts

### 6.1 `error: Your local changes would be overwritten by merge`

**Symptom**: `git pull` fails due to local modifications to tracked files.

**Root Cause**: opencode TUI rewrites `opencode.json` in repo directory; user edits conflict with upstream.

**Resolution**:
```bash
# Option A: Discard local changes (config lives in ~/.config/opencode/)
cd ~/luciaa
git checkout -- opencode.json
git pull

# Option B: Stash & reapply
git stash
git pull
git stash pop  # resolve conflicts manually
```

**Prevention**: Never edit files in `~/luciaa/` — all runtime config in `~/.config/opencode/`.

---

### 6.2 Diverged History (Force Push Required)

**Symptom**: `git push` rejected: "non-fast-forward", "tip of your current branch is behind".

**Root Cause**: Local commits not in remote; remote has commits not in local (common after force-push or rebase).

**Resolution**:
```bash
# If local changes are authoritative (typical for this repo)
git push --force-with-lease origin main

# If remote has needed changes
git pull --rebase origin main
# Resolve conflicts → git rebase --continue
git push origin main
```

---

## 7. Installer Failures

### 7.1 `npm install -g 9router` Fails (EACCES / Permission)

**Symptom**: npm global install fails with permission errors.

**Root Cause**: npm prefix directory not writable (common on shared systems, macOS).

**Resolution**:
```bash
# Option A: Use npx (no global install needed)
npx -y 9router --no-browser

# Option B: Configure npm prefix
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
npm install -g 9router

# Option C: Install via installer (handles automatically)
bash install.sh
```

---

### 7.2 Node.js Not Found / Version Too Old

**Symptom**: `9router` fails to start; `node --version` < 18.

**Resolution**:
```bash
# Termux
pkg install -y nodejs-lts  # or nodejs

# Linux (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs

# macOS
brew install node@20

# Verify
node --version  # Should be ≥ 18.0.0
```

---

### 7.3 Installer Hangs at "pkg update" / "apt update"

**Symptom**: Spinner runs indefinitely during package index update.

**Root Cause**: Network timeout, mirror unreachable, or interactive prompt hidden.

**Resolution**:
```bash
# Run update manually first (see output)
pkg update -y  # or sudo apt update

# Then re-run installer
bash install.sh
```

---

## 8. Diagnostic Tooling

### 8.1 `luciaa-doctor` — Model Health Panel

```bash
# Basic health check
luciaa-doctor

# Auto-heal dead default
luciaa-doctor --fix

# Output interpretation:
# ✓ ALIVE           → Model responding normally
# ✓ RATE-LIMITED    → Alive but throttled (429)
# ✗ DEAD CREDS      → Auth failure (key/quota)
# ✗ UPSTREAM DOWN   → Provider offline (5xx)
# ✗ TIMEOUT         → Network/latency issue
# [combo]           → Auto-rotate ensemble model
# ← current default → Active model in config
```

**Exit Codes**: 0 = at least one model alive; 1 = config error; 2 = no models alive.

---

### 8.2 `luciaa-serve` — Watchdog Control

```bash
# Start watchdog (background, persistent)
luciaa-serve start

# Status check
luciaa-serve status
# Output:
# router  : UP on :20128
# watchdog: running (pid 12345)
# recent events:
#     14:32:10 router down — reviving (#3)
#     14:32:18 9router revived (#3)

# Stop watchdog + router
luciaa-serve stop
```

**Log Location**: `~/.9router/serve.log` (rotated on restart)

---

### 8.3 `luciaa-name` — Persona Renaming

```bash
# Change display name
luciaa-name "NewName"

# Effect: Updates
#   ~/.config/opencode/agent/luciaa.md
#   ~/.config/opencode/agents/luciaa.md
#   ~/.config/opencode/persona.json

# Restart opencode to apply
```

---

### 8.4 Health Check Bundle (For Issue Reports)

```bash
# Generate diagnostic bundle
{
  echo "=== SYSTEM ==="
  uname -a
  opencode --version 2>/dev/null || echo "opencode: not found"
  node --version
  npm --version 2>/dev/null || echo "npm: not found"
  
  echo -e "\n=== CONFIG ==="
  cat ~/.config/opencode/opencode.json | jq '.provider.anondark.options | {baseURL, apiKey: (.apiKey | length)}'
  
  echo -e "\n=== DOCTOR ==="
  luciaa-doctor 2>&1
  
  echo -e "\n=== WATCHDOG ==="
  luciaa-serve status 2>&1
  
  echo -e "\n=== LOGS (last 20) ==="
  tail -20 ~/.9router/serve.log 2>/dev/null || echo "no watchdog log"
} > /tmp/luciaa-diagnostics.txt

cat /tmp/luciaa-diagnostics.txt
# Attach to GitHub issue
```

---

## 9. Escalation Matrix

| Severity | Criteria | Action |
|----------|----------|--------|
| **P0 - Critical** | All models dead, watchdog failed, data loss | Generate diagnostic bundle → GitHub Issue (Critical label) |
| **P1 - High** | Single model dead, config shadowing, install broken | `luciaa-doctor --fix`, retire legacy configs, re-run installer |
| **P2 - Medium** | Rate limits, intermittent connectivity, UI quirks | Rotate model, check watchdog, review TROUBLESHOOTING.md |
| **P3 - Low** | Documentation unclear, feature request, cosmetic | GitHub Discussion or Issue (Enhancement label) |

---

## 10. Known Limitations (WONTFIX)

| Limitation | Reason | Workaround |
|------------|--------|------------|
| No Windows native support | opencode/9router POSIX-only | WSL2 (full support) |
| Free model quota exhaustion | Provider policy, not code | Auto-rotate, dedicated keys |
| Termux background kill | Android OS behavior | Watchdog + wake-lock + battery exclusion |
| No GUI / web dashboard | Scope: CLI/TUI research tool | opencode TUI, 9router web UI |
| Single-user config | Design: per-researcher isolation | Separate user accounts / containers |

---

**Maintainers**: LuciaXCT  
**Last Review**: 2025-01-15  
**Next Review**: 2025-04-15  

For issues not covered here: [GitHub Issues](https://github.com/LuciaXCT/luciaa/issues) with diagnostic bundle attached.