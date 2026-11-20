/** ElevenLabs TTS via native fetch. Returns null on any failure so callers can fall back. */

export const DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";
const MAX_CHARS = 2500;

export function isElevenLabsConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY?.trim());
}

export async function synthesizeSpeech(
  text: string,
  voiceId?: string,
): Promise<ArrayBuffer | null> {
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  if (!key) return null;

  const voice = (voiceId || process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID).trim();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": key,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: text.slice(0, MAX_CHARS),
          model_id: "eleven_turbo_v2_5",
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
        signal: controller.signal,
      },
    );
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
