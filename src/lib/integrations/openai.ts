import OpenAI from "openai";
import { z } from "zod";
import {
  SynthesisSchema,
  type AgentDeliverable,
  type AgentRequest,
  type N8nAction,
  type StreamEvent,
  type TraceStep,
  type TraceStepType,
} from "@/types/agent";
import { dispatchToN8n } from "@/lib/integrations/n8n";
import {
  calculateBusinessRoi,
  verifyAndGroundOutput,
  type RoiResult,
  type VerificationResult,
} from "@/lib/domain/calculators";
import {
  pickDemoScenario,
  SYSTEM_PROMPT,
  SYNTHESIS_INSTRUCTIONS,
  type DemoScenario,
} from "@/lib/domain/presets";

/**
 * OpenAI agent orchestration (owner: feat/agent-core).
 * Domain-specific parts live in src/lib/domain/: prompts + demo scenarios (presets.ts) and the
 * deterministic ROI formula + verifier checks (calculators.ts). This file only wires tools, the
 * tool-calling loop, structured synthesis, SSE tracing and Stage Demo playback.
 */

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */

export const DEMO_STEP_DELAY_MS = 350;
const MAX_AGENT_TURNS = 6;

export function hasOpenAIKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}
export function getModel(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o";
}

/* ------------------------------------------------------------------ */
/* Tool 3: n8n workflow — dispatch now or stage for human approval     */
/* ------------------------------------------------------------------ */

const N8nArgsSchema = z.object({
  workflow_name: z.string().min(1).default("ops-automation"),
  payload_summary: z.string().default(""),
  payload: z.record(z.string(), z.unknown()).default({}),
});

interface RunContext {
  requireApproval: boolean;
  scenarioTitle: string;
  roi?: RoiResult;
  verification?: VerificationResult;
  n8n?: N8nAction;
}

async function prepareOrExecuteN8nWorkflow(
  raw: unknown,
  ctx: RunContext,
): Promise<{ action: N8nAction; dispatch?: unknown }> {
  const a = N8nArgsSchema.parse(raw);
  const rawPayload: Record<string, unknown> = {
    ...a.payload,
    scenario: ctx.scenarioTitle,
    impact: ctx.roi
      ? {
          hoursSavedPerMonth: ctx.roi.hoursSavedPerMonth,
          annualCostSavingsEur: ctx.roi.annualCostSavingsEur,
        }
      : undefined,
    confidenceScore: ctx.verification?.confidenceScore,
    governance: ctx.requireApproval ? "human_in_the_loop" : "auto_dispatch",
  };

  if (ctx.requireApproval) {
    return {
      action: {
        workflowName: a.workflow_name,
        status: "pending_approval",
        payloadSummary: a.payload_summary,
        rawPayload,
      },
    };
  }

  const res = await dispatchToN8n(a.workflow_name, rawPayload);
  return {
    action: {
      workflowName: a.workflow_name,
      status: res.status,
      payloadSummary: a.payload_summary,
      rawPayload,
    },
    dispatch: res,
  };
}

/* ------------------------------------------------------------------ */
/* Tool registry (OpenAI function-calling schemas)                     */
/* ------------------------------------------------------------------ */

type ToolName =
  | "calculate_business_roi"
  | "verify_and_ground_output"
  | "prepare_or_execute_n8n_workflow";

