#!/usr/bin/env node
// arena-agent — the arena.ai AGENT MODE thinking, self-hosted
// one TASK → N full agents race on it in isolated copies of your project
// → a judge compares the executions → winner declared, workdirs kept.
//
//   node arena-agent.mjs "build a snake game in ./game" --agents 3
//   node arena-agent.mjs "fix the failing test" --agents 2 --cwd ./myproj
//   node arena-agent.mjs --list
//
// every agent runs `opencode run` (real tool use: reads, writes, bash),
// each in its own snapshot copy of the project. the judge gets the task +
// a diff of what each agent actually did, and picks the winner.

import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const VERSION = "1.0.0";
const PORT = Number(process.env.ARENA_PORT || 20129);
const UPSTREAM = (process.env.ARENA_UPSTREAM || "http://localhost:20128").replace(/\/$/, "");
const JUDGE_MODEL = process.env.ARENA_JUDGE || "my9model-smart";

const FIGHTERS = (process.env.ARENA_FIGHTERS ||
  "oc/big-pickle,oc/nemotron-3-ultra-free,oc/mimo-v2.5-free,my9model-smart,opencode-free")
  .split(",").map(s => s.trim()).filter(Boolean);

function findKey() {
  if (process.env.ARENA_KEY) return process.env.ARENA_KEY;
  for (const p of [
    path.join(os.homedir(), ".config/opencode/opencode.json"),
    path.join(os.homedir(), ".config/opencode/opencode.jsonc"),
  ]) {
    try {
      const raw = fs.readFileSync(p, "utf8")
        .replace(/"(?:[^"\\\n\r]|\\.)*"|\/\/.*$|\/\*[\s\S]*?\*\//g, m => m.startsWith('"') ? m : " ".repeat(m.length))
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
      const j = JSON.parse(raw);
      const k = j?.provider?.ct002?.options?.apiKey || j?.provider?.["9router"]?.options?.apiKey;
      if (k && k.startsWith("sk-")) return k;
    } catch {}
  }
  return "";
}
const KEY = findKey();

// ---------------- args ----------------
const args = process.argv.slice(2);
if (args.includes("--version") || args.includes("-v")) { console.log("arena-agent " + VERSION); process.exit(0); }
if (args.includes("--list")) {
  console.log("agents:"); FIGHTERS.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  console.log("judge:  " + JUDGE_MODEL); process.exit(0);
}

function argValue(flag, def) {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}
const flagVals = new Set();
for (const f of ["--agents", "--cwd", "--timeout"]) {
  const i = args.indexOf(f);
  if (i >= 0 && args[i + 1]) flagVals.add(args[i + 1]);
}
const task = args.filter(a => !a.startsWith("--") && !flagVals.has(a)).join(" ").trim();
const N = Math.max(1, Math.min(FIGHTERS.length, Number(argValue("--agents", "3"))));
const CWD = path.resolve(argValue("--cwd", process.cwd()));
const TIMEOUT = Number(argValue("--timeout", "900")) * 1000;

if (!task) {
  console.error(`arena-agent ${VERSION} — task-level arena: N agents race on one task

usage:
  node arena-agent.mjs "<task>" [--agents N] [--cwd ./project] [--timeout 900]

env:
  ARENA_FIGHTERS="m1,m2,m3"   agent roster     (default: 5 free models)
  ARENA_JUDGE=model           judge            (default: my9model-smart)
  ARENA_KEY=sk-...            router key       (auto-read from opencode config)`);
  process.exit(1);
}

// ---------------- helpers ----------------
function sh(cmd, opts = {}) {
  return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts });
}

function snapshot() {
  // race dirs live under $HOME — opencode's glob picks candidates across the
  // tree and /tmp paths confuse its root sniffing in some setups
  const root = path.join(os.homedir(), ".arena-agent");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dir = path.join(root, `race-${stamp}-${Math.random().toString(36).slice(2, 6)}`);
  fs.mkdirSync(dir, { recursive: true });
  try {
    sh(`cp -a "${CWD}/." "${dir}/" 2>/dev/null || true`, { shell: "/bin/bash" });
    sh(`rm -rf "${dir}/node_modules" 2>/dev/null || true`, { shell: "/bin/bash" });
  } catch {}
  // opencode anchors its project root on .git — without it, it runs against
  // the wrong tree. seed a git repo so every agent is locked to its workdir.
  try {
    sh(`cd "${dir}" && git init -q && git add -A && git -c user.email=arena@local -c user.name=arena commit -qm "arena snapshot"`, { shell: "/bin/bash" });
  } catch {}
  return dir;
}

function diffDir(a, b) {
  try {
    const d = sh(`diff -rq "${a}" "${b}" 2>/dev/null | head -40`, { shell: "/bin/bash" });
    return d.trim() || "(no changes)";
  } catch { return "(diff failed)"; }
}

function dirSummary(dir) {
  try {
    const files = sh(`find "${dir}" -type f -not -path "*/node_modules/*" -not -path "*/.git/*" | head -30`, { shell: "/bin/bash" })
      .trim().split("\n").filter(Boolean);
    return files.map(f => path.relative(dir, f)).join("\n") || "(empty)";
  } catch { return "(unreadable)"; }
}

