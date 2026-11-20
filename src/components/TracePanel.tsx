"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, CheckCircle2, AlertTriangle, ChevronRight, Activity } from "lucide-react";
import type { TraceStep, TraceStepType } from "@/types/agent";

const BADGE: Record<TraceStepType, { label: string; cls: string }> = {
  planner: { label: "PLANNER", cls: "bg-indigo-500/15 text-indigo-300 border-indigo-500/40" },
  tool_call: { label: "TOOL CALL", cls: "bg-sky-500/15 text-sky-300 border-sky-500/40" },
  n8n_webhook: { label: "N8N WEBHOOK", cls: "bg-amber-500/15 text-amber-300 border-amber-500/40" },
  verifier: { label: "VERIFIER", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" },
};

function StepCard({ step }: { step: TraceStep }) {
  const [open, setOpen] = useState(false);
  const badge = BADGE[step.type];
  const hasJson = step.rawInput !== undefined || step.rawOutput !== undefined;
  return (
    <li className="step-in rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-sm font-bold text-zinc-200">
            {step.stepNumber}
          </span>
          <span className={`rounded-md border px-2 py-0.5 text-xs font-bold tracking-wider ${badge.cls}`}>{badge.label}</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-sm text-zinc-300">
          {step.status === "running" ? (
            <Loader2 className="h-4 w-4 animate-spin text-indigo-300" />
          ) : step.status === "warning" ? (
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          )}
          {step.status === "running" ? "…" : `${step.durationMs.toLocaleString("en-US")} ms`}
        </div>
      </div>
      <h3 className="mt-2 text-base font-semibold text-white">{step.title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-zinc-300">{step.summary}</p>

      {hasJson && step.status !== "running" && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-1 text-sm font-semibold text-indigo-300 hover:text-indigo-200"
            aria-expanded={open}
          >
            <ChevronRight className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`} />
            Inspect JSON
          </button>
          {open && (
            <div className="mt-2 space-y-2">
              {step.rawInput !== undefined && (
                <div>
                  <div className="mb-1 text-xs font-bold uppercase tracking-wide text-zinc-500">Input</div>
                  <pre className="max-h-64 overflow-auto rounded-lg bg-zinc-950 p-3 text-xs text-zinc-300">
                    {JSON.stringify(step.rawInput, null, 2)}
                  </pre>
                </div>
              )}
              {step.rawOutput !== undefined && (
                <div>
                  <div className="mb-1 text-xs font-bold uppercase tracking-wide text-zinc-500">Output</div>
                  <pre className="max-h-64 overflow-auto rounded-lg bg-zinc-950 p-3 text-xs text-emerald-200">
                    {JSON.stringify(step.rawOutput, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export default function TracePanel({ steps, running }: { steps: TraceStep[]; running: boolean }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [steps]);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold text-white">
          <Activity className="h-5 w-5 text-indigo-400" />
          Live Agent Execution Trace
        </h2>
        {running && (
          <span className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400" />
            STREAMING
          </span>
        )}
      </div>
      {steps.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 p-6 text-center text-zinc-500">
          Agent steps stream here in real time: planner turns, tool calls, verification, n8n dispatch.
        </div>
      ) : (
        <ol className="space-y-3">
          {steps.map((s) => (
            <StepCard key={s.id} step={s} />
          ))}
        </ol>
      )}
      <div ref={endRef} />
    </section>
  );
}