const TOOL_META: Record<ToolName, { type: TraceStepType; title: string }> = {
  calculate_business_roi: { type: "tool_call", title: "Tool: calculate_business_roi" },
  verify_and_ground_output: { type: "verifier", title: "Verifier: verify_and_ground_output" },
  prepare_or_execute_n8n_workflow: { type: "n8n_webhook", title: "n8n: prepare_or_execute_workflow" },
};

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "calculate_business_roi",
      description:
        "Deterministic operational/financial impact calculator. Returns monthly hours saved, annual EUR savings and automation rate. Estimate inputs from the brief.",
      parameters: {
        type: "object",
        properties: {
          monthly_volume: { type: "number", description: "Items/tickets/shipments handled per month." },
          minutes_per_item: { type: "number", description: "Manual minutes spent per item today." },
          loaded_hourly_cost_eur: { type: "number", description: "Fully loaded labour cost per hour in EUR." },
          automation_rate_pct: { type: "number", description: "Share of work (0-100) that can be automated." },
          avoided_monthly_loss_eur: {
            type: "number",
            description: "Monthly EUR of avoided penalties/churn/errors (0 if none).",
          },
          assumptions: { type: "array", items: { type: "string" }, description: "Key assumptions behind the inputs." },
        },
        required: ["monthly_volume", "minutes_per_item", "loaded_hourly_cost_eur", "automation_rate_pct"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "verify_and_ground_output",
      description:
        "Self-critique step. Checks draft recommendations against the operational constraints, assigns a confidenceScore (0-100) and returns explicit trade-offs.",
      parameters: {
        type: "object",
        properties: {
          recommendations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                action: { type: "string" },
                priority: { type: "string", enum: ["High", "Medium"] },
                expected_impact: { type: "string" },
              },
              required: ["title", "action", "priority"],
            },
          },
          constraints: { type: "array", items: { type: "string" }, description: "Operational constraints from the brief." },
          automation_rate_pct: { type: "number" },
          candidate_risks: {
            type: "array",
            items: {
              type: "object",
              properties: { risk: { type: "string" }, mitigation: { type: "string" } },
              required: ["risk", "mitigation"],
            },
          },
        },
        required: ["recommendations", "constraints", "automation_rate_pct", "candidate_risks"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "prepare_or_execute_n8n_workflow",
      description:
        "Dispatches the structured action payload to the n8n workflow (auto-dispatch mode) or stages it as pending_approval for human sign-off (governance mode).",
      parameters: {
        type: "object",
        properties: {
          workflow_name: { type: "string", description: "kebab-case workflow name, e.g. tms-reroute-and-notify." },
          payload_summary: { type: "string", description: "One sentence describing what the workflow will do." },
          payload: { type: "object", description: "Structured JSON payload consumed by the n8n workflow.", additionalProperties: true },
        },
        required: ["workflow_name", "payload_summary", "payload"],
        additionalProperties: false,
      },
    },
  },
];

function toolsFor(done: Set<ToolName>): OpenAI.Chat.Completions.ChatCompletionTool[] {
  const pre = ["calculate_business_roi", "verify_and_ground_output"] as const;
  const preDone = pre.every((t) => done.has(t));
  return TOOLS.filter((t) => {
    if (t.type !== "function") return false;
    const name = t.function.name as ToolName;
    if (done.has(name)) return false;
    // n8n only becomes available after ROI + verification, so the payload is grounded.
    if (name === "prepare_or_execute_n8n_workflow") return preDone;
    return true;
  });
}

/* ------------------------------------------------------------------ */
/* Trace helper                                                        */
/* ------------------------------------------------------------------ */

export type Emit = (e: StreamEvent) => void | Promise<void>;

class Tracer {
  private n = 0;
  private open = new Map<string, TraceStep>();
  constructor(private emit: Emit) {}

  /** Close any step still "running" (e.g. an API call that threw) so the UI never shows a stuck spinner. */
  async closeOpen(summary: string) {
    for (const step of [...this.open.values()]) {
      this.open.delete(step.id);
      await this.emit({ event: "step", data: { ...step, status: "warning", summary } });
    }
  }

  async start(type: TraceStepType, title: string, rawInput?: unknown) {
    const step: TraceStep = {
      id: crypto.randomUUID(),
      stepNumber: ++this.n,
      title,
      type,
      status: "running",
      durationMs: 0,
      summary: "Running…",
      rawInput,
    };
    const t0 = Date.now();
    this.open.set(step.id, step);
    await this.emit({ event: "step", data: step });
    return {
      finish: async (
        status: "completed" | "warning",
        summary: string,
        rawOutput?: unknown,
        durationMsOverride?: number,
      ) => {
        this.open.delete(step.id);
        await this.emit({
          event: "step",
          data: {
            ...step,
            status,
            summary,
            rawOutput,
            durationMs: durationMsOverride ?? Date.now() - t0,
          },
        });
      },
    };
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      resolve();
    });
  });
}

const fmt = (n: number) => n.toLocaleString("en-US");

/* ------------------------------------------------------------------ */
/* Tool execution (shared by live + demo paths)                        */
/* ------------------------------------------------------------------ */

interface ToolOutcome {
  output: unknown;
  status: "completed" | "warning";
  summary: string;
}

