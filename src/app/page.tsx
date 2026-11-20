"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import CommandBar from "@/components/CommandBar";
import ArchitectureModal from "@/components/ArchitectureModal";
import LauncherPanel, { type Attachment } from "@/components/LauncherPanel";
import DeliverablePanel from "@/components/DeliverablePanel";
import TracePanel from "@/components/TracePanel";
import type { AgentDeliverable, HealthStatus, N8nAction, RunRecord, TraceStep } from "@/types/agent";
import type { Preset } from "@/lib/presets";
import { streamAgent } from "@/lib/stream";
import { loadHistory, saveRun, updateRunDeliverable } from "@/lib/history";

const MAX_PROMPT_CHARS = 58_000;

function buildPrompt(prompt: string, attachments: Attachment[]): string {
  const files = attachments.map((a) => `--- Attached file: ${a.name} ---\n${a.content}`).join("\n\n");
  return [prompt.trim(), files].filter(Boolean).join("\n\n").slice(0, MAX_PROMPT_CHARS);
}

export default function Home() {
  const [demoMode, setDemoMode] = useState(true);
  const [requireApproval, setRequireApproval] = useState(true);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [showArch, setShowArch] = useState(false);

  const [prompt, setPrompt] = useState("");
  const [scenarioTitle, setScenarioTitle] = useState<string | undefined>();
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const [running, setRunning] = useState(false);
  const [trace, setTrace] = useState<TraceStep[]>([]);
  const [run, setRun] = useState<RunRecord | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<RunRecord[]>([]);

  const traceRef = useRef<TraceStep[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const userToggledMode = useRef(false);

  // Health check + auto-default mode (Demo if no OpenAI key, Live if present).
  useEffect(() => {
    fetch("/api/health", { cache: "no-store" })
      .then((r) => r.json())
      .then((h: HealthStatus) => {
        setHealth(h);
        if (!userToggledMode.current) setDemoMode(!h.openai);
      })
      .catch(() =>
        setHealth({ openai: false, elevenlabs: false, n8n: false, model: "gpt-4o" }),
      );
    // localStorage is client-only: read after mount (async to avoid a sync setState in the effect body).
    void Promise.resolve().then(() => setHistory(loadHistory()));
  }, []);

  // Live execution-time ticker.
  useEffect(() => {
    if (!running) return;
    const start = Date.now();
    const t = setInterval(() => setElapsedMs(Date.now() - start), 100);
    return () => clearInterval(t);
  }, [running]);

  const execute = useCallback(
    async (text: string, title: string | undefined) => {
      if (!text.trim()) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      traceRef.current = [];
      setTrace([]);
      setRun(null);
      setError(null);
      setElapsedMs(0);
      setRunning(true);

      const started = Date.now();
      let deliverable: AgentDeliverable | null = null;
      let mode: "live" | "demo" = demoMode ? "demo" : "live";
      let failed = false;

      try {
        await streamAgent(
          { prompt: text, scenarioTitle: title, demoMode, requireApproval },
          {
            onStep: (s) => {
              const next = [...traceRef.current];
              const i = next.findIndex((x) => x.id === s.id);
              if (i === -1) next.push(s);
              else next[i] = s;
              traceRef.current = next;
              setTrace(next);
            },
            onDeliverable: (d) => {
              deliverable = d;
            },
            onDone: (m) => {
              mode = m;
            },
            onError: (message) => {
              failed = true;
              setError(message);
            },
          },
          controller.signal,
        );
      } catch (e) {
        if (!controller.signal.aborted) {
          failed = true;
          setError(e instanceof Error ? e.message : "Stream interrupted");
        }
      }

      if (controller.signal.aborted) return;
      setRunning(false);

      if (deliverable) {
        const record: RunRecord = {
          deliverable,
          trace: traceRef.current,
          executionMs: Date.now() - started,
          mode,
        };
        setRun(record);
        setHistory(saveRun(record));
      } else if (!failed) {
        setError("The agent finished without producing a deliverable.");
      }
    },
    [demoMode, requireApproval],
  );

  const runCustom = useCallback(() => {
    void execute(buildPrompt(prompt, attachments), scenarioTitle);
  }, [execute, prompt, attachments, scenarioTitle]);

  const runPreset = useCallback(
    (p: Preset) => {
      setPrompt(p.context);
      setScenarioTitle(p.title);
      setAttachments([]);
      void execute(p.context, p.title);
    },
    [execute],
  );

  // Cmd/Ctrl + Enter anywhere.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !running) {
        e.preventDefault();
        runCustom();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [running, runCustom]);

  const selectRun = (r: RunRecord) => {
    setRun(r);
    setTrace(r.trace);
    traceRef.current = r.trace;
    setError(null);
  };

  const onN8nApproved = (status: N8nAction["status"], message: string, durationMs: number, response: unknown) => {
    const cur = run;
    if (!cur) return;
    const step: TraceStep = {
      id: `approve-${Date.now()}`, // randomUUID needs a secure context; this works on any LAN origin
      stepNumber: cur.trace.length + 1,
      title: "n8n: human-approved dispatch",
      type: "n8n_webhook",
      status: status === "dispatched" ? "completed" : "warning",
      durationMs,
      summary: message,
      rawInput: { workflowName: cur.deliverable.n8nActionTriggered.workflowName, approvedByHuman: true },
      rawOutput: response ?? { status },
    };
    const updated: RunRecord = {
      ...cur,
      trace: [...cur.trace, step],
      deliverable: {
        ...cur.deliverable,
        n8nActionTriggered: { ...cur.deliverable.n8nActionTriggered, status },
      },
    };
    traceRef.current = updated.trace;
    setRun(updated);
    setTrace(updated.trace);
    setHistory(updateRunDeliverable(updated));
  };

  return (
    <div className="flex min-h-screen flex-col">
      <CommandBar
        demoMode={demoMode}
        onDemoMode={(v) => {
          userToggledMode.current = true;
          setDemoMode(v);
        }}
        requireApproval={requireApproval}
        onRequireApproval={setRequireApproval}
        health={health}
        onArchitecture={() => setShowArch(true)}
      />

      {error && (
        <div className="mx-5 mt-4 flex items-start gap-3 rounded-xl border border-red-500/50 bg-red-500/10 p-4 text-red-200">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <div className="font-semibold">Run failed</div>
            <div className="text-sm">{error} — switch to Stage Demo and run again.</div>
          </div>
        </div>
      )}

      <main className="grid flex-1 grid-cols-1 gap-5 p-5 lg:grid-cols-12">
        <div className="lg:col-span-4 xl:col-span-3">
          <LauncherPanel
            prompt={prompt}
            onPrompt={(v) => {
              setPrompt(v);
              setScenarioTitle(undefined);
            }}
            attachments={attachments}
            onAttachments={setAttachments}
            running={running}
            onRun={runCustom}
            onPreset={runPreset}
            history={history}
            activeId={run?.deliverable.id ?? null}
            onSelectRun={selectRun}
          />
        </div>

        <div className="lg:col-span-8 xl:col-span-6">
          <DeliverablePanel
            run={run}
            running={running}
            elapsedMs={elapsedMs}
            demoMode={demoMode}
            onN8nApproved={onN8nApproved}
          />
        </div>

        <div className="lg:col-span-12 xl:col-span-3">
          <TracePanel steps={trace} running={running} />
        </div>
      </main>

      {showArch && <ArchitectureModal onClose={() => setShowArch(false)} />}
    </div>
  );
}
