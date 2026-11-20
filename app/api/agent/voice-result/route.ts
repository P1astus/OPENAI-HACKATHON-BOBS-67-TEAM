import { recordVoiceResult } from "@/lib/flow";
import { HttpError } from "@/lib/errors";
import { handle, parseBody, safeEqual } from "@/lib/http";
import { voiceResultBody } from "@/lib/schemas";
import { mutate } from "@/lib/store";

/** ElevenLabs `submit_slots` tool webhook. Also callable by hand as the stage fallback (with the secret). */
export const POST = handle(async (request: Request) => {
  const secret = process.env.VOICE_WEBHOOK_SECRET;
  const given = request.headers.get("x-webhook-secret") ?? "";
  if (!secret || !safeEqual(given, secret)) throw new HttpError(401, "Invalid or missing webhook secret");
  const body = await parseBody(request, voiceResultBody);
  await mutate((s) => recordVoiceResult(s, body));
  return { ok: true };
});
