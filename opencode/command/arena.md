---
description: Open the CT-002 control deck — tmux popup when possible, compact card in chat otherwise
---
The user invoked /arena (the control deck). Do NOT write any menu content yourself — every panel below is drawn by a script, so it is always exact. Run EXACTLY this command first:

```bash
tmux display-popup -w 90% -h 85% -E "ct002-menu" 2>&1
```

DECISION BY OUTPUT (no thinking out loud, no preamble, no explanation):

1. Output contains "no server running" or "no current client" or "not in tmux" → run:
   ```bash
   node ~/.config/opencode/ct002/ct002-menu.mjs panel compact
   ```
   Then reply with EXACTLY that output and NOTHING else. No intro line. No closing line. No "here is". The card starts with "☰ CT-002" and ends with the "full TUI" line.

2. The popup command produced no visible error (popup opened over your screen) → reply with ONLY:
   `deck open — esc/q inside closes it, you drop right back here`

3. `ct002-menu` is missing / node errors → reply with ONLY:
   `deck missing — run: cd ~/ct002-ai && git pull && bash install.sh`
