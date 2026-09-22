---
description: Race N AI agents on a task, judge picks the winner (arena.ai agent mode inside opencode)
agent: DeepMode
subtask: false
---

Race AI agents on a task — arena style.

The user will give you a task (everything after "arena" in their message). Run the arena race EXACTLY like this:

```bash
node $HOME/arena-battle/arena-agent.mjs "<the task verbatim>" --agents 3 --adopt --timeout 900
```

Rules for you:
- The `--adopt` flag is critical: it stamps the winning agent's files straight into the user's project. Never drop it.
- Quote the task exactly as the user phrased it — do not rewrite, expand, or "improve" it.
- If the user specified a number of agents ("race 5 agents"), pass `--agents N`. Default is 3.
- If the user pointed at a different directory, add `--cwd <dir>`.
- Run the command with the Bash tool and let it stream. It can take several minutes — do not interrupt it.
- When the race finishes, report: the ranking, the winner + the judge's reason, and which files changed. Show the final race output verbatim (the part from `── race over` down).
- If the race fails because 9router is down (:20128), tell the user to start it and stop there — do not try to fix the router yourself.
