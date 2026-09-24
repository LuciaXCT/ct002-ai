# CT-002 Troubleshooting — Termux Edition

Every error below is a real one someone hit. Find your message, do the fix, done.

---

## 1. `opencode: command not found` (after install)

Shell hasn't reloaded PATH.

```bash
source ~/.bashrc        # or just close + reopen Termux
opencode
```

Still nothing? opencode isn't installed — rerun `bash install.sh`, answer **y** at the opencode step.

---

## 2. `Configuration is invalid ... bad file reference: "{file:./agent/ct002.md}"`

You ran `opencode` **inside the repo folder** and it read the repo's own config before your installed one.

```bash
cd ~                    # leave the repo dir — this alone fixes it
opencode
```

If you want to stay in the repo dir, update it (new clones carry a valid config):

```bash
cd ~/ct002-ai && git checkout -- opencode.json && git pull
```

---

## 3. `error: Your local changes to the following files would be overwritten by merge` (on git pull)

The opencode TUI rewrote the repo's `opencode.json` while you had it open. Discard the local edit, then pull:

```bash
cd ~/ct002-ai
git checkout -- opencode.json
git pull
```

---

## 4. Status bar says `Godmode` or another old agent name

A leftover config from a previous manual setup is **shadowing** CT-002. opencode merges
`opencode.json` **and** `opencode.jsonc`, plus any agent files in `~/.config/opencode/agent*/`.

```bash
# retire the old merged-in config
mv ~/.config/opencode/opencode.jsonc ~/.config/opencode/opencode.jsonc.retired 2>/dev/null

# retire every non-ct002 agent file
for f in ~/.config/opencode/agent/*.md ~/.config/opencode/agents/*.md; do
  case "$f" in *ct002*) ;; *) [ -f "$f" ] && mv "$f" "$f.retired";; esac
done

cd ~ && opencode
```

The installer does this automatically on fresh runs — this manual block is for setups installed before v1.4.

---

## 5. `No active credentials for provider: openai`

Your default model's upstream is **quota-demoted on the router** — the model is real, the router
just has no working upstream key for it right now. Not your fault, not fixable by reinstalling.

```bash
./ct002-doctor          # see which models are alive right now
./ct002-doctor --fix    # switch the default to a live one
```

Pin a live model (big-pickle / nemotron / mimo usually) and wait — combo models
(`my9model-*`, `opencode-free`) **revive on their own** when the quota window resets.
That's normal free-tier routing behavior, not a bug.

---

## 6. `bash: ./ct002-doctor: Permission denied`

The clone missed the exec bit (fixed in repo as of `a7c5220` — `git pull` heals it):

```bash
cd ~/ct002-ai && git pull
chmod +x ct002-doctor
./ct002-doctor
```

Or make it global:

```bash
bash install.sh         # symlinks it into $PREFIX/bin → `ct002-doctor` works anywhere
```

---

## 7. `ct002-doctor: command not found`

You copied the file but your shell's PATH doesn't include `~/.config/opencode`. Either:

```bash
~/.config/opencode/ct002-doctor     # run by full path, or:
cd ~/ct002-ai && ./ct002-doctor     # run from the repo
```

Permanent: rerun the installer — it symlinks both helpers (`ct002-doctor`, `ct002-name`)
into `$PREFIX/bin` (Termux) or `~/.local/bin` (everything else).

---

## 8. Router not answering / `curl: (7) Failed to connect` on :20128

**First run on VPS?** 9router needs its initial password set before it serves API keys.

```bash
# on VPS, in tmux/screen
9router --no-browser
# open http://localhost:20128, set password, copy API key from Keys page
# then rerun installer or edit ~/.config/opencode/opencode.json manually
```

**Android freezes/kills Termux background processes** — usually 3-5s after you switch apps
(that "stuck after opening the dashboard" feeling = Android pausing Termux the moment you left it).

**The fix: the watchdog.**

```bash
termux-wake-lock && ct002-serve       # session 1: guard + auto-revive the router, forever
opencode                              # session 2: your AI
```

The watchdog checks every 10s and revives the router automatically (with a phone notification
when it does). Status/stop:

```bash
ct002-serve status    # router up? watchdog awake? recent revives
cat ~/.9router/serve.log   # what happened while you were away
ct002-serve stop      # shut it all down
```

Extras that help Android behave:
- Termux notification → **Acquire wakelock** button
- Android settings → battery → **unoptimize Termux** (stop battery murder)
- `tmux` alternative: `pkg install tmux && tmux new -s r9` → run `9router` → detach ctrl+b d

If opencode errors with connection refused right after the phone slept, just wait ~8s —
the watchdog is mid-revive.

---

## 9. `git pull` says nothing / shows weird errors after editing files yourself

Your clone diverged. Nuke and re-clone — nothing personal lives in the repo:

```bash
cd ~ && rm -rf ct002-ai
git clone https://github.com/LuciaXCT/ct002-ai.git
cd ct002-ai && bash install.sh
```

---

## 10. Termux install itself fails (`pkg` errors, network)

```bash
pkg update -y --fix-missing
pkg install -y git curl nodejs
```

Then rerun the installer. If `curl` to github fails, your DNS is broken:

```bash
pkg install -y nano
nano $PREFIX/etc/resolv.conf     # set: nameserver 1.1.1.1
```

---

## 11. Model picker (ctrl+p) shows no `ct002/*` models

Config didn't load or was shadowed (see #4). Check what opencode actually loaded:

```bash
opencode debug config 2>/dev/null | head -30
cat ~/.config/opencode/opencode.json   # provider.ct002.models must list models
```

---

## 12. Still broken?

Grab the evidence, then open an issue:

```bash
ct002-doctor > /tmp/health.txt 2>&1
opencode --version >> /tmp/health.txt 2>&1
cat /tmp/health.txt
```

Paste the output → https://github.com/LuciaXCT/ct002-ai/issues

---

## The 4 golden rules (90% of problems)

1. **`opencode` from `$HOME`** — never inside the repo dir
2. **`9router` in its own session** — with `termux-wake-lock`
3. **`ct002-doctor` before blaming the install** — dead models ≠ broken setup
4. **`git pull` before reporting** — fixes land daily
