import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { Property, Trade, Triage, Unit } from "../../types";
import { TRADES, tradeSchema } from "../schemas";

export const CONFIDENCE_THRESHOLD = 0.7;
const MODEL_TIMEOUT_MS = 10_000;
const DEFAULT_MODEL = "gpt-5.5";

// ---------------------------------------------------------------------------
// 1. Safety rules: run before any model. A model must never be the only thing
//    between a gas leak and a person.
// ---------------------------------------------------------------------------
const EMERGENCY_RULES: { label: string; pattern: RegExp }[] = [
  { label: "gas", pattern: /\bgas\b|gasgeruch|riecht nach gas|smell(?:s)? of gas|gas smell|gas leak/i },
  { label: "water emergency", pattern: /\bflood(?:ed|ing)?\b|wasserrohrbruch|water everywhere|ceiling (?:is )?dripping|überschwemm|burst pipe|pipe burst/i },
  { label: "fire or smoke", pattern: /\bfire\b|\bsmoke\b(?! (?:detector|alarm))|smoking socket|\bfeuer\b|\brauch\b|\bbrennt\b/i },
  { label: "sparks or burning smell", pattern: /\bsparks?\b|sparking|burning smell|smell(?:s)? (?:of )?burning|funken|verbrannt|brandgeruch|schmorgeruch/i },
  { label: "no power in the whole flat", pattern: /no power (?:in|for) the (?:whole|entire) (?:flat|apartment)|stromausfall/i },
];

export function emergencyHit(claim: string): string | null {
  return EMERGENCY_RULES.find((r) => r.pattern.test(claim))?.label ?? null;
}

// Fallback trade guess when the model is unavailable. Order matters: first hit wins.
const TRADE_KEYWORDS: [Trade, RegExp][] = [
  ["heating", /heat|heizung|radiator|heizkörper|boiler|therme|warm water|hot water|warmwasser/i],
  ["plumbing", /\btap\b|faucet|leak|drip|drain|toilet|\bklo\b|abfluss|wasserhahn|rohr|pipe|sink|shower|dusche/i],
  ["electrical", /electric|socket|outlet|fuse|\bstrom|steckdose|sicherung|light switch|lichtschalter/i],
  ["locksmith", /\block|locked|\bkey\b|schloss|schlüssel|ausgesperrt/i],
  ["appliances", /washing machine|dishwasher|fridge|oven|stove|waschmaschine|spülmaschine|geschirrspüler|kühlschrank|herd/i],
  ["windows_doors", /window|door|fenster|\btür|rollladen|shutter/i],
  ["pest_control", /\bpest|mice|\bmouse|rats?\b|wasps?|cockroach|bedbug|mäuse|ratten|wespen|schaben/i],
  ["roofing", /\broof|\bdach/i],
];

export function keywordTrade(claim: string): Trade | null {
  return TRADE_KEYWORDS.find(([, re]) => re.test(claim))?.[0] ?? null;
}

// ---------------------------------------------------------------------------
// 2. Model call with structured outputs.
// ---------------------------------------------------------------------------
const modelOutput = z.object({
  trade: tradeSchema.nullable().describe("Exactly one trade, or null if unclear, mixed or not a repair."),
  urgency: z.enum(["emergency", "urgent", "normal"]),
  confidence: z.number().min(0).max(1).describe("How sure you are about the trade, 0..1. Be honest."),
  summary: z.string().max(200).describe("One neutral sentence for the company and owner. No names or contact details."),
  is_repair: z.boolean().describe("False if the report is not a repair request at all."),
});
export type ModelOutput = z.infer<typeof modelOutput>;

const SYSTEM_PROMPT = `You triage repair reports from tenants for a German property manager (reltix).
Tenants write in English or German. For each report decide:
- trade: exactly one of ${TRADES.join(", ")}, or null when the report is vague, mixes several unrelated problems, or is not a repair.
- urgency: "emergency" for danger to people or the building (gas, flooding, fire, sparks); "urgent" when the flat is barely usable (no heating in winter, no hot water, toilet unusable, locked out, front door won't lock); otherwise "normal". It is winter now.
- confidence: your honest probability that the trade is right. Use below 0.5 when you are guessing.
- summary: one neutral sentence describing the problem for the repair company. Never include names, phone numbers, emails or flat numbers.
- is_repair: false for complaints that are not repairs (noise, neighbours, rent, cleaning).
Do not invent details that are not in the report.`;

