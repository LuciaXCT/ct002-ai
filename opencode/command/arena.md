---
description: CT-002 deck — popup in tmux, numbered menu in chat (reply a number to open it)
---
The user invoked /arena. Do NOT invent menu content. Work EXACTLY like this:

STEP 1 — run this shell command:

```bash
!
node ~/.config/opencode/ct002/ct002-menu.mjs launch
```

STEP 2 — the script prints a numbered deck card (starts with "⏵⏵ CT-002 DECK"). Show that card, then add exactly one line under it:

`reply a number (1-10) to open that panel`

STEP 3 — if the user's next message is a number 1-10, run the matching panel command and show its output verbatim, again followed by the deck card and the reply-a-number line:

| # | command |
|---|---|
| 1 | `node ~/.config/opencode/ct002/ct002-menu.mjs panel menu` |
| 2 | `node ~/.config/opencode/ct002/ct002-menu.mjs panel board` |
| 3 | `node ~/.config/opencode/ct002/ct002-menu.mjs panel models` |
| 4 | `node ~/.config/opencode/ct002/ct002-menu.mjs panel doctor` |
| 5 | arena battles need a live TUI — reply: `arena needs the popup — run ct002-menu in a terminal, or use tmux` |
| 6 | agent wars — reply same as 5 |
| 7 | `node ~/.config/opencode/ct002/ct002-menu.mjs panel critic` → if it prints "no critic panel", run a critic pass yourself on the user's topic in compact format (FINDINGS / SCORE / VERDICT) |
| 8 | brainstorm — same pattern as 7 (SAFE/WILD/INSANE + VERDICT) |
| 9 | debate — same pattern as 7 (CRITIC PASS / BRAINSTORM PASS / VERDICT) |
| 10 | verify — ask what command to run, run it, show exit code + output compactly |

RULES: never add commentary before/after the card. never renumber. panels 5/6 always point to the TUI. keep total visible output under ~40 lines so nothing collapses.
