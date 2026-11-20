"use client";

import { useState } from "react";
import { Workflow, CheckCircle2, Clock, FlaskConical, Loader2, ChevronRight } from "lucide-react";
import type { N8nAction } from "@/types/agent";

const STATUS = {
  dispatched: { label: "DISPATCHED", cls: "border-emerald-500/50 bg-emerald-500/10 text-emerald-300", Icon: CheckCircle2 },
  pending_approval: { label: "PENDING APPROVAL", cls: "border-amber-500/50 bg-amber-500/10 text-amber-300", Icon: Clock },
  simulated: { label: "SIMULATED", cls: "border-indigo-500/50 bg-indigo-500/10 text-indigo-300", Icon: FlaskConical },
} as const;

interface Props {
  action: N8nAction;
  onApproved: (status: N8nAction["status"], message: string, durationMs: number, response: unknown) => void;
}

export default function N8nActionCard({ action, onApproved }: Props) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showPayload, setShowPayload] = useState(false);
  const s = STATUS[action.status];

  const approve = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowName: action.workflowName, payload: action.rawPayload }),
      });
      const j = await res.json();
      if (!res.ok || j.ok === false) {
        setMsg({ ok: false, text: j.message ?? `Dispatch failed (HTTP ${res.status}). Payload is still staged — retry.` });
        return;
      }
      setMsg({ ok: true, text: j.message });
      onApproved(j.status === "dispatched" ? "dispatched" : "simulated", j.message, j.durationMs ?? 0, j.response);
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Network error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold text-white">
          <Workflow className="h-5 w-5 text-amber-400" />
          n8n Action
        </h2>
        <span className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold tracking-wide ${s.cls}`}>
          <s.Icon className="h-3.5 w-3.5" />
          {s.label}
        </span>
      </div>
      <p className="mt-2 font-mono text-sm text-emerald-300">{action.workflowName}</p>
      <p className="mt-1 text-base text-zinc-200">{action.payloadSummary}</p>

      {action.status === "pending_approval" && (
        <button
          type="button"
          onClick={approve}
          disabled={busy}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-3.5 text-lg font-bold text-zinc-950 hover:bg-amber-300 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Workflow className="h-5 w-5" />}
          {busy ? "Dispatching…" : "Approve & Trigger n8n Webhook"}
        </button>
      )}
      {msg && <p className={`mt-2 text-sm ${msg.ok ? "text-emerald-300" : "text-red-300"}`}>{msg.text}</p>}

      <button
        type="button"
        onClick={() => setShowPayload((v) => !v)}
        className="mt-3 flex items-center gap-1 text-sm font-semibold text-indigo-300 hover:text-indigo-200"
        aria-expanded={showPayload}
      >
        <ChevronRight className={`h-4 w-4 transition-transform ${showPayload ? "rotate-90" : ""}`} />
        Inspect payload
      </button>
      {showPayload && (
        <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-zinc-950 p-3 text-xs text-zinc-300">
          {JSON.stringify(action.rawPayload, null, 2)}
        </pre>
      )}
    </section>
  );
}