async function executeTool(name: ToolName, args: unknown, ctx: RunContext): Promise<ToolOutcome> {
  try {
    switch (name) {
      case "calculate_business_roi": {
        const roi = calculateBusinessRoi(args);
        ctx.roi = roi;
        return {
          output: roi,
          status: "completed",
          summary: `${fmt(roi.hoursSavedPerMonth)} h/month saved · EUR ${fmt(roi.annualCostSavingsEur)}/yr · ${roi.automationRatePct}% automation`,
        };
      }
      case "verify_and_ground_output": {
        const v = verifyAndGroundOutput(args, ctx.requireApproval);
        ctx.verification = v;
        const failed = v.checks.filter((c) => !c.passed).length;
        return {
          output: v,
          status: failed > 0 || v.confidenceScore < 80 ? "warning" : "completed",
          summary: `Confidence ${v.confidenceScore}% · ${v.checks.length - failed}/${v.checks.length} checks passed · ${v.tradeoffs.length} trade-offs`,
        };
      }
      case "prepare_or_execute_n8n_workflow": {
        const { action, dispatch } = await prepareOrExecuteN8nWorkflow(args, ctx);
        ctx.n8n = action;
        const label =
          action.status === "pending_approval"
            ? "Staged for human approval"
            : action.status === "dispatched"
              ? "Dispatched to n8n"
              : "Dispatch simulated (n8n unreachable or not configured)";
        return {
          output: { ...action, dispatch },
          status: action.status === "simulated" && !ctx.requireApproval ? "warning" : "completed",
          summary: `${label}: ${action.workflowName}`,
        };
      }
    }
  } catch (err) {
    const msg = err instanceof z.ZodError ? err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") : String(err);
    return { output: { error: `Invalid tool arguments — ${msg}` }, status: "warning", summary: `Tool error: ${msg.slice(0, 160)}` };
  }
}

/* ------------------------------------------------------------------ */
/* Deliverable assembly                                                */
/* ------------------------------------------------------------------ */

function assemble(
  synth: z.infer<typeof SynthesisSchema>,
  ctx: RunContext,
  req: AgentRequest,
): AgentDeliverable {
  const roi = ctx.roi;
  const ver = ctx.verification;
  const n8n: N8nAction = ctx.n8n ?? {
    workflowName: "none",
    status: req.requireApproval ? "pending_approval" : "simulated",
    payloadSummary: "No workflow was prepared.",
    rawPayload: {},
  };
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    scenarioTitle: req.scenarioTitle?.trim() || synth.scenarioTitle,
    executiveSummary: synth.executiveSummary,
    voiceBriefingScript: synth.voiceBriefingScript,
    strategicRecommendations: synth.strategicRecommendations,
    riskAndTradeoffs: ver?.tradeoffs.length ? ver.tradeoffs : synth.riskAndTradeoffs,
    businessImpact: {
      hoursSavedPerMonth: roi?.hoursSavedPerMonth ?? 0,
      annualCostSavingsEur: roi?.annualCostSavingsEur ?? 0,
      confidenceScore: ver?.confidenceScore ?? 60,
      automationRatePct: roi?.automationRatePct ?? 0,
    },
    n8nActionTriggered: n8n,
  };
}

/* ------------------------------------------------------------------ */
/* Stage Demo Mode: timed, realistic simulation (real deterministic tools) */
/* ------------------------------------------------------------------ */

