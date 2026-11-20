import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Data contracts. Interfaces are the source of truth for the UI; Zod  */
/* schemas validate everything that crosses the LLM / network boundary. */
/* ------------------------------------------------------------------ */

export type TraceStepType = "planner" | "tool_call" | "n8n_webhook" | "verifier";
export type TraceStatus = "running" | "completed" | "warning";

export interface TraceStep {
  id: string;
  stepNumber: number;
  title: string;
  type: TraceStepType;
  status: TraceStatus;
  durationMs: number;
  summary: string;
  rawInput?: unknown;
  rawOutput?: unknown;
}

export interface BusinessImpact {
  hoursSavedPerMonth: number;
  annualCostSavingsEur: number;
  confidenceScore: number;
  automationRatePct: number;
}

export type N8nStatus = "dispatched" | "pending_approval" | "simulated";

export interface Recommendation {
  title: string;
  action: string;
  priority: "High" | "Medium";
  expectedImpact: string;
}

export interface RiskItem {
  risk: string;
  mitigation: string;
}

export interface N8nAction {
  workflowName: string;
  status: N8nStatus;
  payloadSummary: string;
  rawPayload: Record<string, unknown>;
}

export interface AgentDeliverable {
  id: string;
  timestamp: string;
  scenarioTitle: string;
  executiveSummary: string;
  voiceBriefingScript: string;
  strategicRecommendations: Recommendation[];
  riskAndTradeoffs: RiskItem[];
  businessImpact: BusinessImpact;
  n8nActionTriggered: N8nAction;
}

/* ----------------------------- Zod schemas ----------------------------- */

export const TraceStepSchema = z.object({
  id: z.string(),
  stepNumber: z.number(),
  title: z.string(),
  type: z.enum(["planner", "tool_call", "n8n_webhook", "verifier"]),
  status: z.enum(["running", "completed", "warning"]),
  durationMs: z.number(),
  summary: z.string(),
  rawInput: z.unknown().optional(),
  rawOutput: z.unknown().optional(),
});

export const BusinessImpactSchema = z.object({
  hoursSavedPerMonth: z.number(),
  annualCostSavingsEur: z.number(),
  confidenceScore: z.number().min(0).max(100),
  automationRatePct: z.number().min(0).max(100),
});

export const RecommendationSchema = z.object({
  title: z.string().min(1),
  action: z.string().min(1),
  priority: z.enum(["High", "Medium"]),
  expectedImpact: z.string().min(1),
});

export const RiskItemSchema = z.object({
  risk: z.string().min(1),
  mitigation: z.string().min(1),
});

export const N8nActionSchema = z.object({
  workflowName: z.string(),
  status: z.enum(["dispatched", "pending_approval", "simulated"]),
  payloadSummary: z.string(),
  rawPayload: z.record(z.string(), z.unknown()),
});

export const AgentDeliverableSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  scenarioTitle: z.string(),
  executiveSummary: z.string(),
  voiceBriefingScript: z.string(),
  strategicRecommendations: z.array(RecommendationSchema),
  riskAndTradeoffs: z.array(RiskItemSchema),
  businessImpact: BusinessImpactSchema,
  n8nActionTriggered: N8nActionSchema,
});

/** What the LLM is asked to write in the final synthesis call (numbers + n8n result come from tools). */
export const SynthesisSchema = z.object({
  scenarioTitle: z.string().min(1),
  executiveSummary: z.string().min(1),
  voiceBriefingScript: z.string().min(1),
  strategicRecommendations: z.array(RecommendationSchema).min(1).max(6),
  riskAndTradeoffs: z.array(RiskItemSchema).default([]),
});
export type Synthesis = z.infer<typeof SynthesisSchema>;

/* ------------------------------ Transport ------------------------------ */

export interface AgentRequest {
  prompt: string;
  scenarioTitle?: string;
  demoMode: boolean;
  requireApproval: boolean;
}

export const AgentRequestSchema = z.object({
  prompt: z.string().min(1).max(60_000),
  scenarioTitle: z.string().max(200).optional(),
  demoMode: z.boolean().default(false),
  requireApproval: z.boolean().default(true),
});

export type StreamEvent =
  | { event: "step"; data: TraceStep }
  | { event: "deliverable"; data: AgentDeliverable }
  | { event: "error"; data: { message: string } }
  | { event: "done"; data: { mode: "live" | "demo" } };

export interface HealthStatus {
  openai: boolean;
  elevenlabs: boolean;
  n8n: boolean;
  model: string;
}

/** A completed run as persisted in localStorage "Recent Runs". */
export interface RunRecord {
  deliverable: AgentDeliverable;
  trace: TraceStep[];
  executionMs: number;
  mode: "live" | "demo";
}
