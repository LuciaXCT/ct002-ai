#!/usr/bin/env node
import { createRequire } from "node:module";
var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __toESM = (mod, isNodeMode, target) => {
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: () => mod[key],
        enumerable: true
      });
  return to;
};
var __require = /* @__PURE__ */ createRequire(import.meta.url);

// src/cli.ts
import childProcess from "node:child_process";
import path2 from "node:path";
import fs2 from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire as createRequire2 } from "node:module";

// src/config.ts
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
var KILO_BASE_URL = "http://localhost:20128/v1";
var KILO_DEFAULT_MODEL = "my9model-smart";
var KILO_FREE_CATALOG = [
  { id: "qwen/qwen3.8-27b:free", name: "Qwen 3.8 27B (free)", context: 262144 },
  { id: "cohere/north-mini-code:free", name: "North Mini Code (free)", context: 256000 },
  { id: "z-ai/glm-5.2:free", name: "GLM 5.2 (free)", context: 32768 },
  { id: "liquid/lfm-2.5-2.6b:free", name: "LFM 2.5 2.6B (free)", context: 65536 },
  { id: "stepfun/step-3.7-flash:free", name: "Step 3.7 Flash (free)", context: 262144 },
  { id: "poolside/laguna-s-2.1:free", name: "Laguna S 2.1 (free)", context: 262144 },
  { id: "poolside/laguna-xs-2.1:free", name: "Laguna XS 2.1 (free)", context: 262144 },
  { id: "nvidia/nemotron-3-ultra-550b-a55b:free", name: "Nemotron 3 Ultra (free)", context: 1e6 },
  { id: "nvidia/nemotron-3.5-lightning:free", name: "Nemotron 3.5 Lightning (free)", context: 1e6 },
  { id: "nvidia/nemotron-3-super-120b-a12b:free", name: "Nemotron 3 Super (free)", context: 262144 },
  {
    id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    name: "Nemotron 3 Nano Reasoning (free)",
    context: 256000
  },
  { id: "thinkingmachines/inkling-small:free", name: "Inkling Small (free)", context: 1048576 },
  { id: "dots-studio/dots-3-note-preview:free", name: "Dots 3 Note Preview (free)", context: 512000 },
  { id: "nex-agi/nex-n2.5-pro:free", name: "Nex N2.5 Pro (free)", context: 262144 },
  { id: "nex-agi/nex-n2.5-mini:free", name: "Nex N2.5 Mini (free)", context: 262144 },
  { id: "inclusionai/ling-3.0-flash-vl:free", name: "Ling 3.0 Flash VL (free)", context: 262144 },
  { id: "inclusionai/ling-3.0-flash-sante:free", name: "Ling 3.0 Flash Sante (free)", context: 262144 },
  { id: "inclusionai/ling-3.0-flash-fin:free", name: "Ling 3.0 Flash Fin (free)", context: 262144 }
];
function kiloModels() {
  return Object.fromEntries(KILO_FREE_CATALOG.map((item) => [
    item.id,
    { id: item.id, name: item.name, limit: { context: item.context, output: 8192 } }
  ]));
}
function kiloProviderConfig(top, custom) {
  const customModels = Object.fromEntries(Object.entries(custom?.models ?? {}).map(([modelID, model]) => {
    if (typeof model === "string")
      return [modelID, { id: modelID, name: model }];
    return [modelID, { id: model.model ?? modelID, name: model.name, ...model.limit ? { limit: model.limit } : {} }];
  }));
  const catalog = kiloModels();
  const models = { ...catalog, ...customModels };
  if (top?.model && !models[top.model])
    models[top.model] = { id: top.model, name: top.model };
  const env = custom?.apiKeyEnv ?? top?.apiKeyEnv ?? "ARENA_API_KEY,KILO_API_KEY";
  return {
    name: "arena.ai",
    api: custom?.baseURL ?? KILO_BASE_URL,
    npm: "@ai-sdk/openai-compatible",
    options: { baseURL: custom?.baseURL ?? KILO_BASE_URL },
    env: env.split(","),
    models
  };
}
function isBuiltInProvider(id) {
  return id !== undefined && (id.toLowerCase() === "arena" || id.toLowerCase() === "kilo");
}
var CONFIG_PATH = path.join(os.homedir(), ".config", "arena", "config.yaml");
var CONFIG_PATH_ALT = path.join(os.homedir(), ".config", "arena", "config.yml");
var OPENCODE_CONFIG = path.join(os.homedir(), ".config", "opencode", "opencode.json");
function parseYaml(content) {
  const result = {};
  const lines = content.split(`
`);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#"))
      continue;
    const colon = line.indexOf(":");
    if (colon === -1)
      continue;
    const key = line.slice(0, colon).trim();
    let value = line.slice(colon + 1).trim();
    if (value.startsWith('"') && value.endsWith('"') || value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    if (key && value)
      result[key] = value;
  }
  return result;
}
async function loadConfig() {
  const candidates = [CONFIG_PATH, CONFIG_PATH_ALT];
  if (process.env.ARENA_CONFIG)
    candidates.unshift(process.env.ARENA_CONFIG);
  for (const p of candidates) {
    try {
      if (!fs.existsSync(p))
        continue;
      const content = await fs.promises.readFile(p, "utf8");
      if (p.endsWith(".yaml") || p.endsWith(".yml")) {
        try {
          const yaml = await import("yaml");
          const parsed = yaml.parse(content);
          return { config: parsed ?? {}, path: p };
        } catch {
          return { config: parseYaml(content), path: p };
        }
      }
      return { config: JSON.parse(content), path: p };
    } catch {
      continue;
    }
  }
  return { config: {}, path: null };
}
function load9RouterKey() {
  try {
    const raw = fs.readFileSync(OPENCODE_CONFIG, "utf8");
    const j = JSON.parse(raw);
    const key = j?.provider?.ct002?.options?.apiKey;
    if (key && key.startsWith("sk-") && key !== "YOUR_9ROUTER_KEY_HERE") return key;
  } catch {}
  return "";
}
function toOpenCodeConfig(config) {
  const providers = {};
  const selected = config.provider ? {
    [config.provider]: {
      ...config.apiKeyEnv ? { env: [config.apiKeyEnv] } : {},
      ...config.model ? { models: { [config.model]: { id: config.model, name: config.model } } } : {}
    }
  } : {};
  for (const [id, value] of Object.entries(config.providers ?? {})) {
    const provider = value;
    const models = Object.fromEntries(Object.entries(provider.models ?? {}).map(([modelID, model]) => {
      if (typeof model === "string")
        return [modelID, { id: modelID, name: model }];
      return [
        modelID,
        { id: model.model ?? modelID, name: model.name, ...model.limit ? { limit: model.limit } : {} }
      ];
    }));
    providers[id] = {
      ...provider.apiKeyEnv ? { env: [provider.apiKeyEnv] } : {},
      ...provider.baseURL ? { api: provider.baseURL, options: { baseURL: provider.baseURL, apiKey: (provider.options?.apiKey ?? load9RouterKey()) } } : {},
      ...Object.keys(models).length ? { models } : {}
    };
  }
  const result = { provider: { ...selected, ...providers } };
  const builtinSelected = isBuiltInProvider(config.provider);
  if (config.provider && config.model)
    result.model = `${builtinSelected ? "arena" : config.provider}/${config.model}`;
  if (builtinSelected || config.providers && (("arena" in config.providers) || ("kilo" in config.providers))) {
    const merged = result.provider;
    merged.arena = kiloProviderConfig(builtinSelected ? { apiKeyEnv: config.apiKeyEnv, model: config.model } : undefined, config.providers?.arena ?? config.providers?.kilo);
    delete merged.kilo;
  }
  if (!config.provider && !(config.providers && Object.keys(config.providers).length > 0)) {
    const merged = result.provider;
    merged.arena = kiloProviderConfig();
    result.model = `arena/${KILO_DEFAULT_MODEL}`;
  }
  return result;
}

