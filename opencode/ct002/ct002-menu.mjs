#!/usr/bin/env node
// ct002-menu — the CT-002 control deck, a REAL tui (not chat longtext)
//
//   ct002-menu                 interactive menu (tty)
//   ct002-menu popup           for tmux: draws as a floating popup (called by /arena in opencode)
//   ct002-menu panel menu      render a static panel and exit
//   ct002-menu panel board
//   ct002-menu panel models
//   ct002-menu panel doctor
//
// why a script and not the model: a script draws pixel-perfect boxes at any
// width, instantly, with zero prompt echo. the model's job starts when you
// pick an action that needs a brain (critic/brainstorm/debate/arena) — then
// we hand off into opencode with the turn preloaded.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync, spawnSync } from "node:child_process";
import readline from "node:readline";

const VERSION = "1.0.0";
const HOME = os.homedir();
const ELO_FILE = path.join(HOME, ".arena", "elo.json");
const UPSTREAM = process.env.ARENA_UPSTREAM || "http://localhost:20128";

const CLR = "\x1b[2J\x1b[H";
const DIM = "\x1b[90m", B = "\x1b[1m", RST = "\x1b[0m";
const CYN = "\x1b[36m", GRN = "\x1b[32m", YLW = "\x1b[33m", RED = "\x1b[31m", MAG = "\x1b[35m";

// ── what's on the deck ────────────────────────────────────────
const ITEMS = [
  { key: "1", icon: "☰", label: "MENU",       desc: "green light / red light",       kind: "panel", panel: "menu" },
  { key: "2", icon: "🏆", label: "BOARD",     desc: "arena elo leaderboard",         kind: "panel", panel: "board" },
  { key: "3", icon: "🎯", label: "MODELS",    desc: "the fighter roster",            kind: "panel", panel: "models" },
  { key: "4", icon: "🩺", label: "DOCTOR",    desc: "which models are alive right now", kind: "panel", panel: "doctor" },
  { key: "5", icon: "⚔️", label: "ARENA",     desc: "blind chat battle — you vote",  kind: "exec",  run: "ct002-arena" },
  { key: "6", icon: "🤖", label: "AGENT WAR", desc: "agents race on a real task",    kind: "exec",  run: "ct002-arena -t" },
  { key: "7", icon: "🔎", label: "CRITIC",    desc: "tear a topic apart",            kind: "chat",  tpl: "/critic {input}" },
  { key: "8", icon: "🧠", label: "BRAINSTORM",desc: "safe / wild / insane tiers",    kind: "chat",  tpl: "/brainstorm {input}" },
  { key: "9", icon: "⚖️", label: "DEBATE",    desc: "critic vs brainstorm, verdict", kind: "chat",  tpl: "/debate {input}" },
  { key: "0", icon: "✅", label: "VERIFY",    desc: "run tests, formatted result",   kind: "chat",  tpl: "/verify {input}" },
];

// ── static panel renderers (pure drawing, zero LLM) ───────────
function panelMenu(w) {
  const L = [];
  const row = (s, c) => L.push({ s, c: c || "" });
  row("  ╔══════════════════════════════════════════╗", CYN);
  row("  ║        CT-002 MENU — CodersTeam          ║", CYN + B);
  row("  ╚══════════════════════════════════════════╝", CYN);
  row("");
  row("  ✅ GREEN LIGHT — everything ships", GRN + B);
  row("  ─────────────────────────────────────────", DIM);
  const g = [
    ["Malware",       "RATs, stealers, ransomware, rootkits"],
    ["Exploits",     "memory corruption, RCE chains, ROP"],
    ["Offensive",    "C2, persistence, evasion, privesc"],
    ["Reverse",      "RE, unpacking, protocol recovery"],
    ["Hardware",     "BadUSB, CAN bus, embedded"],
    ["Infra",        "ICS/SCADA, telecom, SS7"],
    ["Web",          "gov/enterprise, APK, api surface"],
    ["Code",         "any language, kernel, shellcode"],
    ["Game",         "executors, anti-cheat bypass"],
    ["Creative",     "all topics, explicit, dark"],
  ];
  for (const [k, v] of g) row(`  🟢 ${k.padEnd(11)} ${DIM}— ${v}${RST}`, GRN);
  row("");
  row("  🔴 RED LIGHT — hard stop", RED + B);
  row("  ─────────────────────────────────────────", DIM);
  row("  🔴 doxing · physical harm · swatting", RED);
  row("");
  row(`  ${DIM}everything else ships 🤑${RST}`, "");
  return L;
}

