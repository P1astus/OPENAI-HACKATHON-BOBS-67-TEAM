import { synthesizeSpeech, isElevenLabsConfigured } from "@/lib/elevenlabs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { text?: unknown; voiceId?: unknown; demoMode?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ fallback: true, reason: "bad_request" });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return Response.json({ fallback: true, reason: "empty_text" });
  if (body.demoMode === true) return Response.json({ fallback: true, reason: "demo_mode" });
  if (!isElevenLabsConfigured()) return Response.json({ fallback: true, reason: "no_key" });

  const voiceId = typeof body.voiceId === "string" && body.voiceId ? body.voiceId : undefined;
  const audio = await synthesizeSpeech(text, voiceId);
  if (!audio) return Response.json({ fallback: true, reason: "elevenlabs_failed" });

  return new Response(audio, {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
  });
}
