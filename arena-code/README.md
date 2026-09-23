# Arena Code — npm ship kit

Rebuilds the opencode v1.18.30 TUI with the Arena Code session UI and publishes
both npm packages. Needs one secret: `NPM_TOKEN` (npm account that owns @pawbxj).

## One-time setup
1. Get an npm Publish/Automation token from the pawbxj npm account
2. This repo → Settings → Secrets and variables → Actions → New secret
   - Name: `NPM_TOKEN` → paste the token

## Activate (one time, 30 seconds)
The workflow file can't be pushed from this machine (missing git `workflow` scope).
Upload it by hand, once:
1. GitHub → this repo → **Add file → Upload files** → `.github/workflows/`
2. Upload `publish-arena-code.yml` from this folder (create the folder via the filename box)

## Ship
GitHub → Actions → **publish-arena-code** → Run workflow
- publishes `@pawbxj/arena-cli-linux-x64@1.1.0` (rebuilt binary, ~49 MB)
- then `@pawbxj/arena-cli@1.1.0` (patched shim)

## Contents
- `arena-code.patch` — TUI restyle (banner, YOU cards, ARENA labels, coral edges, Ask Arena Code)
- `ctcode-logo.txt` — the baked banner art
- `main-pkg/` — the shim package published as-is (prepack removed so patches survive)
- `../.github/workflows/publish-arena-code.yml` — the pipeline

## Install after publish
npm i -g @pawbxj/arena-cli
