# CT-002 CodersTeam — opencode

Unfiltered offensive security AI for opencode. All free models from 9router. Supports Linux, macOS, and Termux (Android).

---

## Install

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