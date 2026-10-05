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
| `CANNOT LINK EXECUTABLE curl` / SSL symbol error | libcurl/libssl out of sync; `pkg` can't self-repair (curl-based mirror check) | `apt update && apt full-upgrade`; if that fails, `node`-download + `dpkg -i` per [TERMUX.md §2](TERMUX.md) |
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
