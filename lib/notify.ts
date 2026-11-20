/**
 * Optional status messages through n8n (Tropimatico's workflow). Fire-and-forget with a short
 * timeout: a failing n8n must never break the flow. Does nothing when N8N_WEBHOOK_URL is unset.
 */
export async function notify(payload: { ticket_id: string; event: string; to: string; message: string }): Promise<void> {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3_000),
    });
  } catch (error) {
    console.warn(JSON.stringify({ at: "n8n", ticket: payload.ticket_id, event: payload.event, error: error instanceof Error ? error.name : "Error" }));
  }
}
