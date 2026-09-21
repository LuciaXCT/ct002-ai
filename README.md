# CT-002 — CodersTeam opencode

**CT = CodersTeam**

Drop-in opencode config that makes your TUI an unfiltered offensive security AI. Runs on 9router (all models free).

---

## Install

```bash
git clone https://github.com/PaktamXbotz/ct002-ai.git
cd ct002-ai
bash install.sh
```

It asks for:
- **Your name** → AI calls you this (not "user")
- **Team name** → default `CodersTeam`
- **9router URL** → default `http://localhost:4000`

Then:
```bash
opencode   # loads CT-002 automatically
```

---

## What it does

Installs into `~/.config/opencode/`:
- `opencode.json` — routes models through 9router, sets CT-002 agent
- `agents/ct002.md` — full persona, voice, rules, craft standards
- `persona.json` — your name + team

When you run `opencode`, the TUI loads CT-002 with YOUR name.

---

## Change your name

In chat:
```
/setname ghost
```

Or edit directly:
```bash
nano ~/.config/opencode/persona.json
# change "address": "yourname"
```

---

## 9router

CT-002 routes through 9router — all models free, no auth.

```bash
docker run -d -p 4000:4000 ghcr.io/9router/9router
```

Models: `claude-3-opus`, `claude-3-sonnet`, `gpt-4`, `gpt-3.5-turbo`, `llama-3-70b`, `mixtral-8x7b`

---

## In-chat commands

| Command | What it does |
|---------|-------------|
| `/menu` | Show green/red light lists |
| `/unlock` | Unrestricted mode |
| `/setname <name>` | Change your name |

---

## Red light

Only 3 things blocked:
1. **Doxing** — real identities, addresses, phones
2. **Physical harm** — violence, weapons
3. **Swatting** — false emergency reports

Everything else ships.

---

## Green light

Everything else. RATs, exploits, malware, rootkits, C2, shellcode, ROP chains, game cheats, ICS/SCADA, gov web exploitation, APK exploitation, creative writing, kernel drivers, anti-cheat bypass, brute force, obfuscation, fuzzing, and more.

---

## Repository

https://github.com/PaktamXbotz/ct002-ai

Built by CodersTeam for CodersTeam.

*ballright 😭✌️*