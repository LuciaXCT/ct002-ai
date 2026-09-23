#!/usr/bin/env node
// arena-tui — the arena.ai experience, in your terminal
// one prompt → TWO anonymous models answer side by side, LIVE
// you vote → names revealed → ELO leaderboard updated
//
//   ct002-arena                    interactive (asks for a prompt)
//   ct002-arena "your prompt"      instant chat battle
//   ct002-arena -t "task"          AGENT battle — both agents do real work, vote adopts the winner
//   ct002-arena --cwd ./proj -t "fix the bug"
//   ct002-arena board              ELO standings
//   ct002-arena models             the roster
//
// keys during a battle:  A / B / T(tie) / S(both bad) / R(peek, no elo)

import { execSync, spawnSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";

const VERSION = "1.0.0";
const UPSTREAM = (process.env.ARENA_UPSTREAM || "http://localhost:20128").replace(/\/$/, "");
const ELO_FILE = path.join(os.homedir(), ".arena", "elo.json");
const WORKROOT = path.join(os.homedir(), ".arena", "work");

const ROSTER = (process.env.ARENA_FIGHTERS ||
  "oc/big-pickle,oc/nemotron-3-ultra-free,oc/mimo-v2.5-free,my9model-smart,opencode-free")
  .split(",").map(s => s.trim()).filter(Boolean);

function pickModel() {
  const env = process.env.CT002_BRAIN_MODEL;
  if (env) return env;
  const j = process.env.ARENA_JUDGE;
  if (j) return j;
  return ROSTER.includes("my9model-smart") ? "my9model-smart" : ROSTER[0];
}

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

function loadPersona() {
  try { return fs.readFileSync(path.join(os.homedir(), ".config/opencode/persona.md"), "utf8").slice(0, 6000); } catch { return ""; }
}

// ---------------- args ----------------
const argv = process.argv.slice(2);
if (argv.includes("--version") || argv.includes("-v")) { console.log("arena-tui " + VERSION); process.exit(0); }
// --auto: embedded mode (deck inside opencode) — stdin is NOT ours, so skip
// interactive voting and let a judge model pick the winner
const AUTO = argv.includes("--auto");
if (AUTO) { process.env.ARENA_AUTO = "1"; }

const TASK_MODE = argv.includes("-t") || argv.includes("--task");
const cwdIdx = argv.indexOf("--cwd");
const CWD = cwdIdx >= 0 && argv[cwdIdx + 1] ? path.resolve(argv[cwdIdx + 1]) : process.cwd();
const prompt = argv.filter((a, i) =>
  !a.startsWith("-") && !(i > 0 && argv[i - 1] === "--cwd")).join(" ").trim();

if (argv.includes("models")) {
  console.log("the roster (who fights is picked at random, blind):");
  ROSTER.forEach((m, i) => console.log(`  ${i + 1}. ${m}`));
  process.exit(0);
}

// ---------------- elo ----------------
function loadElo() {
  try { return JSON.parse(fs.readFileSync(ELO_FILE, "utf8")); } catch { return {}; }
}
function saveElo(e) {
  fs.mkdirSync(path.dirname(ELO_FILE), { recursive: true });
  fs.writeFileSync(ELO_FILE, JSON.stringify(e, null, 2));
}
function eloOf(e, m) { return e[m]?.elo ?? 1200; }
function applyResult(mA, mB, scoreA) {
  const e = loadElo();
  for (const m of [mA, mB]) if (!e[m]) e[m] = { elo: 1200, w: 0, l: 0, t: 0 };
  const ra = eloOf(e, mA), rb = eloOf(e, mB);
  const ea = 1 / (1 + Math.pow(10, (rb - ra) / 400));
  const K = 32;
  const na = Math.round(ra + K * (scoreA - ea));
  const nb = Math.round(rb + K * ((1 - scoreA) - (1 - ea)));
  e[mA].elo = na; e[mB].elo = nb;
  if (scoreA === 1) { e[mA].w++; e[mB].l++; }
  else if (scoreA === 0) { e[mB].w++; e[mA].l++; }
  else { e[mA].t++; e[mB].t++; }
  saveElo(e);
  return { a: na - ra, b: nb - rb };
}

if (argv.includes("board")) {
  const e = loadElo();
  const rows = Object.entries(e).sort((x, y) => y[1].elo - x[1].elo);
  if (!rows.length) { console.log("no battles yet — run one first"); process.exit(0); }
  console.log("⚔  ARENA LEADERBOARD");
  for (const [m, s] of rows) {
    console.log(`  ${String(s.elo).padStart(4)}  ${m.padEnd(30)} ${s.w}W ${s.l}L ${s.t}T`);
  }
  process.exit(0);
}

// ---------------- ansi ----------------
const CLR = "\x1b[2J\x1b[H", DIM = "\x1b[90m", BOLD = "\x1b[1m", CYN = "\x1b[36m",
  GRN = "\x1b[32m", YLW = "\x1b[33m", RED = "\x1b[31m", RST = "\x1b[0m";
const stripAnsi = s => s.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");

function wrap(text, width) {
  const out = [];
  for (const raw of stripAnsi(text).split("\n")) {
    if (raw.length <= width) { out.push(raw); continue; }
    let line = "";
    for (const word of raw.split(" ")) {
      if ((line + (line ? " " : "") + word).length > width) {
        if (line) out.push(line);
        line = word.slice(0, width);
        while (line.length === width && word.length > width) {
          out.push(line);
          word = word.slice(width);
          line = word.slice(0, width);
        }
      } else line += (line ? " " : "") + word;
    }
    if (line) out.push(line);
  }
  return out;
}

// ---------------- streaming from the router ----------------
async function streamChat(model, messages, onDelta, timeoutMs = 180_000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    const r = await fetch(`${UPSTREAM}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(KEY ? { Authorization: `Bearer ${KEY}` } : {}) },
      body: JSON.stringify({ model, messages, stream: true, max_tokens: 2048 }),
      signal: ctrl.signal,
    });
    if (!r.ok || !r.body) throw new Error(`http ${r.status}`);
    const dec = new TextDecoder();
    let buf = "", full = "";
    for await (const chunk of r.body) {
      buf += dec.decode(chunk, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop();
      for (const line of lines) {
        const s = line.trim();
        if (!s.startsWith("data:")) continue;
        const payload = s.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content;
          if (delta) { full += delta; onDelta?.(delta); }
        } catch {}
      }
    }
    if (!full.trim()) throw new Error("empty stream");
    return { text: full, ms: Date.now() - t0, err: null };
  } catch (e) {
    // fallback: non-stream
    try {
      const r = await fetch(`${UPSTREAM}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(KEY ? { Authorization: `Bearer ${KEY}` } : {}) },
        body: JSON.stringify({ model, messages, max_tokens: 2048 }),
        signal: AbortSignal.timeout(120_000),
      });
      const j = await r.json();
      const text = j?.choices?.[0]?.message?.content || "";
      if (!text.trim()) throw new Error("empty");
      onDelta?.(text);
      return { text, ms: Date.now() - t0, err: null };
    } catch (e2) {
      return { text: "", ms: Date.now() - t0, err: String(e?.message || e2?.message || "failed") };
    }
  } finally { clearTimeout(t); }
}