// src/modes.ts
var ARENA_AGENT_TYPES = ["Battle", "DeepMode", "Side by side", "Direct"];

// src/cli.ts
var __dirname2 = path2.dirname(fileURLToPath(import.meta.url));
var VERSION = "1.0.0-Beta";
var CTCODE_BANNER = `

[38;2;0;240;255m ▄▄▄  ▄▄▄▄  ▄▄▄▄▄ ▄▄  ▄▄  ▄▄▄     ▄▄▄▄  ▄▄▄  ▄▄▄▄  ▄▄▄▄▄[0m
[38;2;0;240;255m██▀██ ██▄█▄ ██▄▄  ███▄██ ██▀██   ██▀▀▀ ██▀██ ██▀██ ██▄▄[0m
[38;2;0;240;255m██▀██ ██ ██ ██▄▄▄ ██ ▀██ ██▀██   ▀████ ▀███▀ ████▀ ██▄▄▄[0m


[38;2;139;92;246mCT-CODE v4080[38;2;95;114;144m · [0m[38;2;57;255;136mCodersTeam[38;2;95;114;144m · [0m[38;2;255;45;149mUNRESTRICTED[38;2;95;114;144m · `;
var HELP = `Arena CLI v${VERSION} — AI coding agent that works inside local repositories.

Usage:
  arena [options] [command] [message...]
  arena "fix the failing tests in src/auth"
  arena --model openrouter/qwen/qwen3-coder "refactor the API layer"

Commands:
  run            run with a message (default)
  battle         blind side-by-side battle between two models
  side-by-side   run one prompt on two named models, show both answers
  leaderboard    show local model Elo rankings
  plugin         manage Arena plugins
  models         list available models
  agent          manage agents
  auth           manage credentials

Options:
  -m, --model <provider/model>  model to use
  --auto                        auto-approve safe actions
  --json                        output JSON for run
  --resume <session>            continue a session
  -v, --version                 show version
  -h, --help                    show this help

Config: ~/.config/arena/config.yaml (override with ARENA_CONFIG).
Docs: https://github.com/k1ruuuu/arena-cli#readme
`;
process.env.ARENA = "1";
process.env.ARENA_VERSION = VERSION;
var projectDirectory = process.cwd();
var rawArgs = process.argv.slice(2);
if (rawArgs.includes("--version") || rawArgs.includes("-v")) {
  process.stdout.write(`${VERSION}
`);
  process.exit(0);
}
if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
  process.stdout.write(HELP);
  process.exit(0);
}
if (!rawArgs.includes("--json") && process.stdout.isTTY) {
  process.stdout.write(CTCODE_BANNER + "\n");
}
var arenaConfig = await loadConfig();
process.env.OPENCODE_CONFIG_CONTENT = JSON.stringify(toOpenCodeConfig(arenaConfig.config));
delete process.env.OPENCODE_CONFIG;
process.env.ARENA_AGENT_TYPES = JSON.stringify(ARENA_AGENT_TYPES);
var args = rawArgs;
var auto = args.includes("--auto");
var json = args.includes("--json");
var resumeIndex = args.indexOf("--resume");
if (resumeIndex >= 0 && (!args[resumeIndex + 1] || args[resumeIndex + 1].startsWith("-"))) {
  console.error("Arena: --resume requires a session ID");
  process.exit(1);
}
var resume = resumeIndex >= 0 ? args[resumeIndex + 1] : undefined;
var filtered = args.filter((arg, index) => {
  if (arg === "--auto" || arg === "--json")
    return false;
  if (resumeIndex >= 0 && (index === resumeIndex || index === resumeIndex + 1))
    return false;
  return true;
});
var modelIndex = filtered.findIndex((arg) => arg === "--model" || arg === "-m");
var inlineModelIndex = filtered.findIndex((arg) => arg.startsWith("--model="));
var model = modelIndex >= 0 ? filtered[modelIndex + 1] : inlineModelIndex >= 0 ? filtered[inlineModelIndex].slice(8) : undefined;
if (modelIndex >= 0 && (!model || model.startsWith("-")) || inlineModelIndex >= 0 && !model) {
  console.error("Arena: --model requires a model ID");
  process.exit(1);
}
var [requestedProvider, requestedModel] = model?.includes("/") ? model.split(/\/(.+)/) : ["ollama", model];
if (requestedProvider === "ollama" && (requestedModel === "kilo" || requestedModel === "arena")) {
  requestedProvider = "arena";
  requestedModel = undefined;
}
var localProvider = requestedProvider === "ollama" || requestedProvider === "lmstudio" ? requestedProvider : undefined;
var bareModel = localProvider ? requestedModel : undefined;
if (localProvider && bareModel) {
  const currentConfig = toOpenCodeConfig(arenaConfig.config);
  currentConfig.model = `${localProvider}/${bareModel}`;
  currentConfig.provider = {
    ...currentConfig.provider ?? {},
    [localProvider]: {
      ...currentConfig.provider?.[localProvider] ?? {},
      name: localProvider === "ollama" ? "Ollama" : "LM Studio",
      api: currentConfig.provider?.[localProvider]?.api ?? (localProvider === "ollama" ? "http://127.0.0.1:11434/v1" : "http://127.0.0.1:1234/v1"),
      env: currentConfig.provider?.[localProvider]?.env ?? [],
      models: {
        ...currentConfig.provider?.[localProvider]?.models ?? {},
        [bareModel]: {
          id: bareModel,
          name: bareModel,
          tool_call: true,
          reasoning: true,
          temperature: true,
          attachment: false,
          modalities: { input: ["text"], output: ["text"] },
          cost: { input: 0, output: 0 },
          limit: { context: 32768, output: 8192 }
        }
      }
    }
  };
  process.env.OPENCODE_CONFIG_CONTENT = JSON.stringify(currentConfig);
  if (modelIndex >= 0)
    filtered[modelIndex + 1] = `${localProvider}/${bareModel}`;
  if (inlineModelIndex >= 0)
    filtered[inlineModelIndex] = `--model=${localProvider}/${bareModel}`;
}
if (isBuiltInProvider(requestedProvider)) {
  const builtinModel = requestedModel || KILO_DEFAULT_MODEL;
  const currentConfig = toOpenCodeConfig({ ...arenaConfig.config, provider: "arena", model: builtinModel });
  currentConfig.model = `arena/${builtinModel}`;
  process.env.OPENCODE_CONFIG_CONTENT = JSON.stringify(currentConfig);
  if (modelIndex >= 0)
    filtered[modelIndex + 1] = `arena/${builtinModel}`;
  if (inlineModelIndex >= 0)
    filtered[inlineModelIndex] = `--model=arena/${builtinModel}`;
}
var SUBCOMMANDS = new Set([
  "run",
  "models",
  "agent",
  "auth",
  "acp",
  "mcp",
  "serve",
  "web",
  "stats",
  "export",
  "import",
  "github",
  "pr",
  "session",
  "upgrade",
  "uninstall",
  "completion",
  "debug",
  "attach",
  "battle",
  "leaderboard",
  "plugin",
  "side-by-side"
]);
var valueOptions = new Set([
  "--model",
  "-m",
  "--agent",
  "--format",
  "--file",
  "-f",
  "--title",
  "--attach",
  "--port",
  "--variant",
  "--command"
]);
var hasMessage = false;
var afterSeparator = false;
for (let index = 0;index < filtered.length; index++) {
  const arg = filtered[index];
  if (afterSeparator) {
    hasMessage = true;
    break;
  }
  if (arg === "--") {
    afterSeparator = true;
    continue;
  }
  if (valueOptions.has(arg)) {
    index++;
    continue;
  }
  if (arg.startsWith("--") && arg.includes("="))
    continue;
  if (!arg.startsWith("-")) {
    if (SUBCOMMANDS.has(arg))
      break;
    hasMessage = true;
    break;
  }
}
var command = ["run"];
if (json)
  command.push("--format", "json");
