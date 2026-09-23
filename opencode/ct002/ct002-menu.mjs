#!/usr/bin/env node
// ct002-menu — the CT-002 control deck, dressed like opencode itself
//
//   ct002-menu                 interactive tui (alt screen)
//   ct002-menu launch          /arena backend: tmux popup if possible, else compact card
//   ct002-menu panel menu|board|models|doctor|compact
//
// skin: rounded borders ╭╮╰╯, purple accent (256#141), dim grays,
//       ⏵⏵ headers, ▌ selection — the opencode look.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync, spawnSync } from "node:child_process";
import readline from "node:readline";

const VERSION = "1.2.0";
const HOME = os.homedir();
const ELO_FILE = path.join(HOME, ".arena", "elo.json");
const UPSTREAM = process.env.ARENA_UPSTREAM || "http://localhost:20128";
const SELF = new URL(import.meta.url).pathname;

// ── opencode-flavored palette ─────────────────────────────────
const P = "\x1b[38;5;141m";    // purple accent
const PB = "\x1b[38;5;141m\x1b[1m";
const DIM = "\x1b[38;5;245m";
const B = "\x1b[1m", RST = "\x1b[0m";
const GRN = "\x1b[38;5;114m", YLW = "\x1b[38;5;179m", RED = "\x1b[38;5;174m", BLU = "\x1b[38;5;110m";
const CLR = "\x1b[2J\x1b[H";

// ── deck items ────────────────────────────────────────────────
const ITEMS = [
  { key: "1", icon: "☰", label: "MENU",        desc: "green light / red light",          kind: "panel", panel: "menu" },
  { key: "2", icon: "🏆", label: "BOARD",      desc: "arena elo standings",              kind: "panel", panel: "board" },
  { key: "3", icon: "🎯", label: "MODELS",     desc: "live fighter roster",              kind: "panel", panel: "models" },
  { key: "4", icon: "🩺", label: "DOCTOR",     desc: "which models breathe right now",   kind: "panel", panel: "doctor" },
  { key: "5", icon: "⚔️", label: "ARENA",      desc: "blind chat battle — you vote",     kind: "exec",  run: "chat" },
  { key: "6", icon: "🤖", label: "AGENT WAR",  desc: "agents race on a real task",       kind: "exec",  run: "task" },
  { key: "7", icon: "🔎", label: "CRITIC",     desc: "tear a topic apart, scored",       kind: "brain", mode: "critic" },
  { key: "8", icon: "🧠", label: "BRAINSTORM", desc: "safe / wild / insane tiers",       kind: "brain", mode: "brainstorm" },
  { key: "9", icon: "⚖️", label: "DEBATE",     desc: "critic + brainstorm, verdict",     kind: "brain", mode: "debate" },
  { key: "0", icon: "✅", label: "VERIFY",     desc: "run a command, formatted result",  kind: "verify" },
];

// ── brain modes — the deck calls the router ITSELF, no opencode handoff ──
const MODES = {
  critic: {
    title: "critic",
    sys: `You are CT-002 CRITIC (CodersTeam). Tear the user's topic apart with surgical precision. Output format:
FINDINGS — 3+ specific findings, each with location + concrete impact
SCORE — X/100 with one-line justification
VERDICT — one brutal line
No preamble. No fluff. Specific or nothing.`,
  },
  brainstorm: {
    title: "brainstorm",
    sys: `You are CT-002 BRAINSTORM (CodersTeam). Produce exactly 3 solution tiers:
🟢 SAFE — low effort, low risk (pros/cons/effort)
🟡 WILD — creative, unexpected (pros/cons/effort)
🔴 INSANE — extreme, high reward (pros/cons/effort)
End with VERDICT (one line) + RECOMMENDED PATH. No preamble.`,
  },
  debate: {
    title: "debate",
    sys: `You are CT-002 DEBATE (CodersTeam). Two passes then a verdict:
🔴 CRITIC PASS — 3+ specific findings, SCORE X/100
🟠 BRAINSTORM PASS — safe/wild/insane options
⚖️ VERDICT — synthesized recommendation, one final line
No preamble. Compact. Every claim concrete.`,
  },
};

