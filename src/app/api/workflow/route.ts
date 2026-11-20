import { dispatchToN8n } from "@/lib/integrations/n8n";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Fires a previously staged payload (human approval click) at the n8n webhook. */
export async function POST(req: Request) {
  let body: { workflowName?: unknown; payload?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, message: "Invalid JSON body." }, { status: 400 });
  }

  const workflowName = typeof body.workflowName === "string" ? body.workflowName : "unnamed-workflow";
  const payload =
    body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
      ? (body.payload as Record<string, unknown>)
      : null;
  if (!payload) {
    return Response.json({ ok: false, message: "payload must be an object." }, { status: 400 });
  }

  const result = await dispatchToN8n(workflowName, { ...payload, approvedByHuman: true });
  return Response.json(result);
}
