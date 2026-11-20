import { AgentRequestSchema, type StreamEvent } from "@/types/agent";
import { runAgent } from "@/lib/integrations/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** POST { prompt, scenarioTitle?, demoMode, requireApproval } -> text/event-stream of TraceStep + AgentDeliverable. */
export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = AgentRequestSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (e: StreamEvent) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`));
      };
      // Comment frame flushes headers immediately through proxies.
      controller.enqueue(encoder.encode(": stream-open\n\n"));

      try {
        const { deliverable, mode } = await runAgent(parsed.data, send, req.signal);
        send({ event: "deliverable", data: deliverable });
        send({ event: "done", data: { mode } });
      } catch (err) {
        send({
          event: "error",
          data: { message: err instanceof Error ? err.message : "Agent run failed" },
        });
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed by client abort */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