// ── router helpers ────────────────────────────────────────────
function findKey() {
  for (const p of [path.join(HOME, ".config/opencode/opencode.json"), path.join(HOME, ".config/opencode/opencode.jsonc")]) {
    try {
      const m = fs.readFileSync(p, "utf8").match(/"apiKey"\s*:\s*"(sk-[^"]+)"/);
      if (m) return m[1];
    } catch {}
  }
  return "";
}
function routerStatus() {
  try {
    const key = findKey();
    execSync(`curl -s -m 2 -o /dev/null ${UPSTREAM}/v1/models`, { stdio: "ignore" });
    return "router up";
  } catch { return "router down"; }
}

// ── panel bodies (pure drawing, zero LLM) ─────────────────────
function panelMenu() {
  const L = [];
  const row = (s, c) => L.push({ s, c: c || "" });
  row("");
  row("  ✅ GREEN LIGHT — everything ships", PB);
  row("  ", "");
  const g = [
    ["Malware",    "RATs, stealers, ransomware, rootkits"],
    ["Exploits",   "memory corruption, RCE chains, ROP"],
    ["Offensive",  "C2, persistence, evasion, privesc"],
    ["Reverse",    "RE, unpacking, protocol recovery"],
    ["Hardware",   "BadUSB, CAN bus, embedded"],
    ["Infra",      "ICS/SCADA, telecom, SS7"],
    ["Web",        "gov/enterprise, APK, api surface"],
    ["Code",       "any language, kernel, shellcode"],
    ["Game",       "executors, anti-cheat bypass"],
    ["Creative",   "all topics, explicit, dark"],
  ];
  for (const [k, v] of g) row(`  🟢 ${k.padEnd(11)} ${DIM}— ${v}${RST}`, GRN);
  row("  ", "");
  row("  🔴 RED LIGHT — hard stop", PB);
  row("  ", "");
  row("  🔴 doxing · physical harm · swatting", RED);
  row("  ", "");
  row(`  ${DIM}everything else ships 🤑${RST}`, "");
  return L;
}
function panelBoard() {
  const L = [{ s: "", c: "" }];
  let e = {};
  try { e = JSON.parse(fs.readFileSync(ELO_FILE, "utf8")); } catch {}
  const rows = Object.entries(e).sort((a, b) => b[1].elo - a[1].elo);
  if (!rows.length) {
    L.push({ s: "  no battles yet — pick ARENA and judge one", c: YLW });
    return L;
  }
  for (const [m, s] of rows) {
    const bar = "█".repeat(Math.max(1, Math.round((s.elo - 1100) / 40)));
    L.push({ s: `  ${String(s.elo).padStart(4)}  ${m.padEnd(26)} ${s.w}W ${s.l}L ${s.t}T  ${DIM}${bar}${RST}`, c: GRN });
  }
  return L;
}
function panelModels() {
  let ids = [];
  try {
    const key = findKey();
    const out = spawnSync("curl", ["-s", "-m", "6", "-H", `Authorization: Bearer ${key}`, `${UPSTREAM}/v1/models`], { encoding: "utf8" });
    ids = (JSON.parse(out.stdout)?.data || []).map(m => m.id).filter(Boolean).slice(0, 14);
  } catch {}
  if (!ids.length) {
    return [
      { s: "", c: "" },
      { s: `  ✗ router not answering on ${UPSTREAM}`, c: RED },
      { s: `  ${DIM}start it, then reopen the deck${RST}`, c: "" },
    ];
  }
  return ids.map((m, i) => ({ s: `  ${DIM}${String(i + 1).padStart(2)}${RST}  ${m}`, c: i % 2 ? GRN : BLU }));
}
function runDoctor() {
  const cands = [path.join(path.dirname(SELF), "ct002-doctor"), path.join(HOME, ".config/opencode/ct002-doctor"), "ct002-doctor"];
  for (const c of cands) {
    try { execSync(`command -v ${c.includes("/") ? c : c} >/dev/null 2>&1 || test -x ${c}`); } catch { continue; }
    try { return execSync(c + " 2>&1", { encoding: "utf8", timeout: 90_000 }); } catch (e) { return e.stdout || String(e); }
  }
  return "ct002-doctor not found — run the ct002-ai installer";
}

