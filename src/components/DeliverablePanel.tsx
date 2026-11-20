"use client";

import { Clock, PiggyBank, ShieldCheck, Timer, Sparkles, ListChecks, Scale, Loader2 } from "lucide-react";
import type { N8nAction, RunRecord } from "@/types/agent";
import VoiceBriefingPlayer from "./VoiceBriefingPlayer";
import N8nActionCard from "./N8nActionCard";

function eur(n: number): string {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 100_000) return `€${Math.round(n / 1000)}K`;
  return `€${n.toLocaleString("en-US")}`;
}

function Kpi({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className={`mb-2 flex items-center gap-2 text-sm font-semibold ${accent}`}>
        {icon}
        {label}
      </div>
      <div className="text-4xl font-extrabold tabular-nums tracking-tight text-white xl:text-5xl">{value}</div>
    </div>
  );
}

interface Props {
  run: RunRecord | null;
  running: boolean;
  elapsedMs: number;
  demoMode: boolean;
  onN8nApproved: (status: N8nAction["status"], message: string, durationMs: number, response: unknown) => void;
}

export default function DeliverablePanel({ run, running, elapsedMs, demoMode, onN8nApproved }: Props) {
  const d = run?.deliverable;
  const impact = d?.businessImpact;
  const seconds = ((run ? run.executionMs : elapsedMs) / 1000).toFixed(1);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3">
        <Kpi
          label="Monthly Hours Saved"
          value={impact ? impact.hoursSavedPerMonth.toLocaleString("en-US") : "—"}
          icon={<Clock className="h-4 w-4" />}
          accent="text-indigo-300"
        />
        <Kpi
          label="Annual Savings (€)"
          value={impact ? eur(impact.annualCostSavingsEur) : "—"}
          icon={<PiggyBank className="h-4 w-4" />}
          accent="text-emerald-300"
        />
        <Kpi
          label="Confidence Score (%)"
          value={impact ? `${impact.confidenceScore}%` : "—"}
          icon={<ShieldCheck className="h-4 w-4" />}
          accent="text-emerald-300"
        />
        <Kpi
          label="Execution Time (s)"
          value={run || running ? `${seconds}s` : "—"}
          icon={<Timer className="h-4 w-4" />}
          accent="text-indigo-300"
        />
      </div>

      {!d ? (
        <div className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-zinc-800 p-8 text-center">
          {running ? (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-emerald-400" />
              <p className="text-xl font-semibold text-white">Agent is planning, calling tools and verifying…</p>
              <p className="text-zinc-400">Watch the execution trace on the right.</p>
            </>
          ) : (
            <>
              <Sparkles className="h-10 w-10 text-indigo-400" />
              <p className="text-xl font-semibold text-white">Pick a scenario or paste a brief to start</p>
              <p className="max-w-md text-zinc-400">
                The executive deliverable, ROI, action plan and voice briefing appear here.
              </p>
            </>
          )}
        </div>
      ) : (
        <>
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="flex items-center gap-2 text-2xl font-bold text-white">
                <Sparkles className="h-6 w-6 text-emerald-400" />
                {d.scenarioTitle}
              </h2>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-bold tracking-wide ${
                  run?.mode === "demo"
                    ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-300"
                    : "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                }`}
              >
                {run?.mode === "demo" ? "STAGE DEMO" : "LIVE OPENAI"}
              </span>
            </div>
            <h3 className="mt-3 text-sm font-bold uppercase tracking-wider text-zinc-500">Executive summary</h3>
            <p className="mt-1 text-lg leading-relaxed text-zinc-100">{d.executiveSummary}</p>
            <div className="mt-4">
              <VoiceBriefingPlayer key={d.id} text={d.voiceBriefingScript} demoMode={demoMode} />
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-white">
              <ListChecks className="h-5 w-5 text-emerald-400" />
              Prioritized Action Plan
            </h2>
            <ol className="space-y-3">
              {d.strategicRecommendations.map((r, i) => (
                <li key={i} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-semibold text-white">
                      {i + 1}. {r.title}
                    </h3>
                    <span
                      className={`shrink-0 rounded-md border px-2 py-0.5 text-xs font-bold ${
                        r.priority === "High"
                          ? "border-red-500/50 bg-red-500/10 text-red-300"
                          : "border-sky-500/50 bg-sky-500/10 text-sky-300"
                      }`}
                    >
                      {r.priority.toUpperCase()}
                    </span>
                  </div>
                  <p className="mt-1 text-base text-zinc-200">{r.action}</p>
                  <p className="mt-2 text-sm text-emerald-300">
                    <span className="font-bold">Impact: </span>
                    {r.expectedImpact}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-white">
              <Scale className="h-5 w-5 text-amber-400" />
              Risk &amp; Trade-off Matrix
            </h2>
            <div className="overflow-hidden rounded-xl border border-zinc-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-950 text-xs uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="w-1/2 px-4 py-2">Risk / trade-off</th>
                    <th className="px-4 py-2">Mitigation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {d.riskAndTradeoffs.map((r, i) => (
                    <tr key={i} className="align-top">
                      <td className="px-4 py-3 text-base text-amber-200">{r.risk}</td>
                      <td className="px-4 py-3 text-base text-zinc-200">{r.mitigation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <N8nActionCard action={d.n8nActionTriggered} onApproved={onN8nApproved} />
        </>
      )}
    </div>
  );
}
