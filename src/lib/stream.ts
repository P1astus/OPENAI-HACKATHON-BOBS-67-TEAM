import type { AgentDeliverable, AgentRequest, StreamEvent, TraceStep } from "@/types/agent";

export interface StreamHandlers {
  onStep: (s: TraceStep) => void;
  onDeliverable: (d: AgentDeliverable) => void;
  onDone: (mode: "live" | "demo") => void;
  onError: (message: string) => void;
}

/** POST to /api/agent and parse the SSE stream (fetch-based; EventSource can't POST). */
export async function streamAgent(
  body: AgentRequest,
  handlers: StreamHandlers,
  signal: AbortSignal,
): Promise<void> {
  const res = await fetch("/api/agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    let msg = `Agent request failed (HTTP ${res.status})`;
    try {
      const j = await res.json();
      if (j?.error) msg = String(j.error);
    } catch {
      /* ignore */
    }
    handlers.onError(msg);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  const dispatch = (frame: string) => {
    let event = "message";
    const dataLines: string[] = [];
    for (const line of frame.split("\n")) {
      if (line.startsWith(":")) continue;
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
    }
    if (dataLines.length === 0) return;
    let data: unknown;
    try {
      data = JSON.parse(dataLines.join("\n"));
    } catch {
      return;
    }
    const e = { event, data } as StreamEvent;
    if (e.event === "step") handlers.onStep(e.data);
    else if (e.event === "deliverable") handlers.onDeliverable(e.data);
    else if (e.event === "done") handlers.onDone(e.data.mode);
    else if (e.event === "error") handlers.onError(e.data.message);
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      dispatch(buf.slice(0, idx));
      buf = buf.slice(idx + 2);
    }
  }
  if (buf.trim()) dispatch(buf);
}
