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

**Why `pkg` can't fix this itself.** `pkg` runs a `curl`-based mirror check
before doing anything else (`pkg --check-mirror update`), so it dies on the
broken `curl` and never reaches the upgrade that would repair it. `apt` skips
that mirror check.

**Fix — try `apt` first:**

```bash
apt update && apt full-upgrade

# verify — must print a version, not a symbol error
curl --version
```

**If `apt` hits the same error**, install the packages directly with `dpkg`,
downloading them with `node` (node links OpenSSL directly, not libcurl, so it
keeps working):

```bash
cat > /tmp/tx-dl.js <<'JS'
const https=require('https'),zlib=require('zlib'),fs=require('fs');
const arch={x64:'x86_64',arm64:'aarch64',arm:'arm',ia32:'i686'}[process.arch]||'aarch64';
const ROOT='https://packages.termux.dev/apt/termux-main/';
const INDEX=ROOT+'dists/stable/main/binary-'+arch+'/Packages.gz';
function get(u){return new Promise((ok,no)=>{https.get(u,r=>{
  if(r.statusCode>=300&&r.statusCode<400&&r.headers.location){r.resume();return get(new URL(r.headers.location,u).toString()).then(ok,no);}
  if(r.statusCode!==200){r.resume();return no(new Error(u+' HTTP '+r.statusCode));}
  const c=[];r.on('data',d=>c.push(d));r.on('end',()=>ok(Buffer.concat(c)));}).on('error',no);});}
(async()=>{
  const want=['openssl','libcurl','curl'], pick={};
  const txt=zlib.gunzipSync(await get(INDEX)).toString();
  for(const b of txt.split('\n\n')){
    const p=/^Package: (\S+)/m.exec(b); if(!p||!want.includes(p[1])||pick[p[1]])continue;
    const f=/^Filename: (\S+)/m.exec(b), v=/^Version: (\S+)/m.exec(b);
    if(f)pick[p[1]]={file:f[1],version:v?v[1]:'?'};
  }
  console.log('arch: '+arch);
  for(const p of want){
    if(!pick[p]){console.error('NOT FOUND: '+p);continue;}
    const buf=await get(ROOT+pick[p].file), name=pick[p].file.split('/').pop();
    fs.writeFileSync('/tmp/'+name,buf);
    console.log('saved /tmp/'+name+'  ('+pick[p].version+')');
  }
})().catch(e=>{console.error('FAILED: '+e.message);process.exit(1);});
JS

node /tmp/tx-dl.js

# openssl first, then the curl pair
dpkg -i /tmp/openssl_*.deb /tmp/libcurl_*.deb /tmp/curl_*.deb
apt --fix-broken install     # only if dpkg reports unmet deps

curl --version
```

Then align everything and install luciaa:

```bash
pkg update -y && pkg upgrade -y
bash <(curl -fsSL https://raw.githubusercontent.com/LuciaXCT/luciaa/main/install.sh)
```

The installer also checks for this up front and stops with this same guidance
instead of failing later in a confusing place.

---

## 3. opencode on Termux — use the Android build

The upstream `opencode.ai/install` script targets **glibc**. Android uses
**bionic** libc, so the `linux-arm64` binary it downloads can install but fail
to execute. It is also a ~100 MB download, and its progress bar is exactly why
the installer no longer runs a spinner of its own — two progress bars writing
to one line is the garbled `[⠏] ■■■ 51%` mess.

If `opencode --version` works after install, you are fine. If not, install the
Android-native build:

```bash
bash install.sh --opencode termux
```

That resolves the latest `guysoft/opencode-termux` release (a third-party
cross-compiled Bun + WebKit build for Android aarch64), downloads the `.deb`
with a resumable `curl -C -`, and installs it with `dpkg`. It is a drop-in
`opencode` command.

| You want | Flag |
|---|---|
| try upstream, then verify (default) | `--opencode auto` |
| upstream only | `--opencode official` |
| Android-native build (no glibc) | `--opencode termux` |
| **glibc route** — Termux `glibc-repo` + a glibc build | `--opencode glibc` |
| no opencode here, just 9router + config | `--opencode skip` |

### The glibc route

Termux ships a `glibc-repo` that provides `glibc` and `openssl-glibc`, which
lets a normally-built (glibc) opencode run on Android instead of needing a
cross-compiled native build:

```bash
bash install.sh --opencode glibc
```

That runs, in order:

```bash
pkg install -y glibc-repo
pkg update -y
pkg install -y glibc openssl-glibc
# newest opencode-glibc_<ver>_aarch64.deb from Hope2333/opencode-termux
dpkg -i opencode-glibc_<ver>_aarch64.deb
```

The newest glibc build is resolved from the release list (`.pkg.tar.xz` assets
are ignored; only `.deb` is used), and the download is resumable. aarch64 only.

Running 9router on the phone and `opencode` on a computer over LAN is also
fully supported — pick **mode 2** at the prompt.

### PATH

The installer writes a PATH line to `~/.bashrc` (creating it if missing — a
fresh Termux profile has none, which is why upstream prints "No config file
found for bash") and to `~/.zshrc` when present:

```
export PATH="$PREFIX/bin:$HOME/.opencode/bin:$HOME/.local/bin:$PATH"
```

**Order matters.** A working binary must come *before* a dead one, or the
dead one shadows it. The upstream installer leaves a non-executable glibc
binary at `~/.opencode/bin/opencode`; if that path is first, `opencode` fails
with `cannot execute: required file not found` even after a good install. So
the installer (1) puts `$PREFIX/bin` first whenever the binary there actually
runs, (2) deletes a `~/.opencode/bin/opencode` that fails `--version`, and
(3) rewrites its own previous PATH line instead of skipping it.

Bash also caches command lookups, so after editing an rc file run `hash -r`
(or start a new session) — `exec $SHELL` restarts only the shell inside the
same terminal, not the Termux app.

To check what will actually run:
```bash
type -a opencode      # first line = what bash executes
hash -r               # clear the cache after any PATH change
```

Opt out of rc edits with `--no-path`; the installer then prints the exact line
for you to add yourself.

---

## 4. Stop Android from killing services

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

## 5. Run 9router in the background (the guard)

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

## 6. Diagnostics

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

## 7. Termux troubleshooting table

| Symptom | Cause | Fix |
|---|---|---|
| `CANNOT LINK EXECUTABLE curl` / SSL symbol error | libcurl/libssl out of sync; `pkg` can't self-repair (curl-based mirror check) | `apt update && apt full-upgrade`; if that fails, `node`-download + `dpkg -i` per [TERMUX.md §2](TERMUX.md) |
| `9router: bad interpreter: /usr/bin/env` | Termux has no `/usr/bin/env` | installer/watchdog heal the shebang automatically; `luciaa-serve repair` to force |
| `opencode: cannot execute: required file not found` | upstream build is glibc; Android is bionic | `bash install.sh --opencode glibc` (Termux glibc-repo) or `--opencode termux` (native build) — both retire the dead copy so it can't shadow the new one |
| `opencode: command not found` after install | PATH not updated | restart the shell, or `bash install.sh` again (it adds PATH); `--no-path` prints the line |
| `opencode` fails but `$PREFIX/bin/opencode` works | a dead `~/.opencode/bin` entry is first on PATH / bash cache | re-run the installer (it reorders + retires the dead copy), then `hash -r`; check with `type -a opencode` |
| 9router stops when you leave the app | Android froze Termux | battery exclusion + `luciaa-serve start --daemon` + `termux-wake-lock` |
| `luciaa-serve: command not found` | installer never finished | finish §2, then re-run the installer |
| Router up but all models 401 | first-run password not set | open `http://localhost:20128`, set password, then `luciaa-doctor --fix` |
| Two `opencode` binaries, models differ | duplicate installs | `bash install.sh --dedup-only` |
| `pkg`/`npm` interrupted mid-install | network drop / OOM | `pkg install --reinstall` or `npm i -g 9router`; installer and `luciaa-serve repair` clean the broken tree |
| `EACCES` on `npm i -g` | npm prefix not writable | `npm config set prefix $PREFIX` (Termux prefix is user-owned) |

---

## 8. Battery / data notes

- 9router holds the model connection, so the wake lock costs battery. Stop it
  when idle: `luciaa-serve stop`.
- Free-tier model quota is per-provider; `luciaa-doctor --fix` rotates to a
  live model when one is exhausted.
- Everything the installer retires is moved, not deleted:
  `~/.luciaa-dedup-backup-<timestamp>/`.