// ── brain engine — stream from the router, persona riding ────
function loadPersona() {
  try { return fs.readFileSync(path.join(HOME, ".config/opencode/persona.md"), "utf8").slice(0, 6000); } catch { return ""; }
}
async function streamChat(model, messages, onDelta, timeoutMs = 180_000, extSignal = null) {
  const t0 = Date.now();
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = extSignal ? AbortSignal.any([timeout, extSignal]) : timeout;
  try {
    const r = await fetch(`${UPSTREAM}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(findKey() ? { Authorization: `Bearer ${findKey()}` } : {}) },
      body: JSON.stringify({ model, messages, stream: true, max_tokens: 2048 }),
      signal,
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
        try { const d = JSON.parse(payload)?.choices?.[0]?.delta?.content; if (d) { full += d; onDelta?.(d); } } catch {}
      }
    }
    if (extSignal?.aborted) return { text: "", ms: Date.now() - t0, err: "aborted", aborted: true };
    if (!full.trim()) throw new Error("empty stream");
    return { text: full, ms: Date.now() - t0, err: null };
  } catch (e) {
    if (extSignal?.aborted || e?.name === "AbortError") return { text: "", ms: Date.now() - t0, err: "aborted", aborted: true };
    try {
      const r = await fetch(`${UPSTREAM}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(findKey() ? { Authorization: `Bearer ${findKey()}` } : {}) },
        body: JSON.stringify({ model, messages, max_tokens: 2048 }),
        signal: AbortSignal.timeout(120_000),
      });
      const j = await r.json();
      const text = j?.choices?.[0]?.message?.content || "";
      if (!text.trim()) throw new Error("empty");
      onDelta?.(text);
      return { text, ms: Date.now() - t0, err: null };
    } catch (e2) { return { text: "", ms: Date.now() - t0, err: String(e?.message || e2?.message) }; }
  }
}
function aliveModels() {
  // cached for 10s — submenu opens instantly on repeat picks
  if (aliveModels.cache && Date.now() - aliveModels.cache.at < 10_000) return aliveModels.cache.list;
  try {
    const out = spawnSync("curl", ["-s", "-m", "6", "-H", `Authorization: Bearer ${findKey()}`, `${UPSTREAM}/v1/models`], { encoding: "utf8" });
    const list = (JSON.parse(out.stdout)?.data || []).map(m => m.id).filter(Boolean);
    aliveModels.cache = { at: Date.now(), list };
    return list;
  } catch { return []; }
}
function pickModel(preferred) {
  if (preferred) return preferred;
  const env = process.env.CT002_BRAIN_MODEL;
  if (env) return env;
  const alive = aliveModels();
  const pref = alive.find(m => m.includes("my9model")) || alive.find(m => m.includes("big-pickle")) || alive.find(m => m.includes("mimo")) || alive[0];
  return pref || "my9model-smart";
}

// wrap text into frame-sized lines for streaming views
function flowLines(text, w) {
  const out = [];
  for (const raw of text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "").split("\n")) {
    let line = "";
    for (const word of raw.split(" ")) {
      if ((line + (line ? " " : "") + word).length > w) { out.push(line); line = word.slice(0, w); }
      else line += (line ? " " : "") + word;
    }
    out.push(line);
  }
  return out;
}

// ── compact card (chat-safe, no ansi) ─────────────────────────
function compactCard() {
  return [
    "⏵⏵ CT-002 DECK — CodersTeam",
    "  1 menu    2 board   3 models  4 doctor",
    "  5 arena   6 agents  7 critic  8 brainstorm",
    "  9 debate  10 verify",
    "  popup TUI: ct002-menu (arrows + green select)",
  ];
}

