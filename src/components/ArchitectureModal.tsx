"use client";

import { useEffect } from "react";
import { X, Inbox, Brain, Calculator, Workflow, AudioLines, ArrowDown } from "lucide-react";

const NODES = [
  { icon: Inbox, title: "Input", body: "Free-text brief, preset scenario, or uploaded .txt/.csv/.json/.md context.", color: "text-zinc-300" },
  {
    icon: Brain,
    title: "OpenAI Planner & Tool Loop",
    body: "chat.completions with function calling (parallel_tool_calls off). The model chooses tools turn by turn; every turn streams to the UI over SSE.",
    color: "text-indigo-300",
  },
  {
    icon: Calculator,
    title: "ROI & Verifier",
    body: "calculate_business_roi is deterministic math (no hallucinated numbers). verify_and_ground_output self-critiques against constraints, scores confidence and surfaces trade-offs.",
    color: "text-emerald-300",
  },
  {
    icon: Workflow,
    title: "Human Gate / n8n Webhook",
    body: "Governance toggle: auto-dispatch immediately, or stage as pending_approval and fire /api/workflow on a human click. 6s timeout, never blocks the demo.",
    color: "text-amber-300",
  },
  {
    icon: AudioLines,
    title: "ElevenLabs Voice Briefing",
    body: "eleven_turbo_v2_5 via /api/tts; transparently falls back to window.speechSynthesis if offline, keyless or in demo mode.",
    color: "text-pink-300",
  },
];

export default function ArchitectureModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Architecture"
    >
      <div
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white">End-to-end data flow</h2>
            <p className="mt-1 font-mono text-sm text-emerald-300">
              Input → OpenAI Planner &amp; Tool Loop → ROI &amp; Verifier → Human Gate / n8n Webhook → ElevenLabs Voice Briefing
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg border border-zinc-700 p-2 text-zinc-300 hover:bg-zinc-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <ol className="space-y-2">
          {NODES.map((n, i) => (
            <li key={n.title}>
              <div className="flex gap-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                <n.icon className={`mt-0.5 h-7 w-7 shrink-0 ${n.color}`} />
                <div>
                  <div className="text-lg font-semibold text-white">
                    {i + 1}. {n.title}
                  </div>
                  <p className="text-base text-zinc-300">{n.body}</p>
                </div>
              </div>
              {i < NODES.length - 1 && <ArrowDown className="mx-auto my-1 h-5 w-5 text-zinc-600" />}
            </li>
          ))}
        </ol>

        <div className="mt-4 grid gap-3 text-sm text-zinc-300 sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
            <div className="mb-1 font-semibold text-white">Why it&apos;s stage-safe</div>
            100% stateless (no DB, no auth). Stage Demo Mode and automatic live→demo failover keep the show running offline.
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
            <div className="mb-1 font-semibold text-white">Why it&apos;s trustworthy</div>
            Structured outputs validated with Zod; numbers come from tools, not the model; every step is inspectable as raw JSON.
          </div>
        </div>
      </div>
    </div>
  );
}
