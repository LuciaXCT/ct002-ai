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

const VERSION = "1.1.0";
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
  { key: "7", icon: "🔎", label: "CRITIC",     desc: "tear a topic apart",               kind: "chat",  tpl: "/critic {input}" },
  { key: "8", icon: "🧠", label: "BRAINSTORM", desc: "safe / wild / insane tiers",       kind: "chat",  tpl: "/brainstorm {input}" },
  { key: "9", icon: "⚖️", label: "DEBATE",     desc: "critic vs brainstorm, verdict",    kind: "chat",  tpl: "/debate {input}" },
  { key: "0", icon: "✅", label: "VERIFY",     desc: "run tests, formatted result",      kind: "chat",  tpl: "/verify {input}" },
];

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

// ── compact card (chat-safe, no ansi) ─────────────────────────
function compactCard() {
  return [
    "⏵⏵ CT-002 DECK — CodersTeam",
    "  1 menu    2 board   3 models  4 doctor",
    "  5 arena   6 agents  7 critic  8 brainstorm",
    "  9 debate  10 verify",
    "  full TUI → tmux + /arena · or run: ct002-menu",
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
  const top = `╭─ ${title} `.padEnd(w - 1, "─") + "╮";
  scr.push(P + top + RST);
  const body = lines.slice(-Math.max(1, h - 4));
  for (let i = 0; i < h - 4; i++) {
    const it = body[i];
    scr.push(P + "│" + RST + (it ? paint(it.c ? it.c + it.s + RST : it.s, w - 2) : " ".repeat(w - 2)) + P + "│" + RST);
  }
  scr.push(P + "╰" + "─".repeat(w - 2) + "╯" + RST);
  if (footer) scr.push(" " + footer);
  process.stdout.write(CLR + scr.join("\n") + "\n");
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
    const bar = cur ? `${PB}▌${RST} ` : "  ";
    const name = cur ? `${PB}${B}${it.icon} ${it.label}${RST}` : `${it.icon} ${it.label}`;
    lines.push({ s: `${bar}${name}  ${DIM}${it.desc}${RST}`, c: "" });
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
    else if (/^[0-9]$/.test(k)) {
      const idx = ITEMS.findIndex(i => i.key === k);
      if (idx >= 0) { sel = idx; await runItem(ITEMS[idx]); }
    } else if (k === "enter") await runItem(ITEMS[sel]);
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
    process.stdout.write("\x1b[?1049l\x1b[?25h");
    const arg = it.run === "task" ? await askLine("task: ") : "";
    if (it.run === "task" && !arg) process.exit(0);
    const engine = path.join(path.dirname(SELF), "ct002-arena.mjs");
    const argv = [engine, ...(it.run === "task" ? ["-t", arg] : [])];
    try { spawnSync(process.execPath, argv, { stdio: "inherit" }); } catch {}
    process.exit(0);
  }
  if (it.kind === "chat") {
    process.stdout.write("\x1b[?1049l\x1b[?25h");
    const topic = await askLine("topic: ");
    if (!topic) process.exit(0);
    try { spawnSync("opencode", [it.tpl.replace("{input}", topic)], { stdio: "inherit" }); } catch {}
    process.exit(0);
  }
}

// ── launch: popup when tmux, card otherwise ───────────────────
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
const argv = process.argv.slice(2);
if (argv[0] === "launch") { launch(); process.exit(0); }
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