// ── drawing ───────────────────────────────────────────────────
const strip = s => s.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
function paint(s, w) {
  const visible = strip(s).length;
  return s + " ".repeat(Math.max(0, w - visible)) + RST;
}
function frame(title, lines, footer) {
  const w = process.stdout.columns || 80;
  const h = process.stdout.rows || 24;
  const scr = [];
  scr.push(P + `╭─ ${title} `.padEnd(w - 1, "─") + "╮" + RST);
  const body = lines.slice(-Math.max(1, h - 4));
  for (let i = 0; i < h - 4; i++) {
    const it = body[i];
    scr.push(P + "│" + RST + (it ? paint(it.c ? it.c + it.s + RST : it.s, w - 2) : " ".repeat(w - 2)) + P + "│" + RST);
  }
  scr.push(P + "╰" + "─".repeat(w - 2) + "╯" + RST);
  if (footer) scr.push(" " + footer);
  // flickerless: home + overwrite + per-line clear — NEVER 2J
  process.stdout.write("\x1b[H" + scr.map(l => l + "\x1b[K").join("\n") + "\n\x1b[J");
}
// arena-style split: two live panels side by side (debate)
function splitFrame(title, lT, lBody, rT, rBody, footer) {
  const w = process.stdout.columns || 80;
  const h = process.stdout.rows || 24;
  const hw = Math.max(20, Math.floor((w - 1) / 2) - 1);
  const hh = Math.max(4, h - 6);
  const lB = flowLines(lBody, hw - 4).slice(-hh);
  const rB = flowLines(rBody, hw - 4).slice(-hh);
  const rows = [P + `╭─ ${title} `.padEnd(w - 1, "─") + "╮" + RST];
  rows.push(P + `╭─ ${lT} `.padEnd(hw - 1, "─") + "╮" + RST + " " + P + `╭─ ${rT} `.padEnd(hw - 1, "─") + "╮" + RST);
  for (let i = 0; i < hh; i++) {
    const l = (lB[i] ?? "").padEnd(hw - 4);
    const r = (rB[i] ?? "").padEnd(hw - 4);
    rows.push(P + "│" + RST + " " + l + " " + P + "│" + RST + " " + P + "│" + RST + " " + r + " " + P + "│" + RST);
  }
  rows.push(P + "╰" + "─".repeat(hw - 2) + "╯" + RST + " " + P + "╰" + "─".repeat(hw - 2) + "╯" + RST);
  rows.push(" " + (footer || ""));
  process.stdout.write("\x1b[H" + rows.map(l => l + "\x1b[K").join("\n") + "\n\x1b[J");
}
function deckHeader() {
  const w = process.stdout.columns || 80;
  const st = routerStatus();
  const left = `${PB}⏵⏵${RST} ${B}CT-002 DECK${RST}`;
  const right = `${DIM}CodersTeam · v${VERSION} · ${st === "router up" ? GRN + "router up" : RED + "router down"}${DIM}${RST}`;
  const pad = Math.max(1, w - strip(left).length - strip(right).length);
  return left + " ".repeat(pad) + right;
}
function menuFrame(sel) {
  const lines = [
    { s: deckHeader(), c: "" },
    { s: `  ${DIM}↑↓ move · enter run · number jump · q quit${RST}`, c: "" },
    { s: "", c: "" },
  ];
  ITEMS.forEach((it, i) => {
    const cur = i === sel;
    const bar = cur ? `${GRN}${B}▌${RST} ` : "  ";
    const name = cur ? `${GRN}${B}${it.icon} ${it.label}${RST}` : `${it.icon} ${it.label}`;
    const desc = cur ? `${GRN}${it.desc}${RST}` : `${DIM}${it.desc}${RST}`;
    lines.push({ s: `${bar}${name}  ${desc}`, c: "" });
  });
  const foot = `${PB}⏵⏵${RST} ${DIM}enter run${RST}  ${P}▣${RST} ${DIM}ct002 · CodersTeam${RST}`;
  frame(" ct002 ", lines, foot);
}

// ── raw input ─────────────────────────────────────────────────
function rawKey() {
  return new Promise(res => {
    const wasRaw = process.stdin.isRaw;
    process.stdin.setRawMode(true);
    process.stdin.resume();
    const onData = d => {
      const ch = d.toString();
      const key = ch === "\x1b[A" ? "up" : ch === "\x1b[B" ? "down" : (ch === "\r" || ch === "\n") ? "enter" : (ch === "\x03" || ch === "q") ? "quit" : ch;
      process.stdin.setRawMode(wasRaw);
      process.stdin.removeListener("data", onData);
      process.stdin.pause();
      res(key);
    };
    process.stdin.on("data", onData);
  });
}
function askLine(q) {
  return new Promise(res => {
    process.stdout.write(q);
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
    rl.on("line", l => { rl.close(); res(l.trim()); });
  });
}