async function runDemo(req: AgentRequest, tracer: Tracer, signal?: AbortSignal): Promise<AgentDeliverable> {
  const { title, demo } = pickDemoScenario(req.prompt, req.scenarioTitle);
  const ctx: RunContext = { requireApproval: req.requireApproval, scenarioTitle: title };
  const d: DemoScenario = demo;

  // 1. planner
  let s = await tracer.start("planner", "Planner: decomposing objective & selecting tools", {
    model: "gpt-4o (stage demo)",
    promptChars: req.prompt.length,
    tools: ["calculate_business_roi", "verify_and_ground_output", "prepare_or_execute_n8n_workflow"],
  });
  await sleep(DEMO_STEP_DELAY_MS, signal);
  await s.finish("completed", d.plan, { simulated: true, plan: d.plan }, 842);

  // 2. ROI tool
  const roiArgs = {
    monthly_volume: d.roi.monthlyVolume,
    minutes_per_item: d.roi.minutesPerItem,
    loaded_hourly_cost_eur: d.roi.loadedHourlyCostEur,
    automation_rate_pct: d.roi.automationRatePct,
    avoided_monthly_loss_eur: d.roi.avoidedMonthlyLossEur,
    assumptions: d.roi.assumptions,
  };
  s = await tracer.start("tool_call", TOOL_META.calculate_business_roi.title, roiArgs);
  await sleep(DEMO_STEP_DELAY_MS, signal);
  const roiOut = await executeTool("calculate_business_roi", roiArgs, ctx);
  await s.finish(roiOut.status, roiOut.summary, roiOut.output, 14);

  // 3. planner reviews
  s = await tracer.start("planner", "Planner: reviewing ROI, drafting recommendations", {
    toolResult: "calculate_business_roi",
  });
  await sleep(DEMO_STEP_DELAY_MS, signal);
  await s.finish(
    "completed",
    `Drafted ${d.recommendations.length} recommendations and ${d.risks.length} candidate risks; routing to verifier.`,
    { simulated: true, recommendationTitles: d.recommendations.map((r) => r.title) },
    611,
  );

  // 4. verifier
  const verifyArgs = {
    recommendations: d.recommendations.map((r) => ({
      title: r.title,
      action: r.action,
      priority: r.priority,
      expected_impact: r.expectedImpact,
    })),
    constraints: d.constraints,
    automation_rate_pct: d.roi.automationRatePct,
    candidate_risks: d.risks,
  };
  s = await tracer.start("verifier", TOOL_META.verify_and_ground_output.title, verifyArgs);
  await sleep(DEMO_STEP_DELAY_MS, signal);
  const verOut = await executeTool("verify_and_ground_output", verifyArgs, ctx);
  await s.finish(verOut.status, verOut.summary, verOut.output, 38);

  // 5. n8n
  const n8nArgs = { workflow_name: d.workflowName, payload_summary: d.payloadSummary, payload: d.payload };
  s = await tracer.start("n8n_webhook", TOOL_META.prepare_or_execute_n8n_workflow.title, {
    ...n8nArgs,
    governance: req.requireApproval ? "human_in_the_loop" : "auto_dispatch",
  });
  await sleep(DEMO_STEP_DELAY_MS, signal);
  const t0 = Date.now();
  const n8nOut = await executeTool("prepare_or_execute_n8n_workflow", n8nArgs, ctx);
  await s.finish(n8nOut.status, n8nOut.summary, n8nOut.output, Math.max(Date.now() - t0, 212));

  // 6. synthesis
  s = await tracer.start("planner", "Planner: synthesizing structured executive deliverable", {
    response_format: "json_object",
    schema: "AgentDeliverable",
  });
  await sleep(DEMO_STEP_DELAY_MS, signal);
  const synth = SynthesisSchema.parse({
    scenarioTitle: title,
    executiveSummary: d.executiveSummary,
    voiceBriefingScript: d.voiceBriefingScript,
    strategicRecommendations: d.recommendations,
    riskAndTradeoffs: d.risks,
  });
  await s.finish(
    "completed",
    "Structured JSON validated against schema (zod) — deliverable ready.",
    { simulated: true, validated: true },
    1480,
  );

  return assemble(synth, ctx, { ...req, scenarioTitle: req.scenarioTitle ?? title });
}

/* ------------------------------------------------------------------ */
/* Live mode: real OpenAI tool-calling loop + structured final output  */
/* ------------------------------------------------------------------ */

type Msg = OpenAI.Chat.Completions.ChatCompletionMessageParam;

