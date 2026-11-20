#!/usr/bin/env node
// Smoke test: POST /api/agent in Stage Demo mode and validate the SSE stream.
// Usage: node .claude/skills/preflight/smoke.mjs [baseUrl]   (default http://localhost:3000)
// Needs no API keys: demoMode:true is simulated server-side. Exits 0 on pass, 1 on fail.

const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const fail = (msg) => {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
};

const health = await fetch(`${base}/api/health`).catch((e) => fail(`/api/health unreachable: ${e.message}`));
if (!health.ok) fail(`/api/health returned ${health.status}`);
const h = await health.json();
for (const k of ["openai", "elevenlabs", "n8n"]) {
  if (typeof h[k] !== "boolean") fail(`/api/health.${k} must be a boolean (never return key values), got ${typeof h[k]}`);
}
console.log(`health ok  keys: openai=${h.openai} elevenlabs=${h.elevenlabs} n8n=${h.n8n} model=${h.model}`);

const res = await fetch(`${base}/api/agent`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ prompt: "Smoke test: port strike disrupting container shipments", demoMode: true, requireApproval: true }),
  signal: AbortSignal.timeout(90_000),
}).catch((e) => fail(`/api/agent unreachable: ${e.message}`));
if (!res.ok) fail(`/api/agent returned ${res.status}: ${await res.text()}`);
if (!(res.headers.get("content-type") ?? "").includes("text/event-stream")) fail("/api/agent is not text/event-stream");

const events = [];
let buf = "";
const dec = new TextDecoder();
for await (const chunk of res.body) {
  buf += dec.decode(chunk, { stream: true });
  let i;
  while ((i = buf.indexOf("\n\n")) !== -1) {
    const frame = buf.slice(0, i);
    buf = buf.slice(i + 2);
    const ev = /^event: (.+)$/m.exec(frame)?.[1];
    const data = /^data: (.+)$/m.exec(frame)?.[1];
    if (ev && data) events.push({ ev, data: JSON.parse(data) });
  }
}

const steps = events.filter((e) => e.ev === "step");
const types = new Set(steps.map((s) => s.data.type));
const err = events.find((e) => e.ev === "error");
const del = events.find((e) => e.ev === "deliverable")?.data;
const done = events.find((e) => e.ev === "done")?.data;

if (err) fail(`error event: ${err.data.message}`);
if (steps.length < 3) fail(`expected >= 3 trace steps, got ${steps.length}`);
for (const t of ["planner", "tool_call", "verifier"]) if (!types.has(t)) fail(`trace is missing a "${t}" step`);
if (!del) fail("no deliverable event");
if (done?.mode !== "demo") fail(`expected done.mode "demo", got ${JSON.stringify(done)}`);

const bi = del.businessImpact ?? {};
for (const k of ["hoursSavedPerMonth", "annualCostSavingsEur", "confidenceScore", "automationRatePct"]) {
  if (typeof bi[k] !== "number" || !Number.isFinite(bi[k])) fail(`businessImpact.${k} is not a finite number`);
}
if (!del.executiveSummary || !del.voiceBriefingScript) fail("deliverable missing executiveSummary or voiceBriefingScript");
if (!del.strategicRecommendations?.length) fail("deliverable has no strategicRecommendations");
if (!del.riskAndTradeoffs?.length) fail("deliverable has no riskAndTradeoffs (jury criterion: risks + mitigations on every output)");
if (!del.n8nActionTriggered?.workflowName) fail("deliverable missing n8nActionTriggered");

console.log(
  `PASS  ${steps.length} steps [${[...types].join(", ")}]  ` +
    `${bi.hoursSavedPerMonth} h/mo  EUR ${bi.annualCostSavingsEur}/yr  conf ${bi.confidenceScore}  ` +
    `n8n=${del.n8nActionTriggered.status}`,
);
