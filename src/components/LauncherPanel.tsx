"use client";

import { useRef, useState } from "react";
import { Ship, Headset, Receipt, Play, Upload, X, History, Loader2, FileText } from "lucide-react";
import { PRESETS, type Preset } from "@/lib/presets";
import type { RunRecord } from "@/types/agent";

export interface Attachment {
  name: string;
  content: string;
}

const ICONS = { ship: Ship, headset: Headset, receipt: Receipt } as const;
const MAX_FILE_CHARS = 20_000;
const ACCEPT = ".txt,.csv,.json,.md";

interface Props {
  prompt: string;
  onPrompt: (v: string) => void;
  attachments: Attachment[];
  onAttachments: (a: Attachment[]) => void;
  running: boolean;
  onRun: () => void;
  onPreset: (p: Preset) => void;
  history: RunRecord[];
  activeId: string | null;
  onSelectRun: (r: RunRecord) => void;
}

export default function LauncherPanel({
  prompt,
  onPrompt,
  attachments,
  onAttachments,
  running,
  onRun,
  onPreset,
  history,
  activeId,
  onSelectRun,
}: Props) {
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const readFiles = async (files: FileList | File[]) => {
    setFileError(null);
    const next: Attachment[] = [];
    for (const f of Array.from(files)) {
      if (!/\.(txt|csv|json|md)$/i.test(f.name)) {
        setFileError(`Unsupported file: ${f.name} (use .txt .csv .json .md)`);
        continue;
      }
      const text = await f.text();
      next.push({ name: f.name, content: text.slice(0, MAX_FILE_CHARS) });
    }
    if (next.length) onAttachments([...attachments, ...next]);
  };

  const canRun = !running && (prompt.trim().length > 0 || attachments.length > 0);

  return (
    <div className="flex flex-col gap-5">
      <section>
        <h2 className="mb-2 text-lg font-bold text-white">One-click scenarios</h2>
        <div className="space-y-2">
          {PRESETS.map((p) => {
            const Icon = ICONS[p.icon];
            return (
              <button
                key={p.id}
                type="button"
                disabled={running}
                onClick={() => onPreset(p)}
                className="group flex w-full items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-left transition hover:border-emerald-500/60 hover:bg-zinc-800 disabled:opacity-50"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-300 group-hover:bg-emerald-500/15 group-hover:text-emerald-300">
                  <Icon className="h-6 w-6" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-base font-semibold text-white">{p.title}</span>
                  <span className="block truncate text-sm text-zinc-400">{p.tagline}</span>
                </span>
                <Play className="ml-auto h-4 w-4 shrink-0 text-zinc-600 group-hover:text-emerald-400" />
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold text-white">Custom brief</h2>
        <textarea
          value={prompt}
          onChange={(e) => onPrompt(e.target.value)}
          placeholder="Describe the operational situation, constraints and goal…"
          rows={7}
          className="w-full resize-y rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-base text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
        />

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void readFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
          className={`mt-2 flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed p-4 text-center text-sm transition ${
            dragging ? "border-emerald-400 bg-emerald-500/10 text-emerald-200" : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
          }`}
        >
          <Upload className="h-5 w-5" />
          Drop .txt / .csv / .json / .md context here, or click to browse
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) void readFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
        {fileError && <p className="mt-1 text-sm text-amber-300">{fileError}</p>}
        {attachments.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {attachments.map((a, i) => (
              <li key={`${a.name}-${i}`} className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 py-1 pl-3 pr-1 text-sm text-zinc-200">
                <FileText className="h-4 w-4 text-indigo-300" />
                {a.name}
                <span className="text-zinc-500">{(a.content.length / 1000).toFixed(1)}k</span>
                <button
                  type="button"
                  aria-label={`Remove ${a.name}`}
                  onClick={() => onAttachments(attachments.filter((_, j) => j !== i))}
                  className="rounded-full p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={onRun}
          disabled={!canRun}
          className="mt-3 flex w-full items-center justify-center gap-3 rounded-xl bg-emerald-500 px-4 py-4 text-lg font-bold text-zinc-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
          {running ? "Agent running…" : "Run Autonomous Agent"}
          <kbd className="rounded bg-zinc-950/20 px-2 py-0.5 text-xs font-semibold">⌘/Ctrl ↵</kbd>
        </button>
      </section>

      <section>
        <h2 className="mb-2 flex items-center gap-2 text-lg font-bold text-white">
          <History className="h-5 w-5 text-zinc-400" />
          Recent runs
        </h2>
        {history.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-800 p-3 text-sm text-zinc-500">
            Completed runs are saved here (last 5) so you can flip between them instantly.
          </p>
        ) : (
          <ul className="space-y-2">
            {history.map((r) => (
              <li key={r.deliverable.id}>
                <button
                  type="button"
                  disabled={running}
                  onClick={() => onSelectRun(r)}
                  className={`w-full rounded-xl border p-3 text-left transition disabled:opacity-50 ${
                    r.deliverable.id === activeId
                      ? "border-emerald-500/60 bg-emerald-500/10"
                      : "border-zinc-800 bg-zinc-900 hover:border-zinc-600"
                  }`}
                >
                  <span className="block truncate text-sm font-semibold text-white">{r.deliverable.scenarioTitle}</span>
                  <span className="mt-0.5 flex items-center justify-between text-xs text-zinc-400">
                    <span>{new Date(r.deliverable.timestamp).toLocaleTimeString()}</span>
                    <span>
                      €{Math.round(r.deliverable.businessImpact.annualCostSavingsEur / 1000).toLocaleString("en-US")}K · {r.mode === "demo" ? "demo" : "live"}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