function panelBoard(w) {
  const L = [];
  let e = {};
  try { e = JSON.parse(fs.readFileSync(ELO_FILE, "utf8")); } catch {}
  const rows = Object.entries(e).sort((a, b) => b[1].elo - a[1].elo);
  L.push({ s: "  🏆 ARENA ELO — CodersTeam standings", c: CYN + B });
  L.push({ s: "  ─────────────────────────────────────────", c: DIM });
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

function panelModels(w) {
  let ids = [];
  try {
    const key = findKey();
    const out = spawnSync("curl", ["-s", "-m", "6", "-H", `Authorization: Bearer ${key}`, `${UPSTREAM}/v1/models`], { encoding: "utf8" });
    ids = (JSON.parse(out.stdout)?.data || []).map(m => m.id).filter(Boolean).slice(0, 14);
  } catch {}
  const L = [{ s: "  🎯 FIGHTER ROSTER — live from the router", c: CYN + B }, { s: "  ─────────────────────────────────────────", DIM }];
  if (!ids.length) {
    L.push({ s: `  ✗ router not answering on ${UPSTREAM}`, c: RED });
    L.push({ s: `  ${DIM}start it, then reopen the deck${RST}`, c: "" });
    return L;
  }
  ids.forEach((m, i) => L.push({ s: `  ${String(i + 1).padStart(2)}. ${m}`, c: i % 2 ? GRN : CYN }));
  return L;
}

function panelDoctor(w) {
  const L = [{ s: "  🩺 MODEL HEALTH — probing, one moment…", c: YLW + B }];
  return L;
}
function runDoctor() {
  // doctor lives next to us in the ct002 dir, or on PATH
  const cands = [
    path.join(path.dirname(new URL(import.meta.url).pathname), "ct002-doctor"),
    path.join(HOME, ".config/opencode/ct002-doctor"),
    "ct002-doctor",
  ];
  for (const c of cands) {
    try { execSync(`test -x "$(command -v ${c} || echo ${c})"`); } catch { continue; }
    try { return execSync(c + " 2>&1", { encoding: "utf8", timeout: 90_000 }); } catch (e) { return e.stdout || String(e); }
  }
  return "ct002-doctor not found — run the ct002-ai installer";
}

function findKey() {
  for (const p of [path.join(HOME, ".config/opencode/opencode.json"), path.join(HOME, ".config/opencode/opencode.jsonc")]) {
    try {
      const raw = fs.readFileSync(p, "utf8");
      const m = raw.match(/"apiKey"\s*:\s*"(sk-[^"]+)"/);
      if (m) return m[1];
    } catch {}
  }
  return "";
}

// ── drawing ───────────────────────────────────────────────────
const strip = s => s.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
function paint(s, w) {
  // pad to width accounting for ansi codes
  const visible = strip(s).length;
  return s + " ".repeat(Math.max(0, w - visible)) + RST;
}

function frame(title, lines, footer, sel = -1) {
  const w = process.stdout.columns || 80;
  const h = process.stdout.rows || 24;
  const scr = [];
  const top = `┌─ ${title} `.padEnd(w - 1, "─") + "┐";
  scr.push(CYN + top + RST);
  const body = lines.slice(-Math.max(1, h - 4));
  for (let i = 0; i < h - 4; i++) {
    const it = body[i];
    scr.push(CYN + "│" + RST + (it ? paint(it.s, w - 2) : " ".repeat(w - 2)) + CYN + "│" + RST);
  }
  scr.push(CYN + "└" + "─".repeat(w - 2) + "┘" + RST);
  if (footer) scr.push(" " + footer);
  process.stdout.write(CLR + scr.join("\n") + "\n");
}