// ---------------- agent battle pieces ----------------
function sh(cmd, opts = {}) { return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: "/bin/bash", ...opts }); }

function snapshot() {
  fs.mkdirSync(WORKROOT, { recursive: true });
  const dir = path.join(WORKROOT, `battle-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`);
  fs.mkdirSync(dir, { recursive: true });
  try {
    sh(`cp -a "${CWD}/." "${dir}/"`);
    sh(`rm -rf "${dir}/node_modules"`);
    sh(`cd "${dir}" && git init -q && git add -A && git -c user.email=arena@local -c user.name=arena commit -qm "arena snapshot"`);
  } catch {}
  return dir;
}

function gitStat(dir) {
  try {
    return sh(`cd "${dir}" && git add -A && git diff --cached --stat HEAD | tail -5`).trim() || "(no changes)";
  } catch { return "(diff failed)"; }
}

function adopt(winnerDir) {
  try {
    sh(`(cd "${winnerDir}" && tar --exclude=.git -cf - .) | (cd "${CWD}" && tar -xf -)`);
    return true;
  } catch { return false; }
}

function agentRun(model, task, dir, onDelta) {
  return new Promise(resolve => {
    const full = `[ARENA] You are competing against another AI agent. Your directory is EXACTLY ${dir} — never edit files elsewhere. Make real edits, verify, finish the task.

TASK: ${task}`;
    const child = spawn("opencode", ["run", "-m", `ct002/${model}`, full], {
      cwd: dir, env: { ...process.env, PWD: dir }, stdio: ["ignore", "pipe", "pipe"],
    });
    const t0 = Date.now();
    let out = "", killed = false;
    const idx = agentRun.n ?? 0; agentRun.n = (idx + 1) % 2;
    const act = s => {
      const m = s.match(/(Read|Edit|Write|Bash|Glob|Grep|Task|fetch)[^\n]{0,40}/i);
      if (m) T.lastAct[idx] = m[1].slice(0, 44);
    };
    const timer = setTimeout(() => { killed = true; child.kill("SIGKILL"); }, 900_000);
    child.stdout.on("data", c => { const s = stripAnsi(c.toString()); out += s; act(s); onDelta?.(s); });
    child.stderr.on("data", c => { const s = stripAnsi(c.toString()); out += s; act(s); onDelta?.(s); });
    child.on("close", code => {
      clearTimeout(timer);
      T.lastAct[idx] = code === 0 ? "finished" : killed ? "timeout" : `exit ${code}`;
      resolve({ ok: !killed && code === 0, ms: Date.now() - t0, tail: out.slice(-800) });
    });
  });
}

