# Arena CLI

> A powerful AI coding agent CLI that works directly inside local repositories.

[![Version](https://img.shields.io/badge/version-0.0.1--dev-blue.svg)](https://github.com/k1ruuuu/arena-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![Bun](https://img.shields.io/badge/bun-%3E%3D1.0-orange.svg)](https://bun.sh)

Arena is an AI-powered coding agent that runs locally in your repository. It understands your codebase, edits files, runs commands, and iterates with you — directly from the terminal.

**Package:** `@pawbxj/arena-cli` • **Command:** `arena` • **Version:** `1.0.0-Beta` • **Author:** Pawbxj

---

## Features

- **Local-first agent** — works inside any git repository, no cloud workspace required
- **Multi-provider** — OpenAI, Anthropic, Gemini, OpenRouter, Ollama, LM Studio, and any OpenAI-compatible endpoint
- **File-aware** — reads, writes, and patches code with context-aware tooling
- **Terminal-native** — clean CLI with `arena`, `arena "task"`, `arena --help`, `arena --version`
- **Secure by default** — API keys via environment variables, never hardcoded
- **ESM & cross-runtime** — works with both `npm`/`npx` and `bun`/`bunx`
- **Battle-tested core** — built on the opencode engine with Arena extensions

## Installation with npm

```bash
# Global install
npm install -g @pawbxj/arena-cli

# Verify
arena --version   # 1.0.0-Beta
arena --help
```

Use without installing:

```bash
npx @pawbxj/arena-cli --help
npx @pawbxj/arena-cli "fix failing tests in src/auth"
```

Update:

```bash
npm install -g @pawbxj/arena-cli@latest
```

## Installation with Bun

```bash
# Global install
bun install -g @pawbxj/arena-cli

# Verify
arena --version
arena --help
```

Use without installing:

```bash
bunx @pawbxj/arena-cli --help
bunx @pawbxj/arena-cli "add dark mode toggle"
```

Update:

```bash
bun install -g @pawbxj/arena-cli@latest
```

> Bun consumes the same npm registry package — no separate Bun-only build is required.

## Usage Examples

```bash
# Interactive help
arena

# Show version and help
arena --version
arena --help

# Run a single task
arena "fix the failing tests in src/auth"

# Specify a model inline
arena --model openrouter/qwen/qwen3-coder "refactor the API layer to use zod"
arena --model anthropic/claude-sonnet-4 "explain this codebase"
arena --model ollama/qwen3:8b "summarize the git history"

# Local providers (no API key needed)
arena --model ollama/llama3.1 "write unit tests for utils/math.ts"
arena --model lmstudio/qwen2 "review this PR diff"

# Custom config file
arena --config ./arena.yaml "migrate the database schema"
```

**Working directory:** Arena runs in the current directory (`process.cwd()`). Run it from your repository root.

## Interaction Modes

| Mode | How to use | Behavior |
|------|-----------|----------|
| `Direct` | `arena` / `arena "task"` | Normal single-model session (default) |
| `Battle` | `arena battle "prompt"` | Blind test: two models answer, identities hidden until you vote; vote updates local Elo (`arena leaderboard`) |
| `Side by side` | `arena side-by-side "prompt"` | Same prompt on two named models, both answers shown labeled, no vote recorded |
| `DeepMode` | `arena --agent DeepMode "task"` or switch agent in TUI | Orchestrator agent for complex multi-stage work: plans first, verifies after |

In the TUI, `tab` switches between the four native agents (`Battle`, `DeepMode`, `Side by side`, `Direct`); `Direct` is the default. The `Battle` and `Side by side` agents run the same workflow through subagents pinned to explicit models (the `task` tool accepts a `model` in `provider/model` format), and `Battle` records your verdict with the `arena_vote` tool so Elo rankings stay in sync with `arena leaderboard`.

For point-and-click comparison without typing model IDs, use `/battle` or `/side-by-side` in the TUI: you pick both models from the model picker (Battle defaults to the anonymous free pair Step 3.7 Flash and Dots 3 Note Preview; Side by side lets you customize both), watch the answers stream, then vote blind in Battle mode while identities stay hidden until the reveal.

## Configuration

Arena loads configuration from:

1. `~/.config/arena/config.yaml` (primary)
2. `~/.config/arena/config.yml` (fallback)
3. `$ARENA_CONFIG` env var (override path)
4. Inline flags (`--model`, `--provider`)

Example `~/.config/arena/config.yaml`:

```yaml
provider: openrouter
model: qwen/qwen3-coder
apiKeyEnv: OPENROUTER_API_KEY
```

Arena also supports multiple models per provider. This file belongs only to Arena; it does not read OpenCode configuration files.

```yaml
provider: anthropic
model: claude-sonnet-4
providers:
  anthropic:
    apiKeyEnv: ANTHROPIC_API_KEY
    models:
      claude-sonnet-4:
        name: Claude Sonnet 4
      claude-opus-4:
        name: Claude Opus 4
  openrouter:
    apiKeyEnv: OPENROUTER_API_KEY
    models:
      qwen/qwen3-coder:
        name: Qwen 3 Coder
      deepseek/deepseek-chat:
        name: DeepSeek Chat
```

Minimal example for local usage:

```yaml
provider: ollama
model: qwen3:8b
```

Create the config directory:

```bash
mkdir -p ~/.config/arena
cat > ~/.config/arena/config.yaml << 'EOF'
provider: openrouter
model: qwen/qwen3-coder
apiKeyEnv: OPENROUTER_API_KEY
EOF
```

## Provider Configuration

| Provider | Example `provider` | `apiKeyEnv` | Notes |
|----------|-------------------|-------------|-------|
| OpenAI | `openai` | `OPENAI_API_KEY` | `https://api.openai.com/v1` |
| Anthropic | `anthropic` | `ANTHROPIC_API_KEY` | Claude models |
| Gemini | `gemini` | `GEMINI_API_KEY` | Google AI |
| OpenRouter | `openrouter` | `OPENROUTER_API_KEY` | Aggregator, e.g. `qwen/qwen3-coder` |
| Ollama | `ollama` | *(none)* | Local: `http://127.0.0.1:11434/v1` |
| LM Studio | `lmstudio` | *(none)* | Local: `http://127.0.0.1:1234/v1` |
| Kilo Gateway | `arena` | `ARENA_API_KEY` (`KILO_API_KEY` fallback) | Built-in free `:free` models, no key needed; key unlocks paid models |
| Custom | `custom` | `CUSTOM_API_KEY` | Set `baseURL` in config |

## arena.ai built-in models (free, no key required)

Arena ships with built-in models served through an OpenAI-compatible gateway backend ([Kilo AI gateway](https://kilo.ai/docs/gateway)). In the TUI and CLI they appear under the `arena.ai` provider. Free models (IDs ending in `:free`) work **anonymously**, rate-limited to 200 requests/hour per IP. No signup, no key, no config file: a fresh `arena "task"` just works.

```bash
arena --model arena/qwen/qwen3.8-27b:free "explain this codebase"
arena --model arena/cohere/north-mini-code:free "write unit tests for utils/math.ts"
arena --model arena "summarize the git history"  # defaults to Qwen 3.8 27B (free)
```

(`kilo` stays accepted as an alias: `--model kilo/...` and `provider: kilo` resolve to the same provider.)

Or pin it in `~/.config/arena/config.yaml`:

```yaml
provider: arena
model: qwen/qwen3.8-27b:free
```

To use paid models on the same gateway, add a key (never commit it). `ARENA_API_KEY` is read first, `KILO_API_KEY` works as fallback:

```bash
export ARENA_API_KEY="..."
```

```yaml
provider: arena
model: anthropic/claude-sonnet-4.5
apiKeyEnv: ARENA_API_KEY
```

Run `arena models arena` to list the built-in free catalog.

Environment variables are read directly; keys are **never** committed or bundled.

```bash
export OPENROUTER_API_KEY="sk-or-v1-..."
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
export GEMINI_API_KEY="AIza..."
# For local providers, no key is required
```

You can also set a generic key for any provider by defining `apiKeyEnv` in `config.yaml` to point at any env var (e.g. `MY_TEAM_KEY`).

## Skills (Claude Code compatible)

Arena loads `SKILL.md` skills exactly like Claude Code. The model auto-invokes them from `description`, or you invoke manually with `/skill-name`.

Locations (default is global):

- Global: `~/.config/arena/skills/<name>/SKILL.md`
- Project: `.arena/skills/<name>/SKILL.md`
- Compat: `~/.claude/skills/`, `.claude/skills/`, `~/.agents/skills/`, `.agents/skills/`
- Plugin skills (reserved): `.arena/plugins/<plugin>/skills/<name>/SKILL.md` as `<plugin>:<name>`

Minimal skill:

```md
---
name: deploy
description: Deploy the app. Use when asked to deploy, release, or ship.
argument-hint: "[env]"
arguments: target
---

# Deploy

Deploy `$target` with `$ARGUMENTS`. Scripts live in `${CLAUDE_SKILL_DIR}/scripts/`.
```

Notes:

- Directory name is the `/command`. Frontmatter `name` is the display label (for plugin skills it sets the last segment of `plugin:skill`).
- `description` + `when_to_use` (max 1536 chars) is the routing signal. Put the use case first.
- `$name` maps to positional `$1`, `$2` from `arguments`. `$ARGUMENTS`, `$1`, and `!`command`` work like slash commands. `${CLAUDE_SKILL_DIR}` and `${ARENA_SKILL_DIR}` resolve to the skill folder.
- `user-invocable: false` hides the skill from the `/` menu but keeps it model-invoked. `disable-model-invocation: true` hides it from the model.
- Skills with `argument-hint` show it in the `/` menu (e.g. `/deploy [env]`), like Claude Code.
- Only `name` + `description` stay in context. Body and `references/`, `examples/`, `scripts/` load on demand, so keep `SKILL.md` lean and reference supporting files explicitly.

## Plugins (Claude Code compatible)

Arena installs and runs Claude Code plugins unmodified: same `plugin.json` manifest, same `skills/` + `commands/` + `agents/` layout, same `plugin:skill` namespacing, same marketplace format.

```bash
# Local folder, git repo, npm package, or marketplace entry
arena plugin install ./my-plugin
arena plugin install owner/repo --scope project
arena plugin install npm:@scope/my-plugin
arena plugin install review@team-market --scope project

# Manage
arena plugin list
arena plugin enable review --yes
arena plugin disable review
arena plugin update review
arena plugin validate ./my-plugin
arena plugin uninstall review

# Marketplaces (GitHub shorthand, git URL, local path, or JSON URL)
arena plugin marketplace add ./my-marketplace --scope project
arena plugin marketplace add acme-corp/arena-plugins
arena plugin marketplace list
arena plugin marketplace update
arena plugin marketplace remove my-marketplace
```

Notes:

- In the TUI, `/plugin` opens the plugin manager (install, enable/disable, uninstall, update, marketplaces) — same role as Claude Code's `/plugin` panel. Every install and enable shows a permission summary and asks for confirmation.
- Default scope is global (`~/.config/arena/plugins/`). `--scope project` installs into `.arena/plugins/` so the team shares it.
- Pass `--yes` for scripts, or run in a TTY-less environment which requires `--yes`.
- Installed plugin skills appear as `/plugin:skill` slash commands and model-invocable skills. A new session picks them up (same as Claude Code `/reload-plugins`).
- `hooks` and `mcpServers` in manifests are parsed and reported by `validate`, but not executed yet.

## Development Setup

Requirements: Node `>=18`, Bun `>=1.0`.

```bash
# Clone
git clone https://github.com/k1ruuuu/arena-cli.git
cd arena

# Install dependencies
bun install
# or
npm install

# Run in dev mode (no build)
npm run dev -- --help
bun run dev -- --help
# Equivalent: bun --conditions=browser ./src/cli.ts --help
```

Project structure:

```
.
├── src/
│   ├── cli.ts        # CLI entry (shebang, yargs-style parsing, task routing)
│   └── config.ts     # ~/.config/arena/config.yaml loader
├── dist/
│   └── cli.js        # Built executable (generated)
├── build.ts          # Bun build script (ESM, adds shebang, chmod +x)
├── package.json      # @pawbxj/arena-cli, bin: arena -> dist/cli.js
├── tsconfig.json
└── README.md
```

## Build Instructions

```bash
# Build to dist/cli.js
npm run build
# or
bun run build
# -> runs: bun run build.ts

# The build:
# - syncs platform package versions with the root version
# - bundles src/cli.ts (+ config, modes) with Bun.build (ESM, target node)
# - externalizes `yaml` (installed as dependency)
# - injects ARENA_VERSION from package.json, prepends #!/usr/bin/env node, chmod +x
# - produces dist/cli.js (+ dist/arena runtime binary unless --no-binary)

# Runtime matrix (one binary per OS/arch, published as optionalDependencies):
npm run build:binaries
# -> runs: bun run build.ts --matrix
# -> fills platforms/<os>-<arch>/bin/arena from the opencode matrix build

# Verify
./dist/cli.js --version  # 1.0.0-Beta
./dist/cli.js --help
node dist/cli.js "hello"
```

Typecheck:

```bash
npm run typecheck
# tsc --noEmit
```

## Testing

```bash
# Run tests (Node built-in runner, no runtime binary needed)
npm test

# Lint
npm run lint
# prettier --check

# Format
npm run format

# Quick manual checks
./dist/cli.js --version
./dist/cli.js --help
./dist/cli.js "explain the README"
OPENROUTER_API_KEY=dummy ./dist/cli.js --model openrouter/qwen/qwen3-coder "test task"
```

## Publishing Instructions

The package is publishable to the npm registry and consumable by both npm and Bun. Do **not** publish automatically — Pawbxj publishes manually.

```bash
# 1. Ensure clean build
npm run clean
npm run build
./dist/cli.js --version  # must be 1.0.0-Beta
./dist/cli.js --help

# 2. Verify package contents (dry run)
npm pack --dry-run
# Expected files: dist/cli.js, package.json, README.md, LICENSE
# Must NOT contain: .env, *.key, node_modules, src, logs, .git, tmp

# 3. Optional: create tarball and test install
npm pack
# -> pawbxj-arena-cli-1.0.0-Beta.tgz

# Test with npm
npm install -g ./pawbxj-arena-cli-1.0.0-Beta.tgz
arena --version
arena --help
arena "test task"
npm uninstall -g @pawbxj/arena-cli

# Test with bun (same tarball)
bun install -g ./pawbxj-arena-cli-1.0.0-Beta.tgz
arena --version
bun pm ls -g | grep arena
bunx @pawbxj/arena-cli --help

# Also test npx/bunx without global install (from the tarball)
npx --package ./pawbxj-arena-cli-1.0.0-Beta.tgz -c "arena --help"
bunx --package ./pawbxj-arena-cli-1.0.0-Beta.tgz arena --help
# After publishing, the same works from the registry:
# npx --package @pawbxj/arena-cli -c "arena --help"
# bunx --package @pawbxj/arena-cli arena --help

# 4. Publish (maintainer only)
npm publish --access public
# or
bun publish

# Verify on registry
npm view @pawbxj/arena-cli version
```

Publishing safety:

- `package.json` uses `files: ["dist", "README.md", "LICENSE"]` whitelist.
- `.npmignore` additionally excludes `.env`, `*.key`, `logs`, `node_modules`, `src`, `tmp`, `.git`, etc.
- `.gitignore` excludes secrets and build artifacts.
- `dist/cli.js` contains no secrets — it reads `~/.config/arena/config.yaml` and env vars at runtime.
- Never commit `.env` or API keys.

## Security Notes

- **Never hardcode API keys.** Set them via environment variables (`OPENROUTER_API_KEY`, etc.) and reference them with `apiKeyEnv` in `config.yaml`.
- **Do not commit** `.env`, `config.yaml` with keys, or `~/.config/arena/config.yaml` to git.
- **Local providers** (Ollama, LM Studio) require no keys and run on `127.0.0.1`.
- **Review `npm pack --dry-run`** before every publish to ensure no secrets are included.
- **Permissions:** The published `dist/cli.js` is `chmod +x` with shebang `#!/usr/bin/env node`. No credentials are bundled.
- Report vulnerabilities via `https://github.com/k1ruuuu/arena-cli/issues`.

## License

MIT — see [LICENSE](LICENSE).

## Author

**Pawbxj** — [@pawbxj/arena-cli](https://github.com/k1ruuuu/arena-cli)

## Version

`1.0.0-Beta` (pre-release, ESM, Node `>=18`, Bun `>=1.0`)