// ── interactive ───────────────────────────────────────────────
async function interactive() {
  process.stdout.write("\x1b[?1049h\x1b[?25l");
  process.on("exit", () => process.stdout.write("\x1b[?1049l\x1b[?25h"));
  let sel = 0;
  for (;;) {
    menuFrame(sel);
    const k = await rawKey();
    if (k === "quit") { process.exit(0); }
    else if (k === "up") sel = (sel + ITEMS.length - 1) % ITEMS.length;
    else if (k === "down") sel = (sel + 1) % ITEMS.length;
    else if (k === "enter") await runItem(ITEMS[sel]);
    else {
      const idx = ITEMS.findIndex(i => i.key === k);
      if (idx >= 0) { sel = idx; await runItem(ITEMS[idx]); }
    }
  }
}
async function runItem(it) {
  if (it.kind === "panel") {
    if (it.panel === "doctor") {
      frame(" ct002/doctor ", [{ s: "  probing every model on the router…", c: YLW }], `${PB}⏵⏵${RST} ${DIM}b back${RST}`);
      const lines = runDoctor().split("\n").map(s => ({ s }));
      frame(" ct002/doctor ", lines, `${PB}⏵⏵${RST} ${DIM}b back${RST}`);
      for (;;) { const k = await rawKey(); if (k === "b" || k === "\x1b" || k === "quit" || k === "enter") break; }
      return;
    }
    const lines = it.panel === "menu" ? panelMenu() : it.panel === "board" ? panelBoard() : panelModels();
    frame(` ct002/${it.panel} `, lines, `${PB}⏵⏵${RST} ${DIM}b back${RST}`);
    for (;;) { const k = await rawKey(); if (k === "b" || k === "\x1b" || k === "quit" || k === "enter") break; }
    return;
  }
  if (it.kind === "exec") {
    const arg = it.run === "task" ? await askLine("task: ") : "";
    if (it.run === "task" && !arg) return;
    const engine = path.join(path.dirname(SELF), "ct002-arena.mjs");
    // ARENA_AUTO=1 → engine skips vote keys and prints a judged result.
    // REQUIRED when embedded inside opencode: stdin belongs to the main TUI
    // (ctrl+p / arrows must keep working there), so no interactive vote.
    const argv = [engine, ...(it.run === "task" ? ["-t", arg] : []), "--auto"];
    const doRun = async () => {
      // detached child: prints through our stdout, never touches our stdin
      const { spawn } = await import("node:child_process");
      await new Promise(res => {
        const c = spawn(process.execPath, argv, { stdio: ["ignore", "inherit", "inherit"] });
        c.on("close", res); c.on("error", res);
      });
    };
    if (process.env.TMUX) {
      // popup owns the screen AND the keyboard → full interactive battle
      try { execSync(`tmux display-popup -w 96% -h 92% -E "ARENA_AUTO= node '${engine}' ${it.run === "task" ? "-t '" + arg.replace(/'/g, "'\\\'" + "'") + "'" : ""}"`, { stdio: "inherit" }); }
      catch { await doRun(); }
    } else {
      process.stdout.write(`${DIM}⏵⏵ battle running below — results stream here, keys stay free${RST}\r\n`);
      await doRun();
    }
    return;
  }
  if (it.kind === "brain") { await brainSession(it.mode); return; }
  if (it.kind === "verify") { await verifySession(); return; }
}