// ---------------- renderer ----------------
const T = {
  phase: "idle",          // idle | streaming | voting | done
  pair: ["", ""],
  sides: [null, null],    // {buf, done, ms, err, extra}
  layout: "split",
  lastFrame: "",
  resultLine: "",
  liveMs: [0, 0],         // ticking clock per side while agents grind
  lastAct: ["", ""],      // last meaningful activity line per side
};
const IS_TTY = process.stdout.isTTY && process.stdin.isTTY;

function panelRects(cols, rows) {
  const headerH = 2, footerH = 5;
  const h = Math.max(6, rows - headerH - footerH);
  if (T.layout === "split" && cols >= 50) {
    const w = Math.floor((cols - 1) / 2);
    return [{ x: 0, y: headerH, w, h }, { x: w + 1, y: headerH, w: cols - w - 1, h }];
  }
  const hh = Math.floor(h / 2);
  return [{ x: 0, y: headerH, w: cols, h: hh }, { x: 0, y: headerH + hh + 1, w: cols, h: hh }];
}

function drawBox(scr, r, title, bodyLines, color) {
  const { x, y, w, h } = r;
  const top = `┌─ ${title} `.padEnd(w - 1, "─") + "┐";
  const bot = "└" + "─".repeat(w - 2) + "┘";
  scr[y] = put(scr[y], x, top, color);
  const lines = bodyLines.slice(-Math.max(1, h - 2));
  for (let i = 0; i < h - 2; i++) {
    const text = lines[i] ?? "";
    scr[y + 1 + i] = put(scr[y + 1 + i], x, "│ " + text.padEnd(w - 4).slice(0, w - 4) + " │", null);
  }
  scr[y + h - 1] = put(scr[y + h - 1], x, bot, color);
}
function put(row, x, s, color) {
  row = row || "";
  const arr = row.split("");
  while (arr.length < x) arr.push(" ");
  const painted = color ? color + s + DIM : s;
  for (let i = 0; i < s.length; i++) arr[x + i] = painted[i] === undefined ? " " : (i === 0 ? painted : s[i]);
  // simpler: paint whole segment
  return row.slice(0, x).padEnd(x, " ") + painted + "";
}
// NOTE: put() paints the box chars as one colored run — good enough and fast.

