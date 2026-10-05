# luciaa on Termux (Android) — Deployment & Hardening

Everything the installer **cannot** do for you: Android-level settings, the
known Termux blockers, and the commands to keep 9router alive.

Install Termux from **F-Droid**, not the Play Store — the Play build is
abandoned and its packages are months stale, which is the root of half the
errors below.

<https://f-droid.org/en/packages/com.termux/>

---

## 1. Prerequisites

```bash
pkg update -y && pkg upgrade -y
pkg install -y git curl nodejs termux-api
termux-setup-storage      # grant storage access when the prompt appears
```

Then install luciaa:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/LuciaXCT/luciaa/main/install.sh)
```

The installer removes duplicate `opencode` / `9router` installs *before* it
installs anything. To run only that step: `bash install.sh --dedup-only`.

---

## 2. Known blocker — `curl` dies with an SSL symbol error

**Symptom**

```
CANNOT LINK EXECUTABLE "curl": cannot locate symbol
"SSL_set_quic_tls_early_data_enabled" referenced by
"/data/data/com.termux/files/usr/lib/libcurl.so"
```

**Cause.** A partial upgrade left `libcurl.so` newer than `libssl.so` /
`libcrypto.so`. `curl` links against a symbol the installed OpenSSL does not
export, so the binary cannot start — and `git` (which uses libcurl) fails the
same way. This is not a luciaa bug; it is a stale Termux package set.

**Fix** (run in order):

```bash
pkg update -y && pkg upgrade -y

# if the symbol error persists, force the pair back in sync
pkg install --reinstall -y openssl libcurl curl

# verify — must print a version, not a symbol error
curl --version
```

Then re-run the installer. The installer now checks for this up front and
stops with this same fix instead of failing later in a confusing place.

> If `pkg upgrade` itself cannot download, you are caught in the same broken
> libcurl. `pkg install --reinstall -y openssl` alone usually restores the
> symbol `libcurl` needs; retry `pkg upgrade` afterwards.

---

## 3. Stop Android from killing services

Android freezes or kills Termux seconds after you leave the app, which is why
9router appears to "die" on its own.

1. **Battery exclusion** — Settings → Apps → Termux → Battery → **Unrestricted**
   (wording varies: "Don't optimise" / "Not optimised").
2. **Wake lock** — keep the CPU awake while the watchdog runs:
   ```bash
   termux-wake-lock        # released by: termux-wake-unlock
   ```
   `luciaa-serve start` takes the wake lock for you when `termux-api` is
   installed.
3. **Ongoing notification** — makes Android less likely to reap Termux:
   ```bash
   termux-notification --title "luciaa" --content "watchdog active" --ongoing
   ```

---

## 4. Run 9router in the background (the guard)

```bash
luciaa-serve start --daemon   # detached; survives closing the session
luciaa-serve status           # router up? guard alive?
luciaa-serve logs             # tail ~/.9router/serve.log
luciaa-serve repair           # fix a half-installed 9router
luciaa-serve stop
```

`start` without `--daemon` runs in the foreground (useful for watching it).
The guard checks every 10s and revives 9router with backoff; after three
failed revives it reinstalls 9router automatically.

Then, in a **new** Termux session:

```bash
opencode
```

### Persist across reboots (optional, `termux-services`)

```bash
pkg install -y termux-services
sv-enable sshd         # optional: remote access
# run the watchdog as a service
mkdir -p $PREFIX/var/service/luciaa
cat > $PREFIX/var/service/luciaa/run <<'EOF'
#!/data/data/com.termux/files/usr/bin/sh
exec luciaa-serve start
EOF
chmod +x $PREFIX/var/service/luciaa/run
sv up luciaa
sv status luciaa
```

---

## 5. Diagnostics

```bash
{
  echo "=== sys ===";   uname -a; node --version; npm --version
  echo "=== curl ===";  curl --version 2>&1 | head -1
  echo "=== cli ===";   opencode --version 2>&1 | head -1
  echo "=== router ===";luciaa-serve status
  echo "=== log ===";   tail -20 ~/.9router/serve.log 2>/dev/null
  echo "=== dups ===";  type -a opencode; type -a 9router
} > /tmp/luciaa-diag.txt; cat /tmp/luciaa-diag.txt
```

Attach `/tmp/luciaa-diag.txt` to a GitHub issue.

---

## 6. Termux troubleshooting table

| Symptom | Cause | Fix |
|---|---|---|
| `CANNOT LINK EXECUTABLE curl` / SSL symbol error | libcurl/libssl out of sync | `pkg update -y && pkg upgrade -y`; then `pkg install --reinstall -y openssl libcurl curl` |
| `9router: bad interpreter: /usr/bin/env` | Termux has no `/usr/bin/env` | installer/watchdog heal the shebang automatically; `luciaa-serve repair` to force |
| 9router stops when you leave the app | Android froze Termux | battery exclusion + `luciaa-serve start --daemon` + `termux-wake-lock` |
| `luciaa-serve: command not found` | installer never finished | finish §2, then re-run the installer |
| Router up but all models 401 | first-run password not set | open `http://localhost:20128`, set password, then `luciaa-doctor --fix` |
| Two `opencode` binaries, models differ | duplicate installs | `bash install.sh --dedup-only` |
| `pkg`/`npm` interrupted mid-install | network drop / OOM | `pkg install --reinstall` or `npm i -g 9router`; installer and `luciaa-serve repair` clean the broken tree |
| `EACCES` on `npm i -g` | npm prefix not writable | `npm config set prefix $PREFIX` (Termux prefix is user-owned) |

---

## 7. Battery / data notes

- 9router holds the model connection, so the wake lock costs battery. Stop it
  when idle: `luciaa-serve stop`.
- Free-tier model quota is per-provider; `luciaa-doctor --fix` rotates to a
  live model when one is exhausted.
- Everything the installer retires is moved, not deleted:
  `~/.luciaa-dedup-backup-<timestamp>/`.