async function runLive(req: AgentRequest, tracer: Tracer, signal?: AbortSignal): Promise<AgentDeliverable> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 60_000, maxRetries: 1 });
  const model = getModel();
  const ctx: RunContext = {
    requireApproval: req.requireApproval,
    scenarioTitle: req.scenarioTitle?.trim() || "Operations brief",
  };
  const done = new Set<ToolName>();

  const messages: Msg[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `OPERATIONAL BRIEF${req.scenarioTitle ? ` — ${req.scenarioTitle}` : ""}:\n\n${req.prompt}\n\nGovernance mode: ${
        req.requireApproval ? "Human-in-the-Loop (stage n8n payload for approval)" : "Auto-dispatch to n8n"
      }.`,
    },
  ];

  for (let turn = 0; turn < MAX_AGENT_TURNS; turn++) {
    const available = toolsFor(done);
    if (available.length === 0) break;

    const planner = await tracer.start(
      "planner",
      turn === 0 ? "Planner: decomposing objective & selecting tools" : "Planner: reviewing results, selecting next tool",
      { model, turn: turn + 1, availableTools: available.map((t) => (t.type === "function" ? t.function.name : t.type)) },
    );

    const completion = await client.chat.completions.create(
      {
        model,
        messages,
        tools: available,
        tool_choice: "required",
        parallel_tool_calls: false,
      },
      { signal },
    );
    const msg = completion.choices[0]?.message;
    const calls = (msg?.tool_calls ?? []).filter((c) => c.type === "function");
    if (!msg || calls.length === 0) {
      await planner.finish("warning", "Model returned no tool call; retrying.", msg);
      continue;
    }
    await planner.finish(
      "completed",
      msg.content?.trim() ||
        `Selected tool: ${calls.map((c) => (c.type === "function" ? c.function.name : "")).join(", ")}`,
      { tool_calls: calls.map((c) => (c.type === "function" ? c.function.name : c.type)), usage: completion.usage },
    );

    messages.push({ role: "assistant", content: msg.content, tool_calls: msg.tool_calls });

    for (const call of msg.tool_calls ?? []) {
      if (call.type !== "function") {
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ error: "Unsupported tool type" }) });
        continue;
      }
      const name = call.function.name as ToolName;
      if (!(name in TOOL_META)) {
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ error: `Unknown tool ${name}` }) });
        continue;
      }
      let args: unknown = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        args = {};
      }
      const meta = TOOL_META[name];
      const step = await tracer.start(meta.type, meta.title, args);
      const outcome = await executeTool(name, args, ctx);
      await step.finish(outcome.status, outcome.summary, outcome.output);
      const errored = typeof outcome.output === "object" && outcome.output !== null && "error" in outcome.output;
      if (!errored) done.add(name);
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(outcome.output).slice(0, 8000) });
    }
  }

  // Safety net: if the model never completed a required tool, run it with grounded defaults.
  if (!ctx.roi || !ctx.verification || !ctx.n8n) {
    throw new Error("Model did not complete all required tools within the turn budget.");
  }

  // Final structured synthesis — json_object + zod validation (retry once on schema failure).
  const synthStep = await tracer.start("planner", "Planner: synthesizing structured executive deliverable", {
    response_format: "json_object",
    model,
  });
  messages.push({ role: "user", content: SYNTHESIS_INSTRUCTIONS });

  let synth: z.infer<typeof SynthesisSchema> | null = null;
  let lastError = "";
  for (let attempt = 0; attempt < 2 && !synth; attempt++) {
    const completion = await client.chat.completions.create(
      {
        model,
        messages,
        tools: TOOLS,
        tool_choice: "none",
        response_format: { type: "json_object" },
      },
      { signal },
    );
    const content = completion.choices[0]?.message?.content ?? "";
    try {
      const parsed = SynthesisSchema.safeParse(JSON.parse(content));
      if (parsed.success) {
        synth = parsed.data;
        await synthStep.finish("completed", "Structured JSON validated against schema (zod) — deliverable ready.", {
          validated: true,
          usage: completion.usage,
          output: parsed.data,
        });
      } else {
        lastError = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      }
    } catch (e) {
      lastError = `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`;
    }
    if (!synth) {
      messages.push({ role: "assistant", content });
      messages.push({
        role: "user",
        content: `Your JSON failed validation: ${lastError}. Return corrected JSON only, with exactly the required keys.`,
      });
    }
  }
  if (!synth) throw new Error(`Final synthesis failed schema validation: ${lastError}`);

  return assemble(synth, ctx, req);
}

/* ------------------------------------------------------------------ */
/* Public entry point                                                  */
/* ------------------------------------------------------------------ */

export async function runAgent(
  req: AgentRequest,
  emit: Emit,
  signal?: AbortSignal,
): Promise<{ deliverable: AgentDeliverable; mode: "live" | "demo" }> {
  const tracer = new Tracer(emit);

  if (req.demoMode || !hasOpenAIKey()) {
    return { deliverable: await runDemo(req, tracer, signal), mode: "demo" };
  }

  try {
    return { deliverable: await runLive(req, tracer, signal), mode: "live" };
  } catch (err) {
    if (signal?.aborted) throw err;
    // Stage-safety: a live failure (bad key, rate limit, network) degrades to the demo simulation.
    const message = err instanceof Error ? err.message : String(err);
    await tracer.closeOpen("Interrupted by upstream error.");
    const warn = await tracer.start("planner", "Live API unavailable — failing over to Stage Demo", {
      error: message.slice(0, 400),
    });
    await warn.finish("warning", `OpenAI call failed (${message.slice(0, 140)}). Continuing with stage-demo simulation.`);
    return { deliverable: await runDemo(req, tracer, signal), mode: "demo" };
  }
}
