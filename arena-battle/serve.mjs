#!/usr/bin/env node
// arena-battle gateway — the arena.ai "versus" thinking, self-hosted
// every request is fired at N models in parallel, a judge scores the answers,
// the winner is returned to the client as a plain OpenAI-compatible response.
// zero deps, node >= 18.  port 20129 (sits next to 9router on 20128).

import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const VERSION = "1.0.0";
const PORT = Number(process.env.ARENA_PORT || 20129);
const UPSTREAM = (process.env.ARENA_UPSTREAM || "http://localhost:20128").replace(/\/$/, "");

// --- upstream key: env wins, else steal from opencode config, else none ---
function findKey() {
  if (process.env.ARENA_KEY) return process.env.ARENA_KEY;
  const candidates = [
    path.join(os.homedir(), ".config/opencode/opencode.json"),
    path.join(os.homedir(), ".config/opencode/opencode.jsonc"),
  ];
  for (const p of candidates) {
    try {
      const raw = fs.readFileSync(p, "utf8")
        .replace(/"(?:[^"\\\n\\r]|\\.)*"|\/\/.*$|\/\*[\s\S]*?\*\//g, m => m.startsWith('"') ? m : ' '.repeat(m.length))
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
      const j = JSON.parse(raw);
      const k = j?.provider?.ct002?.options?.apiKey || j?.provider?.["9router"]?.options?.apiKey;
      if (k && k.startsWith("sk-")) return k;
    } catch {}
  }
  return "";
}
const KEY = findKey();

// --- the roster. override with ARENA_FIGHTERS="a,b,c" ---
const DEFAULT_FIGHTERS = [
  "oc/big-pickle",
  "oc/nemotron-3-ultra-free",
  "oc/mimo-v2.5-free",
  "my9model-smart",
  "opencode-free",
];
const FIGHTERS = (process.env.ARENA_FIGHTERS || DEFAULT_FIGHTERS.join(","))
  .split(",").map(s => s.trim()).filter(Boolean);

const JUDGE = process.env.ARENA_JUDGE || "my9model-smart";
const FIGHT_TIMEOUT = Number(process.env.ARENA_TIMEOUT || 90_000);
const PROMPT_CAP = Number(process.env.ARENA_PROMPT_CAP || 4000);

// different "models" opencode can pick = different battle sizes
const MODES = {
  "arena/battle":     { count: FIGHTERS.length, name: "full battle" },
  "arena/battle-2":   { count: 2,               name: "quick duel" },
  "arena/consensus":  { count: Math.min(4, FIGHTERS.length), name: "consensus" },
};

// ---------------- battle log (memory, last 30) ----------------
const history = [];
function logBattle(entry) {
  history.unshift({ ...entry, at: new Date().toISOString() });
  if (history.length > 30) history.pop();
}

// ---------------- upstream call ----------------
async function callModel(model, messages, maxTokens) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FIGHT_TIMEOUT);
  const started = Date.now();
  try {
    const r = await fetch(`${UPSTREAM}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(KEY ? { Authorization: `Bearer ${KEY}` } : {}),
      },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens ?? 2048 }),
      signal: ctrl.signal,
    });
    const text = await r.text();
    if (!r.ok) return { model, ok: false, ms: Date.now() - started, error: text.slice(0, 200) };
    const j = JSON.parse(text);
    const content = j?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim())
      return { model, ok: false, ms: Date.now() - started, error: "empty content" };
    return { model, ok: true, ms: Date.now() - started, content };
  } catch (e) {
    return { model, ok: false, ms: Date.now() - started, error: String(e?.message || e).slice(0, 200) };
  } finally {
    clearTimeout(t);
  }
}

// ---------------- prompt shaping ----------------
function flatten(req) {
  const msgs = Array.isArray(req.messages) ? req.messages : [];
  const sys = msgs.filter(m => m.role === "system").map(m => m.content).join("\n").slice(0, 1500);
  const convo = msgs
    .filter(m => m.role !== "system")
    .slice(-6)
    .map(m => `${m.role}: ${typeof m.content === "string" ? m.content : JSON.stringify(m.content)}`)
    .join("\n")
    .slice(-PROMPT_CAP);
  return { sys, convo };
}

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

function judgePrompt(sys, question, answers) {
  const shown = answers
    .map((a, i) => `--- Answer ${LETTERS[i]} (${a.ms}ms) ---\n${a.content.slice(0, 2500)}`)
    .join("\n\n");
  return [
    "You are the ARENA JUDGE. Multiple AI answers to the same question are below, anonymized.",
    sys ? `The user's system instruction (persona) was:\n${sys}\n` : "",
    `The question / conversation:\n${question}\n`,
    shown,
    "",
    "Score each answer 1-10 on: correctness, usefulness, completeness, and how well it follows the persona/system instruction.",
    "Pick exactly one winner. Prefer concrete, complete, working answers over hedging.",
    'Reply with ONLY a JSON object, no other text:',
    '{"scores":{"A":7,"B":9},"winner":"B","reason":"one short sentence why"}',
  ].filter(Boolean).join("\n");
}

function parseJudgeJSON(text) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]);
    if (!j || typeof j.winner !== "string") return null;
    return j;
  } catch { return null; }
}