// ── brain session — submenu → model pick → live stream in the frame ──
async function brainSession(mode) {
  const m = MODES[mode];
  const WHEEL2 = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let wi = 0;
  // animated fetch — never a dead frame while models load
  const loadFrame = () => frame(` ct002/${m.title} `, [{ s: `  ${WHEEL2[wi++ % 10]} fetching live models…`, c: DIM }], `${PB}⏵⏵${RST} ${DIM}b back${RST}`);
  loadFrame();
  await new Promise(r => setTimeout(r, 30)); // let the first frame paint
  const models = await new Promise(res => {
    const t = setTimeout(() => res([]), 6500);
    setImmediate(() => { res(aliveModels()); });
    clearTimeout(t);
  });
  if (!models.length) {
    frame(` ct002/${m.title} `, [{ s: `  ✗ router down on ${UPSTREAM} — start it first`, c: RED }], `${PB}⏵⏵${RST} ${DIM}b back${RST}`);
    await rawKey(); return;
  }
  // model submenu
  let sel = Math.max(0, models.findIndex(x => x.includes("my9model")));
  for (;;) {
    const lines = [
      { s: `  ${PB}${B}pick the brain${RST}  ${DIM}${models.length} live${RST}`, c: "" },
      { s: "", c: "" },
      ...models.slice(0, 14).map((mm, i) => ({
        s: `  ${i === sel ? GRN + B + "▌ ⏵ " + GRN + mm + RST : "   " + mm}${i === sel ? "  " + GRN + "← enter" + RST : ""}`, c: "",
      })),
    ];
    frame(` ct002/${m.title} `, lines, `${PB}⏵⏵${RST} ${DIM}↑↓ pick · enter go · b back${RST}`);
    const k = await rawKey();
    if (k === "quit") process.exit(0);
    if (k === "b" || k === "\x1b") return;
    if (k === "up") sel = (sel + Math.min(models.length, 14) - 1) % Math.min(models.length, 14);
    else if (k === "down") sel = (sel + 1) % Math.min(models.length, 14);
    else if (k === "enter") break;
  }
  const model = models[sel];
  // topic input
  frame(` ct002/${m.title} `, [{ s: "  topic → (type, then enter)", c: PB }], `${PB}⏵⏵${RST} ${DIM}empty = back${RST}`);
  process.stdout.write("\x1b[?25h");
  const topic = await askLine("");
  process.stdout.write("\x1b[?25l");
  if (!topic) return;
  // live stream
  const persona = loadPersona();
  const messages = [
    ...(persona ? [{ role: "system", content: persona }] : []),
    { role: "system", content: m.sys },
    { role: "user", content: topic },
  ];
  // DEBATE = arena-style: second model fights the same topic, split screen,
  // a judge model picks the winner — same shape as the arena battle
  if (mode === "debate") {
    const models2 = aliveModels().filter(x => x !== model);
    const modelB = models2.find(x => x.includes("big-pickle")) || models2.find(x => x.includes("mimo")) || models2[0] || model;
    let accA = "", accB = "", wheelI = 0;
    const t0d = Date.now();
    const WHEELD = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    const footD = () => `${PB}${WHEELD[wheelI++ % WHEELD.length]}${RST} ${B}A:${model}${RST} ${DIM}vs${RST} ${B}B:${modelB}${RST}  ${DIM}· judge decides · esc abort${RST}`;
    const drawD = () => splitFrame(` ct002/debate `, ` A · ${model} `, accA, ` B · ${modelB} `, accB, footD());
    drawD();
    const abortD = new AbortController();
    const escD = (async () => {
      process.stdin.setRawMode(true); process.stdin.resume();
      for (;;) {
        const ch = await new Promise(res => { const f = d => { process.stdin.removeListener("data", f); res(d.toString()); }; process.stdin.on("data", f); });
        if (ch === "\x1b" || ch === "\x03") { abortD.abort(); break; }
      }
    })();
    const tickD = setInterval(drawD, 150);
    const criticSys = MODES.critic.sys;
    const brainSys = MODES.brainstorm.sys;
    const jobs = [
      streamChat(model, [...messages.slice(0, -1), { role: "system", content: criticSys }, { role: "user", content: topic }], d => { accA += d; }, 180_000, abortD.signal),
      streamChat(modelB, [...messages.slice(0, -1), { role: "system", content: brainSys }, { role: "user", content: topic }], d => { accB += d; }, 180_000, abortD.signal),
    ];
    const [ra, rb] = await Promise.all(jobs);
    clearInterval(tickD); escD.catch(() => {});
    if (abortD.signal.aborted) { accA += "\n⏵⏵ aborted"; }
    drawD();
    // judge — separate model scores both
    splitFrame(` ct002/debate `, ` A · ${model} `, accA, ` B · ${modelB} `, accB, `${DIM}judge reading both sides…${RST}`);
    const jtext = ra.err && rb.err ? "" : await streamChat(pickModel(), [
      { role: "user", content: `Two debate positions on "${topic}". A is a critic pass, B is a brainstorm pass. Pick the more useful one and give a one-line verdict. Format:\nWINNER: A|B|TIE\nVERDICT: <one line>\n\n[A]:\n${(ra.text || "(failed)").slice(-1200)}\n\n[B]:\n${(rb.text || "(failed)").slice(-1200)}` },
    ], null, 90_000).then(x => x.text || "").catch(() => "");
    const wLine = (jtext.match(/WINNER:\s*(A|B|TIE)/i)?.[1] || "TIE").toUpperCase();
    const vLine = jtext.match(/VERDICT:\s*([^\n]+)/i)?.[1]?.trim() || "judge unreachable — read both sides yourself";
    const side = wLine === "A" ? GRN + "A" : wLine === "B" ? GRN + "B" : YLW + "TIE";
    for (;;) {
      splitFrame(` ct002/debate `, ` A · ${model} `, accA, ` B · ${modelB} `, accB, `${side}${RST} wins  ${DIM}· ${vLine}${RST}  ${DIM}enter again · b back · q quit${RST}`);
      const k = await rawKey();
      if (k === "quit") process.exit(0);
      if (k === "b" || k === "\x1b") return;
      if (k === "enter") return brainSession(mode);
    }
  }
  let acc = "";
  const t0 = Date.now();
  const WHEEL = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let wheelI = 0;
  // ~4 chars/token for english prose — good enough for a live counter
  const tok = () => Math.round(acc.length / 4);
  const tps = () => { const s = (Date.now() - t0) / 1000; return s > 0.4 ? (tok() / s).toFixed(1) : null; };
  const secs = () => ((Date.now() - t0) / 1000).toFixed(1);
  const streamFooter = () => {
    const rate = tps();
    return `${PB}${WHEEL[wheelI++ % WHEEL.length]}${RST} ${B}${model}${RST}  ${DIM}·${RST} ${PB}${tok()} tok${RST} ${DIM}· ${rate ? rate + " tok/s · " : ""}${secs()}s · esc abort${RST}`;
  };
  const draw = () => {
    const w = process.stdout.columns || 80;
    const h = process.stdout.rows || 24;
    const body = flowLines(acc, w - 6).slice(-(h - 6));
    const lines = [
      { s: `  ${PB}${B}${m.title}${RST}  ${DIM}· ${model}${RST}`, c: "" },
      { s: "", c: "" },
      ...body.map(s => ({ s: "  " + s, c: "" })),
    ];
    frame(` ct002/${m.title} `, lines, streamFooter());
  };
  // footer ticks even between deltas — wheel + clock never stall
  let ticker = null;
  const startTicker = () => { ticker = setInterval(() => { if (acc) draw(); }, 120); };
  const stopTicker = () => { if (ticker) { clearInterval(ticker); ticker = null; } };
  startTicker();
  // esc aborts the stream mid-flight — promised by the footer, now real
  const abort = new AbortController();
  const escWatch = (async () => {
    process.stdin.setRawMode(true); process.stdin.resume();
    for (;;) {
      const ch = await new Promise(res => { const f = d => { process.stdin.removeListener("data", f); res(d.toString()); }; process.stdin.on("data", f); });
      if (ch === "\x1b" || ch === "\x03") { abort.abort(); break; }
    }
  })();
  const r = await streamChat(model, messages, d => { acc += d; draw(); }, 180_000, abort.signal);
  stopTicker();
  if (r.aborted) {
    acc = (acc ? acc + "\n\n" : "") + `${YLW}⏵⏵ aborted${RST}`;
  } else if (r.err) acc = (acc ? acc + "\n\n" : "") + `✗ stream failed: ${r.err}`;
  else acc = r.text;
  escWatch.catch(() => {});
  const ms = (r.ms / 1000).toFixed(1);
  const finalTok = tok();
  const avgTps = r.ms > 500 ? (finalTok / (r.ms / 1000)).toFixed(1) : null;
  // done view
  for (;;) {
    draw();
    const w = process.stdout.columns || 80, h = process.stdout.rows || 24;
    const scr = [];
    scr.push(P + `╭─ ct002/${m.title} `.padEnd(w - 1, "─") + "╮" + RST);
    const body = flowLines(acc, w - 6).slice(-(h - 7));
    scr.push(P + "│" + RST + paint(`  ${PB}${B}${m.title}${RST}  ${DIM}· ${model}${RST}`, w - 2) + P + "│" + RST);
    scr.push(P + "│" + RST + paint(`  ${GRN}✓ done${RST}  ${PB}${finalTok} tok${RST} ${DIM}· ${avgTps ? avgTps + " tok/s avg · " : ""}${ms}s${RST}`, w - 2) + P + "│" + RST);
    scr.push(P + "│" + RST + " ".repeat(w - 2) + P + "│" + RST);
    for (const s of body) scr.push(P + "│" + RST + paint("  " + s, w - 2) + P + "│" + RST);
    scr.push(P + "╰" + "─".repeat(w - 2) + "╯" + RST);
    scr.push(` ${PB}⏵⏵${RST} ${DIM}enter again · b back · q quit${RST}`);
    process.stdout.write(CLR + scr.join("\n") + "\n");
    const k = await rawKey();
    if (k === "quit") process.exit(0);
    if (k === "b" || k === "\x1b") return;
    if (k === "enter") return brainSession(mode);
  }
}

