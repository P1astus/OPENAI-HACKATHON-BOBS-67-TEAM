/**
 * npm run eval:triage — runs the real triage (rules + model) on labelled claims and prints
 * accuracy and every miss. Needs OPENAI_API_KEY (reads .env.local). Run it before the demo and
 * only put claims that pass into the demo script.
 */
import { triageClaim } from "../lib/agent/triage";
import type { Trade } from "../types";

type Case = { claim: string; trade: Trade | null; urgency?: "emergency" | "urgent" | "normal"; human?: boolean };

const CASES: Case[] = [
  { claim: "The heating is on but every radiator in my flat is cold.", trade: "heating", urgency: "urgent", human: false },
  { claim: "Meine Heizung geht seit gestern nicht mehr, es ist eiskalt.", trade: "heating", urgency: "urgent", human: false },
  { claim: "No hot water in the shower since this morning.", trade: "heating", human: false },
  { claim: "The kitchen tap keeps dripping, even when I close it firmly.", trade: "plumbing", urgency: "normal", human: false },
  { claim: "Das Waschbecken im Bad ist verstopft.", trade: "plumbing", human: false },
  { claim: "The toilet won't stop running.", trade: "plumbing", human: false },
  { claim: "I'm locked out, the key snapped in the front door lock.", trade: "locksmith", urgency: "urgent", human: false },
  { claim: "The front door lock is broken and the door doesn't lock anymore.", trade: "locksmith", human: false },
  { claim: "Two sockets in the living room have no power.", trade: "electrical", human: false },
  { claim: "Die Waschmaschine, die zur Wohnung gehört, pumpt das Wasser nicht ab.", trade: "appliances", human: false },
  { claim: "The bedroom window doesn't close properly and there's a draft.", trade: "windows_doors", human: false },
  { claim: "We have mice in the kitchen cupboards.", trade: "pest_control", human: false },
  { claim: "Water is coming through the ceiling of the top floor when it rains, I think the roof leaks.", trade: "roofing", human: false },
  { claim: "I smell gas in the kitchen.", trade: null, urgency: "emergency", human: true },
  { claim: "Wasserrohrbruch im Keller, alles steht unter Wasser!", trade: null, urgency: "emergency", human: true },
  { claim: "Sparks came out of the light switch.", trade: null, urgency: "emergency", human: true },
  { claim: "Strange smell from the wall in the hallway.", trade: null, human: true },
  { claim: "My neighbour plays loud music every night.", trade: null, human: true },
  { claim: "Something is wrong in the bathroom.", trade: null, human: true },
  { claim: "The window won't close and the dishwasher also leaks.", trade: null, human: true },
];

async function main() {
  if (!process.env.OPENAI_API_KEY) console.warn("OPENAI_API_KEY not set: you are testing the keyword fallback only.\n");
  let pass = 0;
  const latencies: number[] = [];
  for (const c of CASES) {
    const { triage: t, latency_ms, error } = await triageClaim(c.claim);
    latencies.push(latency_ms);
    // Emergencies: we only require urgency + human; the trade is irrelevant there.
    const tradeOk = c.urgency === "emergency" || t.trade === c.trade;
    const urgencyOk = !c.urgency || t.urgency === c.urgency;
    const humanOk = c.human === undefined || t.needs_human === c.human;
    const ok = tradeOk && urgencyOk && humanOk;
    if (ok) pass++;
    const mark = ok ? "✓" : "✗";
    console.log(`${mark} ${c.claim}`);
    if (!ok) {
      console.log(`    expected trade=${c.trade} urgency=${c.urgency ?? "any"} human=${c.human ?? "any"}`);
      console.log(`    got      trade=${t.trade} urgency=${t.urgency} human=${t.needs_human} conf=${t.confidence} src=${t.source}${error ? ` err=${error}` : ""}`);
    }
  }
  latencies.sort((a, b) => a - b);
  console.log(`\nAccuracy: ${pass}/${CASES.length} (${Math.round((pass / CASES.length) * 100)}%). Median latency ${latencies[Math.floor(latencies.length / 2)]} ms, max ${latencies.at(-1)} ms.`);
  if (pass < CASES.length) process.exitCode = 1;
}

void main();