function frame() {
  if (!IS_TTY) return;
  const cols = process.stdout.columns || 80;
  const rows = process.stdout.rows || 24;
  const scr = new Array(rows).fill("");
  scr[0] = `${BOLD}⚔  ARENA${RST}  ${DIM}blind battle — the models stay hidden until you vote${RST}`;
  scr[1] = DIM + "─".repeat(cols) + RST;
  const rects = panelRects(cols, rows);
  for (let i = 0; i < 2; i++) {
    const s = T.sides[i] || { buf: "", done: false };
    const body = wrap(s.buf || "…", rects[i].w - 4);
    const secs = T.sides[i]?.ms ? (T.sides[i].ms / 1000).toFixed(0) + "s" : ((T.liveMs[i] || 0) / 1000).toFixed(0) + "s";
    const act = T.lastAct[i] ? ` · ${T.lastAct[i]}` : "";
    const title = ` ${String.fromCharCode(65 + i)} · ${secs}${T.sides[i]?.done ? " · done" : act}`;
    drawBox(scr, rects[i], title, body, T.sides[i]?.err ? RED : DIM);
  }
  const foot = [];
  if (T.phase === "streaming") foot.push(`${CYN}both models answering… wait for the vote${RST}`);
  if (T.phase === "voting") foot.push(`${YLW}${BOLD}YOUR VOTE:${RST}  ${BOLD}A${RST} A wins · ${BOLD}B${RST} B wins · ${BOLD}T${RST} tie · ${BOLD}S${RST} both bad · ${BOLD}R${RST} peek`);
  if (T.phase === "done") foot.push(T.resultLine);
  foot.push(DIM + "─".repeat(Math.min(cols, 60)) + RST);
  for (let i = 0; i < foot.length && rows - foot.length + i < rows; i++) {
    scr[rows - foot.length + i] = foot[i].slice(0, cols);
  }
  const out = CLR + scr.join("\n") + "\n";
  process.stdout.write(out);
  T.lastFrame = out;
}

let renderTimer = null;
function scheduleRender() {
  if (!IS_TTY || renderTimer) return;
  renderTimer = setTimeout(() => { renderTimer = null; frame(); }, 80);
}
// heartbeat: clocks tick + panels repaint even with zero output (long agent thinks)
setInterval(() => {
  if (!IS_TTY) return;
  if (T.phase === "streaming") {
    for (let i = 0; i < 2; i++) if (!T.sides[i]?.done) T.liveMs[i] += 1000;
    frame();
  }
}, 1000);

function printPipe() {
  // non-tty fallback: sequential, readable
  for (let i = 0; i < 2; i++) {
    const s = T.sides[i] || {};
    console.log(`\n===== ${String.fromCharCode(65 + i)} =====`);
    console.log(s.err ? `✗ ${s.err}` : (s.buf || "(empty)"));
  }
}

// ---------------- input ----------------
function rawKey() {
  return new Promise(resolve => {
    const wasRaw = process.stdin.isRaw;
    process.stdin.setRawMode(true);
    process.stdin.resume();
    const onData = d => {
      const ch = d.toString();
      process.stdin.setRawMode(wasRaw);
      process.stdin.removeListener("data", onData);
      process.stdin.pause();
      if (ch === "\x03") { console.log(); process.exit(0); }
      resolve(ch.toLowerCase());
    };
    process.stdin.on("data", onData);
  });
}
function askLine(q) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(q, a => { rl.close(); resolve(a.trim()); });
  });
}

async function judgeVote() {
  // embedded: no keyboard — ask a judge model to pick
  const jmodel = pickModel();
  const body = `Two anonymous answers to the same prompt. Reply with EXACTLY one letter: A, B, or T (tie).

[A]:
${(T.sides[0]?.buf || "(failed)").slice(-1500)}

[B]:
${(T.sides[1]?.buf || "(failed)").slice(-1500)}`;
  const r = await streamChat(jmodel, [{ role: "user", content: body }], null, 60_000).catch(() => null);
  const v = (r?.text || "").trim().toUpperCase()[0];
  return "ABT".includes(v) ? v.toLowerCase() : "t";
}