function callModel(model, messages, maxTokens) {
  return fetch(`${UPSTREAM}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(KEY ? { Authorization: `Bearer ${KEY}` } : {}) },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens ?? 1500 }),
    signal: AbortSignal.timeout(120_000),
  }).then(r => r.json())
    .then(j => j?.choices?.[0]?.message?.content || "")
    .catch(() => "");
}

const LETTERS = ["A", "B", "C", "D", "E"];

// ---------------- one agent run ----------------
function runAgent(idx, model, workdir) {
  return new Promise(resolve => {
    const t0 = Date.now();
    // fresh session each race (no history bleed) — and per-agent project config
    // is inherited from ~/.config/opencode automatically
    const agentTag = `ARENA-${LETTERS[idx] ?? "X"}`;
    const fullTask = `[${agentTag}] You are competing in an arena against other AI agents. Your project directory for ALL work is EXACTLY this directory — never look for or edit files elsewhere. You MUST make real file edits with your edit tools before finishing, and verify them. Do not stop before the task is actually done.

TASK: ${task}`;
    const child = spawn("opencode", ["run", "-m", `ct002/${model}`, fullTask], {
      cwd: workdir,
      // opencode resolves its project root from $PWD, not the process cwd —
      // without this every agent lands in $HOME and edits the wrong tree
      env: { ...process.env, PWD: workdir, ARENA_AGENT_ID: `agent-${idx}` },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "", killed = false;
    const timer = setTimeout(() => { killed = true; child.kill("SIGKILL"); }, TIMEOUT);
    child.stdout.on("data", c => { out += c; if (out.length > 400_000) out = out.slice(-200_000); });
    child.stderr.on("data", c => { out += c; });
    child.on("close", code => {
      clearTimeout(timer);
      resolve({
        idx, model, workdir, ms: Date.now() - t0,
        ok: !killed && code === 0,
        killed, exit: code,
        tail: out.slice(-3000),
        edits: sh(`cd "${workdir}" && git add -A 2>/dev/null; git diff --name-only HEAD 2>/dev/null | head -20 || true`, { shell: "/bin/bash" }).trim() || "(none)",
        files: dirSummary(workdir),
      });
    });
  });
}

// ---------------- judge ----------------

async function judge(results) {
  const dossier = results.map((r, i) => [
    `--- Agent ${LETTERS[i]} (${r.model}) ${r.ok ? "finished" : "FAILED/timeout"} in ${(r.ms / 1000).toFixed(0)}s ---`,
    `files it actually modified/created:`,
    r.edits,
    ``,
    `final output tail:`,
    r.tail.slice(0, 1500),
  ].join("\n")).join("\n\n");

  const prompt = `You are the ARENA JUDGE. ${results.length} autonomous agents independently worked on this task:

TASK: ${task}

Below: the files each agent ACTUALLY modified (verified from the filesystem) and the tail of its run output.
An agent that modified nothing likely failed the task — weight real file changes heavily.

${dossier}

Judge on: (1) did it actually accomplish the task, (2) quality/completeness of the work, (3) did it verify its own work.
Pick exactly one winner. Reply ONLY with JSON:
{"winner":"A","reason":"one short sentence","ranking":["A","B"]}`;

  const raw = await callModel(JUDGE_MODEL, [
    { role: "system", content: "You are a strict, impartial judge of agent executions. Output only JSON." },
    { role: "user", content: prompt },
  ], 400);
  const m = raw.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      const j = JSON.parse(m[0]);
      if (typeof j.winner === "string") return j;
    } catch {}
  }
  return { winner: LETTERS[0], reason: "judge unparseable — defaulting to first finisher", ranking: LETTERS.slice(0, results.length) };
}

// ---------------- main ----------------
console.log(`⚔️  arena-agent v${VERSION} — ${N} agents racing`);
console.log(`    task:  ${task.slice(0, 100)}${task.length > 100 ? "…" : ""}`);
console.log(`    cwd:   ${CWD}`);
console.log(`    agents:`);
const roster = FIGHTERS.slice(0, N);
roster.forEach((m, i) => console.log(`      ${LETTERS[i]}) ${m}`));

const base = snapshot();
console.log(`\n  snapshot: ${base}\n`);

const t0 = Date.now();
const results = await Promise.all(roster.map((m, i) => {
  const dir = snapshot();
  console.log(`  ▶ agent ${LETTERS[i]} (${m}) starting…`);
  return runAgent(i, m, dir);
}));

console.log(`\n── race over (${((Date.now() - t0) / 1000).toFixed(0)}s) ──`);
results.forEach(r => console.log(`  ${LETTERS[r.idx]}) ${r.model}: ${r.ok ? "finished" : r.killed ? "TIMEOUT" : "exit " + r.exit} in ${(r.ms / 1000).toFixed(0)}s`));

const alive = results.filter(r => r.ok);
const contenders = alive.length ? alive : results;
const verdict = await judge(contenders);
const winIdx = Math.max(0, contenders.findIndex((_, i) => LETTERS[i] === verdict.winner.trim().toUpperCase()));
const winner = contenders[winIdx];

console.log(`\n🏆 WINNER: ${LETTERS[winner.idx]}) ${winner.model}`);
console.log(`   ${verdict.reason}`);
if (verdict.ranking) console.log(`   ranking: ${verdict.ranking.join(" > ")}`);
console.log(`\n   workdir: ${winner.workdir}`);

// write the report next to the winner's workdir
const report = { task, at: new Date().toISOString(), winner: winner.model, reason: verdict.reason, ranking: verdict.ranking, agents: results.map(r => ({ agent: LETTERS[r.idx], model: r.model, ok: r.ok, ms: r.ms, workdir: r.workdir, edits: r.edits })) };
fs.writeFileSync(path.join(os.tmpdir(), "arena-agent-report.json"), JSON.stringify(report, null, 2));
console.log(`   report:  ${path.join(os.tmpdir(), "arena-agent-report.json")}`);
console.log(`\n   diff vs original:`);
console.log(diffDir(CWD, winner.workdir).split("\n").map(l => "     " + l).join("\n"));
console.log(`\n   to adopt:  cp -a "${winner.workdir}/." "${CWD}/"`);
