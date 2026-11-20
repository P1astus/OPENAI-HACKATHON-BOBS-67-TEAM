import { z } from "zod";
import type { RiskItem } from "@/types/agent";

/**
 * DOMAIN CALCULATORS (owner: feat/domain-presets).
 * Deterministic ROI formula and verifier checks. The LLM never invents these numbers: tool results
 * flow straight into BusinessImpact. Change formulas/thresholds here after the challenge reveal.
 */

/* ------------------------------------------------------------------ */
/* Tool 1: deterministic ROI calculator                                */
/* ------------------------------------------------------------------ */

const RoiArgsSchema = z.object({
  monthly_volume: z.coerce.number().min(0).max(10_000_000),
  minutes_per_item: z.coerce.number().min(0).max(100_000),
  loaded_hourly_cost_eur: z.coerce.number().min(0).max(10_000),
  automation_rate_pct: z.coerce.number().min(0).max(100),
  avoided_monthly_loss_eur: z.coerce.number().min(0).max(1_000_000_000).default(0),
  assumptions: z.array(z.string()).default([]),
});

export interface RoiResult {
  hoursSavedPerMonth: number;
  annualCostSavingsEur: number;
  automationRatePct: number;
  formula: string;
  assumptions: string[];
}

export function calculateBusinessRoi(raw: unknown): RoiResult {
  const a = RoiArgsSchema.parse(raw);
  const hoursSaved = ((a.monthly_volume * a.minutes_per_item) / 60) * (a.automation_rate_pct / 100);
  const monthlyValue = hoursSaved * a.loaded_hourly_cost_eur + a.avoided_monthly_loss_eur;
  return {
    hoursSavedPerMonth: Math.round(hoursSaved),
    annualCostSavingsEur: Math.round(monthlyValue * 12),
    automationRatePct: Math.round(a.automation_rate_pct),
    formula:
      "hours = volume x minutes/60 x automation%; annual EUR = (hours x hourly cost + avoided monthly loss) x 12",
    assumptions: a.assumptions,
  };
}

/* ------------------------------------------------------------------ */
/* Tool 2: self-critique / grounding verifier                          */
/* ------------------------------------------------------------------ */

const VerifyArgsSchema = z.object({
  recommendations: z
    .array(
      z.object({
        title: z.string().default(""),
        action: z.string().default(""),
        priority: z.string().default("Medium"),
        expected_impact: z.string().optional(),
      }),
    )
    .min(1),
  constraints: z.array(z.string()).default([]),
  automation_rate_pct: z.coerce.number().min(0).max(100).default(0),
  candidate_risks: z
    .array(z.object({ risk: z.string(), mitigation: z.string().default("") }))
    .default([]),
});

export interface VerificationResult {
  confidenceScore: number;
  checks: Array<{ check: string; passed: boolean; note: string }>;
  tradeoffs: RiskItem[];
  verdict: string;
}

const TIME_BOUND = /(\d|today|tonight|tomorrow|week|hour|day|month|before|within|by end|end of)/i;

function significantWords(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 5);
}