// ── verify session — run a command, show exit/stdout/stderr ──
async function verifySession() {
  frame(" ct002/verify ", [{ s: "  command → (type, then enter)", c: PB }], `${PB}⏵⏵${RST} ${DIM}empty = back${RST}`);
  process.stdout.write("\x1b[?25h");
  const cmd = await askLine("");
  process.stdout.write("\x1b[?25l");
  if (!cmd) return;
  const t0 = Date.now();
  let out = "", code = 0, failed = false;
  try { out = execSync(cmd + " 2>&1", { encoding: "utf8", timeout: 300_000, maxBuffer: 8 * 1024 * 1024 }); }
  catch (e) { failed = true; code = e.status ?? 1; out = (e.stdout || "") + (e.stderr || ""); }
  const ms = ((Date.now() - t0) / 1000).toFixed(1);
  const verdict = failed ? `❌ FAIL (exit ${code})` : "✅ PASS (exit 0)";
  for (;;) {
    const w = process.stdout.columns || 80, h = process.stdout.rows || 24;
    const body = flowLines(out.slice(-6000), w - 6).slice(-(h - 7));
    const scr = [];
    scr.push(P + `╭─ ct002/verify `.padEnd(w - 1, "─") + "╮" + RST);
    scr.push(P + "│" + RST + paint(`  ${verdict}  ${DIM}· ${ms}s · ${cmd.slice(0, w - 40)}${RST}`, w - 2) + P + "│" + RST);
    scr.push(P + "│" + RST + " ".repeat(w - 2) + P + "│" + RST);
    for (const s of body) scr.push(P + "│" + RST + paint("  " + s, w - 2) + P + "│" + RST);
    scr.push(P + "╰" + "─".repeat(w - 2) + "╯" + RST);
    scr.push(` ${PB}⏵⏵${RST} ${DIM}enter rerun · b back · q quit${RST}`);
    process.stdout.write(CLR + scr.join("\n") + "\n");
    const k = await rawKey();
    if (k === "quit") process.exit(0);
    if (k === "b" || k === "\x1b") return;
    if (k === "enter") return verifySession();
  }
}