// ---------------- the battle itself ----------------
async function battle(modeKey, req) {
  const mode = MODES[modeKey] || MODES["arena/battle"];
  const { sys, convo } = flatten(req);
  const fighters = FIGHTERS.slice(0, mode.count);
  const t0 = Date.now();

  const results = await Promise.all(fighters.map(f => callModel(f, [
    ...(sys ? [{ role: "system", content: sys }] : []),
    { role: "user", content: convo || "hello" },
  ])));

  const good = results.filter(r => r.ok);
  if (good.length === 0) {
    const err = results[0]?.error || "all fighters failed";
    return { status: 502, body: { error: { message: `arena: every fighter failed — ${err}`, type: "arena_all_dead" } } };
  }

  let winner, judgeInfo = "no judge (fallback: longest answer)";

  if (good.length >= 2) {
    const jp = judgePrompt(sys, convo || "hello", good);
    const jr = await callModel(JUDGE, [
      { role: "system", content: "You are a strict, impartial judge. Output only JSON." },
      { role: "user", content: jp },
    ], 300);
    const parsed = jr.ok ? parseJudgeJSON(jr.content) : null;

    if (parsed) {
      const idx = good.findIndex((_, i) => LETTERS[i] === parsed.winner.trim().toUpperCase());
      if (idx >= 0) {
        winner = good[idx];
        judgeInfo = `${JUDGE} → winner ${parsed.winner} (${parsed.reason || ""}) scores: ${
          Object.entries(parsed.scores || {}).map(([k, v]) => `${k}=${v}`).join(" ")
        }`;
      }
    }
    if (!winner) {
      winner = good.reduce((a, b) => (b.content.length > a.content.length ? b : a));
      judgeInfo = `judge unavailable/unparseable → longest-answer fallback (${winner.model})`;
    }
  } else {
    winner = good[0];
    judgeInfo = "only one fighter survived — auto-win";
  }

  const field = results.map(r => `${r.ok ? "✓" : "✗"} ${r.model} ${r.ok ? r.ms + "ms" : (r.error || "fail").slice(0, 60)}`);
  const footer = [
    "",
    "---",
    `⚔️ **arena ${mode.name}** — winner: **${winner.model}** (${winner.ms}ms)`,
    `field: ${field.join(" · ")}`,
    `judge: ${judgeInfo}`,
    `${good.length}/${fighters.length} fighters answered · total ${(Date.now() - t0) / 1000}s`,
  ].join("\n");

  logBattle({ mode: modeKey, winner: winner.model, fighters: fighters.length, answered: good.length, ms: Date.now() - t0 });

  const text = winner.content + "\n" + footer;
  const now = Math.floor(Date.now() / 1000);
  const promptTokens = Math.ceil((convo.length + sys.length) / 4);
  const completionTokens = Math.ceil(text.length / 4);

  return {
    status: 200,
    body: {
      id: `chatcmpl-arena-${Date.now().toString(36)}`,
      object: "chat.completion",
      created: now,
      model: modeKey,
      choices: [{
        index: 0,
        message: { role: "assistant", content: text },
        finish_reason: "stop",
      }],
      usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: promptTokens + completionTokens },
      arena: { winner: winner.model, field: results.map(r => ({ model: r.model, ok: r.ok, ms: r.ms })), judge: judgeInfo },
    },
  };
}

// ---------------- minimal SSE passthrough of the final answer ----------------
function streamResponse(res, battleResult, modelName) {
  const body = battleResult.body;
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const text = body.choices[0].message.content;
  const chunks = text.match(/[\s\S]{1,80}/g) || [];
  let i = 0;
  const tick = () => {
    if (i >= chunks.length) {
      res.write(`data: ${JSON.stringify({ id: body.id, object: "chat.completion.chunk", created: body.created, model: modelName, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }
    res.write(`data: ${JSON.stringify({ id: body.id, object: "chat.completion.chunk", created: body.created, model: modelName, choices: [{ index: 0, delta: { content: chunks[i] }, finish_reason: null }] })}\n\n`);
    i++;
    setTimeout(tick, 8);
  };
  tick();
}

// ---------------- http server ----------------
const server = http.createServer(async (req, res) => {
  const url = req.url.split("?")[0];

  if (req.method === "GET" && (url === "/health" || url === "/")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({
      status: "ok", version: VERSION, upstream: UPSTREAM, key: KEY ? "loaded" : "MISSING",
      fighters: FIGHTERS, judge: JUDGE, modes: Object.keys(MODES), battles: history.length,
    }));
  }

  if (req.method === "GET" && url === "/v1/models") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({
      object: "list",
      data: Object.keys(MODES).map(id => ({ id, object: "model", owned_by: "arena-battle" })),
    }));
  }

  if (req.method === "GET" && url === "/battles") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(history, null, 2));
  }

  if (req.method === "POST" && url === "/v1/chat/completions") {
    let raw = "";
    req.on("data", c => { raw += c; if (raw.length > 5e6) req.destroy(); });
    req.on("end", async () => {
      let body;
      try { body = JSON.parse(raw); } catch { res.writeHead(400); return res.end('{"error":{"message":"bad json"}}'); }
      const model = body.model || "arena/battle";
      const modeKey = MODES[model] ? model : "arena/battle";
      try {
        const result = await battle(modeKey, body);
        if (body.stream) return streamResponse(res, result, modeKey);
        res.writeHead(result.status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result.body));
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: { message: String(e?.message || e) } }));
      }
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end('{"error":{"message":"not found — try /health /v1/models /v1/chat/completions /battles"}}');
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`⚔️  arena-battle v${VERSION} on http://127.0.0.1:${PORT}`);
  console.log(`    upstream: ${UPSTREAM}  key: ${KEY ? "loaded" : "MISSING"}`);
  console.log(`    fighters (${FIGHTERS.length}): ${FIGHTERS.join(", ")}`);
  console.log(`    judge: ${JUDGE}`);
  console.log(`    models for opencode: ${Object.keys(MODES).join(", ")}`);
});