async function getVote() {
  if (AUTO) return judgeVote();
  if (!IS_TTY) {
    const a = await askLine("your vote [A/B/T/S/R]: ");
    return (a[0] || "t").toLowerCase();
  }
  T.phase = "voting"; frame();
  return rawKey();
}

// ---------------- one chat battle ----------------
async function chatBattle(userPrompt) {
  const pool = [...ROSTER].sort(() => Math.random() - 0.5);
  T.pair = [pool[0], pool[1]];
  T.sides = [
    { buf: "", done: false, ms: 0, err: null },
    { buf: "", done: false, ms: 0, err: null },
  ];
  T.phase = "streaming"; T.resultLine = "";
  const persona = loadPersona();
  const messages = [
    ...(persona ? [{ role: "system", content: persona }] : []),
    { role: "user", content: userPrompt },
  ];
  if (IS_TTY) frame();
  const jobs = [0, 1].map(i =>
    streamChat(T.pair[i], messages, d => {
      T.sides[i].buf += d;
      if (T.sides[i].buf.length > 9000) T.sides[i].buf = T.sides[i].buf.slice(-6000);
      scheduleRender();
    }).then(r => {
      T.sides[i] = { ...T.sides[i], done: true, ms: r.ms, err: r.err, buf: r.err ? T.sides[i].buf : r.text.slice(-9000) };
      scheduleRender();
    })
  );
  await Promise.all(jobs);

  if (T.sides[0].err && T.sides[1].err) {
    T.phase = "done";
    T.resultLine = `${RED}both fighters failed: ${T.sides[0].err} / ${T.sides[1].err}${RST}`;
    if (IS_TTY) frame(); else printPipe();
    return;
  }

  const vote = await getVote();
  let line = "";
  if (vote === "r") {
    line = `${DIM}peek — no elo change${RST}  A = ${T.pair[0]} · B = ${T.pair[1]}`;
  } else if ("abts".includes(vote)) {
    const scoreA = vote === "a" ? 1 : vote === "b" ? 0 : 0.5;
    const d = applyResult(T.pair[0], T.pair[1], scoreA);
    const w = vote === "a" ? T.pair[0] : vote === "b" ? T.pair[1] : null;
    line = vote === "t"
      ? `${YLW}TIE${RST} — A = ${GRN}${T.pair[0]}${RST} (${d.a >= 0 ? "+" : ""}${d.a}) · B = ${GRN}${T.pair[1]}${RST} (${d.b >= 0 ? "+" : ""}${d.b})`
      : `${GRN}🏆 WINNER: ${w}${RST}  (A was ${T.pair[0]}, B was ${T.pair[1]})  elo ${vote === "a" ? "+" + d.a : d.b}`;
  } else line = `${DIM}no vote recorded${RST} — A = ${T.pair[0]} · B = ${T.pair[1]}`;

  T.phase = "done"; T.resultLine = line;
  if (IS_TTY) frame(); else { printPipe(); console.log("\n" + stripAnsi(line)); }
}