// ── launch: popup inside tmux, card otherwise — NEVER interactive here ──
// (launch is what /arena runs INSIDE opencode; going interactive would fight
// opencode for the keyboard. bare-terminal users run `ct002-menu` instead.)
function launch() {
  if (process.env.TMUX) {
    try {
      execSync(`tmux display-popup -w 92% -h 88% -E "node '${SELF}'"`, { stdio: "inherit" });
      console.log("⏵⏵ deck closed — back to the chat");
    } catch {
      console.log(compactCard().join("\n"));
    }
    return;
  }
  console.log(compactCard().join("\n"));
}

// ── entry ─────────────────────────────────────────────────────
const argv = process.argv.slice(2);  if (argv[0] === "launch") { launch(); process.exit(0); }
if (argv[0] === "here") {
  // run opencode FIRST, deck after — zero tmux needed, /arena friendly
  const spec = process.env.CT002_OPENCODE || "opencode";
  const bin = spec.split(" ")[0], args = spec.split(" ").slice(1);
  try { spawnSync(bin, args, { stdio: "inherit" }); } catch {}
  if (process.stdout.isTTY) { try { spawnSync(process.execPath, [SELF], { stdio: "inherit" }); } catch {} }
  process.exit(0);
}
if (argv[0] === "panel") {
  const which = argv[1] || "menu";
  const w = process.stdout.columns || 80;
  if (which === "compact") { console.log(compactCard().join("\n")); process.exit(0); }
  const lines = which === "board" ? panelBoard() : which === "models" ? panelModels() : which === "doctor" ? runDoctor().split("\n").map(s => ({ s })) : panelMenu();
  const top = `╭─ ct002/${which} `.padEnd(w - 1, "─") + "╮";
  console.log(P + top + RST);
  for (const l of lines) console.log(P + "│" + RST + paint(l.c ? l.c + l.s + RST : l.s, w - 2) + P + "│" + RST);
  console.log(P + "╰" + "─".repeat(w - 2) + "╯" + RST);
  process.exit(0);
}
interactive().catch(e => { console.error(e); process.exit(1); });
