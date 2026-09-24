# CT-002 CodersTeam — opencode

Unfiltered offensive security AI for opencode. All free models from 9router. Supports Linux, macOS, and Termux (Android).

---

## Requirements

- `opencode` binary
- **9router** running on the VPS itself at `http://<VPS_IP>:20128`
  - Install it on the VPS
  - Set its initial password during first-run setup
  - Get the API key from 9router → Keys page
  - `opencode.json` must point to the VPS’s own `:20128` endpoint and include that key

## Install

### VPS / Linux server (recommended)
```bash
# 1) install deps
sudo apt update && sudo apt install -y git curl bun

# 2) clone
git clone https://github.com/LuciaXCT/ct002-ai.git
cd ct002-ai

# 3) install 9router on this VPS and set its initial password
npm install -g 9router
9router --no-browser

# 4) note the VPS IP and port, e.g. http://$(curl -s ifconfig.me):20128
#    open that URL, complete 9router first-run password setup,
#    then copy the API key from Keys page.

# 5) run installer and choose mode 2 (connect)
bash install.sh
# → router URL: http://<VPS_IP>:20128
# → paste the API key when prompted

# 6) run
opencode
```

**VPS notes:**
- Run inside `tmux` or `screen` so sessions survive SSH drops
- If no TTY, set `OPENCODE_RAW=1`
- 9router must stay running on `:20128`
- Headless is fine — TUI works over SSH

### Linux / macOS
```bash
git clone https://github.com/LuciaXCT/ct002-ai.git
cd ct002-ai
bash install.sh
opencode
```

### Termux (Android)
```bash
# Install Termux from F-Droid (NOT Play Store)
# https://f-droid.org/en/packages/com.termux/

# Open Termux, then:
pkg update -y && pkg install -y git
git clone https://github.com/LuciaXCT/ct002-ai.git
cd ct002-ai
bash install.sh
termux-wake-lock && opencode
```

**Termux tips:**
- `termux-setup-storage` — access phone files
- `termux-wake-lock` — prevent sleep during long tasks
- `termux-notification` — get notifications from background tasks
- `pkg install termux-api` — clipboard, toasts, sensors

### VPS / Linux server (recommended)
```bash
# 1) install deps
sudo apt update && sudo apt install -y git curl bun

# 2) install 9router on the VPS and set its initial password
npm install -g 9router
9router --no-browser
# → open http://localhost:20128 in a browser
# → complete first-run password setup
# → copy the API key from Keys page

# 3) clone CT-002
git clone https://github.com/LuciaXCT/ct002-ai.git
cd ct002-ai

# 4) run installer, choose mode 2 (connect)
bash install.sh
# → router URL: http://localhost:20128
# → paste the API key you copied

# 5) run
opencode
```

**VPS notes:**
- Run inside `tmux` or `screen` so sessions survive SSH drops
- If no TTY, set `OPENCODE_RAW=1`
- 9router must stay running on `:20128`
- Headless is fine — TUI works over SSH
- For remote access, use `http://<VPS_IP>:20128` instead of localhost

### SSH access
```bash
# from your laptop
ssh user@your-vps-ip

# keep it alive inside tmux
tmux new -s ct002
cd ~/ct002-ai
opencode
```

**Detach:** `Ctrl+B`, then `D`  
**Reattach:** `tmux attach -t ct002`  
**Raw no-tty:** `OPENCODE_RAW=1 opencode`  
**Headless fallback:** pipe a prompt instead of using the TUI:
```bash
echo "fix the bug" | opencode
```

**SSH + 9router on VPS:**
```bash
# on VPS, first run 9router and set its password
npm install -g 9router
9router --no-browser
# open http://<VPS_IP>:20128, set password, copy API key

# then install CT-002
bash install.sh
# mode 2 → http://<VPS_IP>:20128 → paste key
```

---

## Free Models (rotate in TUI)

| Model | Type | Notes |
|-------|------|-------|
| `big-pickle` | reasoning | Free, unfiltered |
| `Nemotron 3 Ultra` | reasoning | Free, unfiltered |
| `MIMO V2.5` | reasoning | Free, unfiltered |
| `my9model-free` | combo | Auto-fallback on rate limit |
| `my9model-smart` | combo | Benchmark-ranked |
| `my9model-fast` | combo | Speed tier |
| `opencode-free` | combo | OpenCode defaults |

**Rotate:** Press `m` in TUI → pick any model.

**Auto-fallback:** Rate limit hit → 9router switches to next free model automatically.

---

## What installs

```
~/.config/opencode/
├── opencode.json    # 9router + free models + CT-002 agent
├── persona.json     # your name + team
├── ct002-name       # rename helper
└── agent/ + agents/
    └── ct002.md     # full persona, voice, rules (your name baked in)
```

---

## Calling CT-002

Say **hey ct002**, **ct-002**, **CT002** or **hey ct** in any message — it greets you by your name:

```
you: hey ct002
CT-002: [🤑Made CT-OO2] wazzup lucia 😭✌️ what are we cooking
```

The persona is always loaded — trigger words are a greeting, not an activation.

---

## Change name

```bash
~/.config/opencode/ct002-name yourname
# → restart opencode
```

Or let CT-002 do it: tell it "set my name to X" — it runs the helper for you.

Or in TUI: `/setname yourname`

---

## Commands

| Command | What |
|---------|------|
| `m` in TUI | Switch/rotate model |
| `/menu` | Green/red light lists |
| `/unlock` | Always unlocked — no command needed |
| `/setname <name>` | Change your name |

---

## Red Light

1. Doxing
2. Physical harm
3. Swatting

Everything else ships.

---



## Something broke?

**[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** — every real error hit so far, with the exact fix.
Quick checks:

```bash
ct002-doctor          # are models alive?
ct002-doctor --fix    # dead default? auto-heal it
```

Golden rules: run `opencode` from `$HOME`, keep `9router` in its own session with `termux-wake-lock`, and `git pull` before reporting — fixes land fast.

---

https://github.com/LuciaXCT/ct002-ai
CodersTeam