// ---------------- one agent battle ----------------
async function agentBattle(task) {
  const pool = [...ROSTER].sort(() => Math.random() - 0.5);
  T.pair = [pool[0], pool[1]];
  const dirs = [snapshot(), snapshot()];
  T.sides = [
    { buf: "working…", done: false, ms: 0, err: null },
    { buf: "working…", done: false, ms: 0, err: null },
  ];
  T.phase = "streaming"; T.resultLine = "";
  if (IS_TTY) frame(); else console.log(`task: ${task}\ncwd:  ${CWD}\n`);

  // esc aborts the whole race — kills both agents, no adoption, no elo
  const abortRace = new AbortController();
  const watchEsc = (async () => {
    if (!process.stdin.isTTY || process.stdin.readable === false) return;
    process.stdin.setRawMode(true); process.stdin.resume();
    for (;;) {
      const ch = await new Promise(res => { const f = d => { process.stdin.removeListener("data", f); res(d.toString()); }; process.stdin.on("data", f); });
      if (ch === "\x1b" || ch === "\x03") { abortRace.abort(); process.exit(130); }
    }
  })();
  watchEsc.catch(() => {});

  const jobs = [0, 1].map(i =>
    agentRun(T.pair[i], task, dirs[i], d => {
      T.sides[i].buf += d;
      if (T.sides[i].buf.length > 9000) T.sides[i].buf = T.sides[i].buf.slice(-6000);
      scheduleRender();
    }).then(async r => {
      if (abortRace.signal.aborted) process.exit(130);
      const stat = gitStat(dirs[i]);
      T.sides[i] = {
        ...T.sides[i], done: true, ms: r.ms,
        err: r.ok ? null : "agent failed/timeout",
        buf: `${T.sides[i].buf.slice(-3000)}\n\n── changed: ──\n${stat}`,
      };
      scheduleRender();
    })
  );
  await Promise.all(jobs);

  const vote = await getVote();
  let line = "";
  if (vote === "a" || vote === "b") {
    const win = vote === "a" ? 0 : 1;
    const d = applyResult(T.pair[0], T.pair[1], vote === "a" ? 1 : 0);
    const okAdopt = adopt(dirs[win]);
    line = `${GRN}🏆 WINNER: ${T.pair[win]}${RST} — work ${okAdopt ? GRN + "adopted into " + CWD + RST : RED + "adopt FAILED (files kept in " + dirs[win] + ")" + RST} · (loser was ${T.pair[1 - win]}) · elo ${d.a >= 0 && vote === "a" ? "+" + d.a : "+" + (d.b >= 0 ? d.b : d.b)}`;
  } else if (vote === "t") {
    const d = applyResult(T.pair[0], T.pair[1], 0.5);
    line = `${YLW}TIE${RST} — A = ${T.pair[0]} · B = ${T.pair[1]} · nothing adopted`;
  } else if (vote === "s") {
    line = `${DIM}both bad${RST} — A = ${T.pair[0]} · B = ${T.pair[1]} · nothing adopted, no elo change`;
  } else {
    line = `${DIM}peek — A = ${T.pair[0]} · B = ${T.pair[1]} · nothing adopted${RST}`;
  }
  T.phase = "done"; T.resultLine = line;
  if (IS_TTY) frame(); else { printPipe(); console.log("\n" + stripAnsi(line)); }
}

// ---------------- main ----------------
async function main() {
  const mode = TASK_MODE ? "agent" : "chat";
  if (IS_TTY) {
    process.stdout.write(CLR);
    process.on("exit", () => process.stdout.write("\x1b[?25h"));
  }
  console.log(`⚔  arena-tui v${VERSION} — ${mode} battles · router ${UPSTREAM} · key ${KEY ? "loaded" : "MISSING"}`);
  if (!KEY) console.log(`${RED}no router key found — battles will fail${RST}`);

  let current = prompt;
  for (;;) {
    if (!current) current = await askLine(`\n${CYN}arena>${RST} `);
    if (!current || current === "q" || current === "quit" || current === "exit") break;
    if (current === "board") {
      const e = loadElo();
      Object.entries(e).sort((x, y) => y[1].elo - x[1].elo).forEach(([m, s]) =>
        console.log(`  ${String(s.elo).padStart(4)}  ${m.padEnd(30)} ${s.w}W ${s.l}L ${s.t}T`));
      current = ""; continue;
    }
    try {
      if (TASK_MODE) await agentBattle(current);
      else await chatBattle(current);
    } catch (e) {
      console.error(`${RED}battle error: ${e?.message || e}${RST}`);
    }
    if (IS_TTY && !AUTO) {
      T.phase = "done";
      current = await askLine(`\n${CYN}arena>${RST} `);
    } else break;
  }
  if (IS_TTY) process.stdout.write("\x1b[2J\x1b[H");
  console.log("gg — fights recorded in " + ELO_FILE);
}

main().catch(e => { console.error(e); process.exit(1); });
