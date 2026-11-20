import type { HealthStatus } from "@/types/agent";
import { isElevenLabsConfigured } from "@/lib/elevenlabs";
import { isN8nConfigured } from "@/lib/n8n";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const status: HealthStatus = {
    openai: Boolean(process.env.OPENAI_API_KEY?.trim()),
    elevenlabs: isElevenLabsConfigured(),
    n8n: isN8nConfigured(),
    model: process.env.OPENAI_MODEL?.trim() || "gpt-4o",
  };
  return Response.json(status, { headers: { "Cache-Control": "no-store" } });
}