const FEW_SHOTS: { claim: string; out: ModelOutput }[] = [
  { claim: "Die Heizung im Wohnzimmer bleibt kalt, obwohl das Thermostat auf 5 steht.", out: { trade: "heating", urgency: "urgent", confidence: 0.95, summary: "Living room radiator stays cold although the thermostat is on its highest setting.", is_repair: true } },
  { claim: "No hot water since this morning, the boiler shows error F28.", out: { trade: "heating", urgency: "urgent", confidence: 0.9, summary: "No hot water; the boiler displays error F28.", is_repair: true } },
  { claim: "The toilet keeps running and won't stop filling.", out: { trade: "plumbing", urgency: "normal", confidence: 0.93, summary: "Toilet cistern keeps running and does not stop filling.", is_repair: true } },
  { claim: "I locked myself out, the key broke off in the lock.", out: { trade: "locksmith", urgency: "urgent", confidence: 0.95, summary: "Key broke off in the front door lock; tenant is locked out.", is_repair: true } },
  { claim: "Half of the sockets in the kitchen stopped working after the fuse tripped.", out: { trade: "electrical", urgency: "normal", confidence: 0.9, summary: "Several kitchen sockets dead after a tripped fuse.", is_repair: true } },
  { claim: "Strange smell coming from the wall in the bedroom.", out: { trade: null, urgency: "normal", confidence: 0.3, summary: "Unidentified smell from a bedroom wall.", is_repair: true } },
  { claim: "My neighbour is really loud every night.", out: { trade: null, urgency: "normal", confidence: 0.9, summary: "Noise complaint about a neighbour, not a repair.", is_repair: false } },
  { claim: "The window in the bathroom doesn't close anymore and the tap drips too.", out: { trade: null, urgency: "normal", confidence: 0.4, summary: "Bathroom window does not close and a tap drips: two separate problems.", is_repair: true } },
];

let openai: OpenAI | null | undefined;
function client(): OpenAI | null {
  if (openai !== undefined) return openai;
  openai = process.env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: MODEL_TIMEOUT_MS, maxRetries: 0 })
    : null;
  return openai;
}

export type TriageContext = { unit?: Pick<Unit, "floor" | "label">; property?: Pick<Property, "heating" | "building_year"> };

async function callModel(claim: string, ctx: TriageContext): Promise<ModelOutput> {
  const c = client();
  if (!c) throw new Error("OPENAI_API_KEY not set");
  const context = [
    ctx.property && `Building: built ${ctx.property.building_year}, heating: ${ctx.property.heating}.`,
    ctx.unit && `Flat on floor ${ctx.unit.floor}.`,
  ].filter(Boolean).join(" ");

  const response = await c.responses.parse({
    model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
    instructions: SYSTEM_PROMPT,
    input: [
      ...FEW_SHOTS.flatMap(({ claim: q, out }) => [
        { role: "user" as const, content: `Report: ${q}` },
        { role: "assistant" as const, content: JSON.stringify(out) },
      ]),
      { role: "user" as const, content: `${context ? `${context}\n` : ""}Report: ${claim}` },
    ],
    text: { format: zodTextFormat(modelOutput, "triage") },
  }, { signal: AbortSignal.timeout(MODEL_TIMEOUT_MS) });

  // Validate again ourselves: never trust model output blindly.
  return modelOutput.parse(response.output_parsed);
}

// ---------------------------------------------------------------------------
// 3 + 4. Decide in code, not in the prompt.
// ---------------------------------------------------------------------------
export function decide(t: Omit<Triage, "needs_human" | "reason">, extra?: string): Triage {
  const reasons: string[] = [];
  if (t.urgency === "emergency") reasons.push("Possible emergency: the property manager must handle this.");
  if (t.trade === null) reasons.push(extra ?? "Couldn't tell which trade this needs.");
  else if (t.confidence < CONFIDENCE_THRESHOLD) reasons.push(`Not sure about the trade (confidence ${t.confidence.toFixed(2)} < ${CONFIDENCE_THRESHOLD}).`);
  return { ...t, needs_human: reasons.length > 0, reason: reasons.join(" ") };
}

export type TriageResult = { triage: Triage; latency_ms: number; error?: string };

export async function triageClaim(claim: string, ctx: TriageContext = {}): Promise<TriageResult> {
  const started = Date.now();
  const done = (triage: Triage, error?: string): TriageResult => {
    const latency_ms = Date.now() - started;
    // Never log the claim text or any key at info level.
    console.info(JSON.stringify({ at: "triage", claim_length: claim.length, trade: triage.trade, confidence: triage.confidence, urgency: triage.urgency, source: triage.source, latency_ms, error }));
    return { triage, latency_ms, error };
  };

  const hit = emergencyHit(claim);
  if (hit) {
    return done(decide({
      trade: keywordTrade(claim), urgency: "emergency", confidence: 1, source: "rules",
      summary: `Possible emergency (${hit}) reported by the tenant.`,
    }));
  }

  try {
    const out = await callModel(claim, ctx);
    return done(decide(
      { trade: out.is_repair ? out.trade : null, urgency: out.urgency, confidence: out.confidence, summary: out.summary, source: "model" },
      out.is_repair ? undefined : "This doesn't look like a repair request.",
    ));
  } catch (error) {
    const trade = keywordTrade(claim);
    const message = error instanceof Error ? error.name + ": " + error.message.slice(0, 120) : "unknown";
    const triage = decide({
      trade, urgency: "normal", confidence: 0.4, source: "rules",
      summary: trade ? `Reported ${trade.replaceAll("_", " ")} problem (automatic keyword guess).` : "Repair details are unclear.",
    });
    // Rules fallback always goes to a human, and says why.
    triage.needs_human = true;
    triage.reason = `AI triage unavailable, keyword guess only. ${triage.reason}`.trim();
    return done(triage, message);
  }
}
