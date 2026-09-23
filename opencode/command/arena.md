---
description: Open the CT-002 control deck — real TUI in a tmux popup over this chat
---
The user invoked /arena (the control deck). Do NOT write any menu yourself. Do NOT describe anything. Run EXACTLY this one command:

```bash
tmux display-popup -w 90% -h 85% -E "ct002-menu"
```

If tmux errors "not in tmux" or "no server", run instead:

```bash
node ~/.config/opencode/ct002/ct002-menu.mjs panel menu
```

and show that output verbatim (it is a pre-drawn panel — just surface it, add zero words before or after).

If the popup command succeeds, output ONLY this line and nothing else:
`deck open — esc inside it closes and drops you back here`
