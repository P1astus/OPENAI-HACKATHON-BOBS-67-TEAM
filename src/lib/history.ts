import type { RunRecord } from "@/types/agent";

const KEY = "main08.recentRuns.v1";
const MAX = 5;

export function loadHistory(): RunRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function saveRun(run: RunRecord): RunRecord[] {
  const next = [run, ...loadHistory().filter((r) => r.deliverable.id !== run.deliverable.id)].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode — history is a nicety */
  }
  return next;
}

export function updateRunDeliverable(run: RunRecord): RunRecord[] {
  const next = loadHistory().map((r) => (r.deliverable.id === run.deliverable.id ? run : r));
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}
