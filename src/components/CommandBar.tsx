"use client";

import { Cpu, Network, ShieldCheck, Zap, Radio } from "lucide-react";
import type { HealthStatus } from "@/types/agent";

interface Props {
  demoMode: boolean;
  onDemoMode: (v: boolean) => void;
  requireApproval: boolean;
  onRequireApproval: (v: boolean) => void;
  health: HealthStatus | null;
  onArchitecture: () => void;
}

function Segmented({
  value,
  onChange,
  left,
  right,
  label,
}: {
  value: boolean; // true = right option
  onChange: (v: boolean) => void;
  left: { label: string; icon: React.ReactNode };
  right: { label: string; icon: React.ReactNode };
  label: string;
}) {
  const base = "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors";
  return (
    <div role="group" aria-label={label} className="flex rounded-xl border border-zinc-800 bg-zinc-900 p-1">
      <button
        type="button"
        aria-pressed={!value}
        onClick={() => onChange(false)}
        className={`${base} ${!value ? "bg-indigo-500 text-white" : "text-zinc-400 hover:text-zinc-100"}`}
      >
        {left.icon}
        {left.label}
      </button>
      <button
        type="button"
        aria-pressed={value}
        onClick={() => onChange(true)}
        className={`${base} ${value ? "bg-emerald-500 text-zinc-950" : "text-zinc-400 hover:text-zinc-100"}`}
      >
        {right.icon}
        {right.label}
      </button>
    </div>
  );
}

function Badge({ name, state, detail }: { name: string; state: "ok" | "fallback" | "loading"; detail: string }) {
  const color =
    state === "ok"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
      : state === "fallback"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
        : "border-zinc-700 bg-zinc-900 text-zinc-400";
  const dot = state === "ok" ? "bg-emerald-400" : state === "fallback" ? "bg-amber-400" : "bg-zinc-500";
  return (
    <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${color}`}>
      <span className={`h-2.5 w-2.5 rounded-full ${dot} ${state === "ok" ? "shadow-[0_0_8px_#34d399]" : ""}`} />
      <span className="font-semibold">{name}</span>
      <span className="opacity-80">{detail}</span>
    </div>
  );
}

export default function CommandBar({
  demoMode,
  onDemoMode,
  requireApproval,
  onRequireApproval,
  health,
  onArchitecture,
}: Props) {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            <span className="text-emerald-400">MAIN-08</span> {"//"} Autonomous AI Operations Engine
          </h1>
          <p className="text-sm text-zinc-400">
            Plan → tool-call → verify → execute → brief. Stateless, one-command deploy.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            label="Execution mode"
            value={!demoMode}
            onChange={(live) => onDemoMode(!live)}
            left={{ label: "Stage Demo", icon: <Radio className="h-4 w-4" /> }}
            right={{ label: "Live API", icon: <Zap className="h-4 w-4" /> }}
          />
          <Segmented
            label="Governance"
            value={requireApproval}
            onChange={onRequireApproval}
            left={{ label: "Auto-Dispatch n8n", icon: <Zap className="h-4 w-4" /> }}
            right={{ label: "Human-in-the-Loop Approval", icon: <ShieldCheck className="h-4 w-4" /> }}
          />
          <button
            type="button"
            onClick={onArchitecture}
            className="flex items-center gap-2 rounded-xl border border-indigo-500/50 bg-indigo-500/10 px-4 py-2.5 text-sm font-semibold text-indigo-200 hover:bg-indigo-500/20"
          >
            <Network className="h-4 w-4" />
            Architecture
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-zinc-900 px-5 py-2">
        <Cpu className="h-4 w-4 text-zinc-500" />
        <Badge
          name="OpenAI"
          state={!health ? "loading" : health.openai ? "ok" : "fallback"}
          detail={!health ? "checking…" : health.openai ? `live · ${health.model}` : "no key · demo mode"}
        />
        <Badge
          name="ElevenLabs"
          state={!health ? "loading" : health.elevenlabs ? "ok" : "fallback"}
          detail={!health ? "checking…" : health.elevenlabs ? "HD voice ready" : "browser voice fallback"}
        />
        <Badge
          name="n8n"
          state={!health ? "loading" : health.n8n ? "ok" : "fallback"}
          detail={!health ? "checking…" : health.n8n ? "webhook connected" : "dispatch simulated"}
        />
        {!demoMode && health && !health.openai && (
          <span className="text-sm text-amber-300">Live API selected but no OPENAI_API_KEY — runs fall back to the demo simulation.</span>
        )}
      </div>
    </header>
  );
}