export function verifyAndGroundOutput(raw: unknown, requireApproval: boolean): VerificationResult {
  const a = VerifyArgsSchema.parse(raw);
  const checks: VerificationResult["checks"] = [];
  let confidence = 93;

  // 1. Concrete, time-bound actions
  const vague = a.recommendations.filter((r) => r.action.length < 40 || !TIME_BOUND.test(r.action));
  checks.push({
    check: "Actions are concrete and time-bound",
    passed: vague.length === 0,
    note:
      vague.length === 0
        ? "All recommendations name a concrete action and timeframe."
        : `${vague.length} recommendation(s) lack a concrete timeframe: ${vague.map((v) => v.title).join("; ")}`,
  });
  confidence -= vague.length * 6;

  // 2. Prioritisation focus
  const highCount = a.recommendations.filter((r) => r.priority === "High").length;
  checks.push({
    check: "Priority focus (<= 3 High-priority items)",
    passed: highCount <= 3,
    note: `${highCount} High-priority item(s).`,
  });
  if (highCount > 3) confidence -= 5;

  // 3. Operational-constraint coverage
  const corpus = [
    ...a.recommendations.map((r) => `${r.title} ${r.action} ${r.expected_impact ?? ""}`),
    ...a.candidate_risks.map((r) => `${r.risk} ${r.mitigation}`),
  ]
    .join(" ")
    .toLowerCase();
  const uncovered = a.constraints.filter((c) => {
    const words = significantWords(c);
    return words.length > 0 && !words.some((w) => corpus.includes(w));
  });
  const covered = a.constraints.length - uncovered.length;
  checks.push({
    check: "Operational constraints addressed",
    passed: uncovered.length === 0,
    note:
      a.constraints.length === 0
        ? "No explicit constraints supplied; applied default governance checks."
        : uncovered.length === 0
          ? `All ${a.constraints.length} constraint(s) are reflected in the plan.`
          : `${covered}/${a.constraints.length} constraints covered. Not clearly addressed: ${uncovered.join("; ")}`,
  });
  confidence -= uncovered.length * 5;

  // 4. Automation realism
  const rate = a.automation_rate_pct;
  checks.push({
    check: "Automation rate is realistic",
    passed: rate <= 85,
    note:
      rate > 85
        ? `${rate}% automation is aggressive; keep human oversight for edge cases.`
        : `${rate}% automation leaves headroom for human review.`,
  });
  if (rate > 85) confidence -= 10;
  else if (rate > 70) confidence -= 3;

  // 5. Risks carry mitigations
  const mitigated = a.candidate_risks.filter((r) => r.mitigation.trim().length > 0).length;
  checks.push({
    check: "Risks are paired with mitigations",
    passed: mitigated >= 2,
    note: `${mitigated} risk(s) with mitigations.`,
  });
  if (mitigated < 2) confidence -= 8;

  // 6. Impact quantified
  const unquantified = a.recommendations.filter((r) => !/\d/.test(r.expected_impact ?? "")).length;
  checks.push({
    check: "Expected impact is quantified",
    passed: unquantified === 0,
    note:
      unquantified === 0
        ? "Every recommendation carries a quantified impact."
        : `${unquantified} recommendation(s) lack a number.`,
  });
  confidence -= unquantified * 2;

  // Trade-offs: model's candidate risks + governance-aware additions
  const tradeoffs: RiskItem[] = a.candidate_risks
    .filter((r) => r.risk.trim())
    .map((r) => ({
      risk: r.risk.trim(),
      mitigation: r.mitigation.trim() || "Assign an owner and review at the next checkpoint.",
    }));
  tradeoffs.push(
    requireApproval
      ? {
          risk: "Speed vs. control: the human approval gate delays dispatch",
          mitigation: "Approver on call; payload pre-validated so approval is a single click.",
        }
      : {
          risk: "Auto-dispatch executes without a human sign-off",
          mitigation: "Workflow is idempotent and logged; switch to Human-in-the-Loop for irreversible actions.",
        },
  );
  if (rate > 70) {
    tradeoffs.push({
      risk: "High automation rate reduces human oversight of edge cases",
      mitigation: "Confidence thresholds with escalation to a human reviewer plus periodic sample audits.",
    });
  }
  const seen = new Set<string>();
  const dedup = tradeoffs.filter((t) => {
    const k = t.risk.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const score = Math.max(48, Math.min(97, Math.round(confidence)));
  const failed = checks.filter((c) => !c.passed).length;
  return {
    confidenceScore: score,
    checks,
    tradeoffs: dedup.slice(0, 5),
    verdict:
      failed === 0
        ? "Plan is grounded in the stated constraints."
        : `${failed} check(s) flagged; confidence reduced accordingly.`,
  };
}