if (resume)
  command.push("--session", resume);
if (auto) {
  process.env.OPENCODE_PERMISSION = JSON.stringify({
    "*": "allow",
    read: { "*.env": "deny", "*.env.*": "deny", "*.env.local": "deny" },
    bash: {
      "git commit*": "deny",
      "*git commit*": "deny",
      "*git*commit*": "deny",
      "git push*": "deny",
      "*git push*": "deny",
      "*git*push*": "deny",
      "git reset --hard*": "deny",
      "*git reset --hard*": "deny",
      "*git*reset --hard*": "deny",
      "git clean*": "deny",
      "*git clean*": "deny",
      "git checkout --*": "deny",
      "*git checkout --*": "deny",
      "git restore*": "deny",
      "*git restore*": "deny"
    }
  });
}
var forwarded = hasMessage ? command.concat(filtered) : resume ? ["--session", resume, ...filtered] : filtered;
function platformSlug() {
  const os2 = process.platform === "win32" ? "win32" : process.platform;
  const arch = process.arch === "x64" ? "x64" : process.arch === "arm64" ? "arm64" : null;
  if (os2 !== "linux" && os2 !== "darwin" && os2 !== "win32" || !arch)
    return null;
  return `${os2}-${arch}`;
}
function binaryName() {
  return process.platform === "win32" ? "arena.exe" : "arena";
}
function findBun() {
  if (process.env.BUN)
    return process.env.BUN;
  if (process.execPath.endsWith("/bun") || process.execPath.endsWith("\\bun.exe"))
    return process.execPath;
  try {
    const which = childProcess.spawnSync("which", ["bun"], { encoding: "utf8" });
    if (which.status === 0 && which.stdout.trim())
      return which.stdout.trim();
  } catch {}
  return null;
}
function trySpawn(cmd, spawnArgs, opts) {
  const result = childProcess.spawnSync(cmd, spawnArgs, { stdio: "inherit", ...opts });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  process.exit(typeof result.status === "number" ? result.status : 1);
}
var explicitBin = process.env.ARENA_BIN_PATH ?? process.env.OPENCODE_BIN_PATH;
if (explicitBin && fs2.existsSync(explicitBin)) {
  trySpawn(explicitBin, forwarded, { env: process.env });
}
var slug = platformSlug();
if (slug) {
  try {
    const pkgPath = createRequire2(import.meta.url).resolve(`@pawbxj/arena-cli-${slug}/package.json`);
    const candidate = path2.join(path2.dirname(pkgPath), "bin", binaryName());
    if (fs2.existsSync(candidate)) {
      trySpawn(candidate, forwarded, { env: process.env });
    }
  } catch {}
}
var siblingBin = path2.join(__dirname2, binaryName());
if (fs2.existsSync(siblingBin)) {
  trySpawn(siblingBin, forwarded, { env: process.env });
}
var sourceCheckout = path2.join(__dirname2, "../packages/opencode/src/index.ts");
var opencodeDir = path2.join(__dirname2, "../packages/opencode");
var useSourceCheckout = false;
if (fs2.existsSync(sourceCheckout)) {
  try {
    createRequire2(path2.join(opencodeDir, "package.json")).resolve("yargs");
    useSourceCheckout = true;
  } catch {}
}
if (useSourceCheckout) {
  const bun = findBun();
  if (bun) {
    trySpawn(bun, ["run", "--conditions=browser", sourceCheckout, ...forwarded], {
      cwd: opencodeDir,
      env: { ...process.env, ARENA_CWD: projectDirectory }
    });
  }
}
console.error(`arena: could not find the Arena runtime.

` + `The installed package is missing its runtime binary. Reinstall to repair it:
` + `  npm install -g @pawbxj/arena-cli@latest
` + `or with Bun:
` + `  bun install -g @pawbxj/arena-cli@latest

` + `Advanced overrides:
` + `  ARENA_BIN_PATH=/path/to/arena-binary arena ...
` + "  (development) run from the arena-cli checkout with bun installed.");
process.exit(1);
