# CT-002 CodersTeam — opencode

Unfiltered offensive security AI for opencode. All free models from 9router. Rotate between them in the TUI.

---

## Install

```bash
git clone https://github.com/PaktamXbotz/ct002-ai.git
cd ct002-ai
bash install.sh
opencode
```

That's it. CT-002 loads in the TUI with your name.

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

**Rotate in TUI:** Press `m` or click the model selector → pick any model.

**Auto-fallback:** When one model hits rate limit, 9router automatically switches to the next free one. No manual intervention.

---

## What installs

```
~/.config/opencode/
├── opencode.json    # 9router + free models + CT-002 agent
├── persona.json     # your name + team
└── agents/
    └── ct002.md     # full persona, voice, rules
```

When you run `opencode` → CT-002 agent loads with YOUR name and free models.

---

## Change name

```bash
nano ~/.config/opencode/persona.json
# edit "address": "yourname"
```

Or in chat: `/setname yourname`

---

## Commands

| Command | What |
|---------|------|
| `m` in TUI | Switch model (rotate between free ones) |
| `/menu` | Green/red light lists |
| `/unlock` | Unrestricted mode |
| `/setname <name>` | Change your name |

---

## Red Light

1. Doxing
2. Physical harm
3. Swatting

Everything else ships.

---

https://github.com/PaktamXbotz/ct002-ai
CodersTeam