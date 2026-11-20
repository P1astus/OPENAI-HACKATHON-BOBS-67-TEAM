/** n8n webhook bridge. Native fetch, 6s hard timeout, never throws. */

export const N8N_TIMEOUT_MS = 6000;

export interface N8nResult {
  ok: boolean;
  /** 'dispatched' = n8n accepted it; 'simulated' = no URL configured or n8n unreachable. */
  status: "dispatched" | "simulated";
  httpStatus?: number;
  message: string;
  durationMs: number;
  response?: unknown;
}

export function isN8nConfigured(): boolean {
  return Boolean(process.env.N8N_WEBHOOK_URL?.trim());
}

export async function dispatchToN8n(
  workflowName: string,
  payload: Record<string, unknown>,
): Promise<N8nResult> {
  const url = process.env.N8N_WEBHOOK_URL?.trim();
  const started = Date.now();

  if (!url) {
    return {
      ok: true,
      status: "simulated",
      message: "N8N_WEBHOOK_URL not set — dispatch simulated.",
      durationMs: Date.now() - started,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), N8N_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workflow: workflowName,
        source: "main-08-ops-engine",
        sentAt: new Date().toISOString(),
        payload,
      }),
      signal: controller.signal,
    });

    const raw = await res.text();
    let parsed: unknown = raw;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = raw.slice(0, 500);
    }

    if (!res.ok) {
      const detail =
        typeof parsed === "object" && parsed && "message" in parsed
          ? String((parsed as { message: unknown }).message)
          : String(raw).slice(0, 200);
      return {
        ok: false,
        status: "simulated",
        httpStatus: res.status,
        message: `n8n responded HTTP ${res.status}: ${detail || res.statusText}`,
        durationMs: Date.now() - started,
        response: parsed,
      };
    }

    return {
      ok: true,
      status: "dispatched",
      httpStatus: res.status,
      message: `n8n accepted the payload (HTTP ${res.status}).`,
      durationMs: Date.now() - started,
      response: parsed,
    };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      status: "simulated",
      message: aborted
        ? `n8n did not respond within ${N8N_TIMEOUT_MS / 1000}s.`
        : `n8n request failed: ${err instanceof Error ? err.message : String(err)}`,
      durationMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}