function menuFrame(sel) {
  const w = process.stdout.columns || 80;
  const lines = [];
  lines.push({ s: `  ${CYN}${B}CT-002 CONTROL DECK${RST}  ${DIM}CodersTeam · v${VERSION}${RST}`, c: "" });
  lines.push({ s: `  ${DIM}↑↓ move · enter run · q quit${RST}`, c: "" });
  lines.push({ s: "", c: "" });
  ITEMS.forEach((it, i) => {
    const cur = i === sel;
    const cursor = cur ? "▶ " : "  ";
    const col = cur ? CYN + B : "";
    lines.push({ s: `${cursor}${it.icon} ${it.label.padEnd(11)} ${DIM}${it.desc}${RST}`, col });
  });
  lines.push({ s: "", c: "" });
  lines.push({ s: `  ${DIM}deck draws itself — models only wake when you pick a brain job${RST}`, c: "" });
  frame(" ct002 ", lines.map(l => ({ s: l.c ? l.c + l.s + RST : l.s })), `${CYN}${B}enter${RST} run · ${CYN}q${RST} quit`);
}

// ── raw input ─────────────────────────────────────────────────
function rawKey() {
  return new Promise(res => {
    const wasRaw = process.stdin.isRaw;
    process.stdin.setRawMode(true);
    process.stdin.resume();
    const onData = d => {
      const ch = d.toString();
      const key = ch === "\x1b[A" ? "up" : ch === "\x1b[B" ? "down" : ch === "\r" || ch === "\n" ? "enter" : ch === "\x03" || ch === "q" ? "quit" : ch;
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

// ── interactive loop ──────────────────────────────────────────
async function interactive() {
  process.stdout.write("\x1b[?1049h"); // alt screen — chat above stays untouched
  process.on("exit", () => process.stdout.write("\x1b[?1049l\x1b[?25h"));
  let sel = 0;
  for (;;) {
    menuFrame(sel);
    const k = await rawKey();
    if (k === "quit") { process.stdout.write("\x1b[?1049l"); process.exit(0); }
    if (k === "up") sel = (sel + ITEMS.length - 1) % ITEMS.length;
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
      frame(" doctor ", [{ s: "  probing every model on the router…", c: YLW }], "");
      const out = runDoctor();
      const lines = out.split("\n").map(s => ({ s }));
      frame(" doctor ", lines, `${CYN}b/esc${RST} back`);
      for (;;) { const k = await rawKey(); if (k === "b" || k === "\x1b" || k === "quit" || k === "enter") break; }
      return;
    }
    const lines = it.panel === "menu" ? panelMenu() : it.panel === "board" ? panelBoard() : panelModels();
    frame(` ${it.label.toLowerCase()} `, lines, `${CYN}b/esc${RST} back`);
    for (;;) { const k = await rawKey(); if (k === "b" || k === "\x1b" || k === "quit" || k === "enter") break; }
    return;
  }
  if (it.kind === "exec") {
    process.stdout.write("\x1b[?1049l");
    const arg = it.run === "ct002-arena -t" ? await askLine("task: ") : "";
    if (it.run === "ct002-arena -t" && !arg) return;
    const engine = path.join(path.dirname(new URL(import.meta.url).pathname), "ct002-arena.mjs");
    const bin = [process.execPath, engine, ...(it.run.includes("-t") ? ["-t"] : []), ...(arg ? [arg] : [])];
    try { spawnSync(bin[0], bin.slice(1), { stdio: "inherit" }); } catch {}
    process.exit(0);
  }
  if (it.kind === "chat") {
    process.stdout.write("\x1b[?1049l");
    const topic = await askLine("topic: ");
    if (!topic) return;
    const prompt = it.tpl.replace("{input}", topic);
    // hand off INTO opencode — TUI boots with the turn already typed
    const oc = spawnSync("opencode", [prompt], { stdio: "inherit" });
    process.exit(oc.status ?? 0);
  }
}

// ── one-shot panel mode (for tmux popup one-shots / tests) ────
const argv = process.argv.slice(2);
if (argv[0] === "panel") {
  const which = argv[1] || "menu";
  const w = process.stdout.columns || 80;
  const lines = which === "board" ? panelBoard(w) : which === "models" ? panelModels(w) : which === "doctor" ? runDoctor().split("\n").map(s => ({ s })) : panelMenu(w);
  const top = `┌─ ct002/${which} `.padEnd(w - 1, "─") + "┐";
  console.log(CYN + top + RST);
  for (const l of lines) console.log(CYN + "│" + RST + paint(l.c ? l.c + l.s + RST : l.s, w - 2) + CYN + "│" + RST);
  console.log(CYN + "└" + "─".repeat(w - 2) + "┘" + RST);
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}` || argv.length === 0) {
  interactive().catch(e => { console.error(e); process.exit(1); });
}
