import type { Company, Property, Ticket } from "../../types";

/**
 * Start an outbound AI phone call to a non-partner company through ElevenLabs.
 *
 * Endpoint and dynamic variable names follow ElevenLabs' Twilio outbound-call API. Tropimatico's
 * docs/voice-agent.md is the source of truth: if it differs, change it here.
 *
 * Privacy: only the problem summary, street + postcode, preferred days and the ticket id are sent.
 * No tenant name or phone number before the tenant has given consent.
 */
const CALL_TIMEOUT_MS = 10_000;
const ENDPOINT = "https://api.elevenlabs.io/v1/convai/twilio/outbound-call";

export type CallResult =
  | { status: "started"; conversation_id: string | null }
  | { status: "not_configured" }
  | { status: "failed"; error: string };

export function voiceConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_AGENT_ID && process.env.ELEVENLABS_PHONE_NUMBER_ID);
}

export function callVariables(ticket: Ticket, company: Company, property: Property) {
  return {
    company_name: company.name,
    company_id: company.id,
    problem_summary: ticket.triage?.summary ?? "A repair in an apartment",
    street_and_postcode: `${property.address}, ${property.postcode} ${property.city}`,
    preferred_days: "the next three working days, between 8:00 and 17:00",
    ticket_id: ticket.id,
    current_date: new Date().toISOString().slice(0, 10),
    time_zone: "Europe/Berlin",
  };
}

export async function startCompanyCall(ticket: Ticket, company: Company, property: Property): Promise<CallResult> {
  if (!voiceConfigured()) return { status: "not_configured" };
  // For the demo, VOICE_TEST_TO_NUMBER routes every call to the teammate playing the company.
  const to_number = process.env.VOICE_TEST_TO_NUMBER || company.phone;
  const started = Date.now();
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY!, "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id: process.env.ELEVENLABS_AGENT_ID,
        agent_phone_number_id: process.env.ELEVENLABS_PHONE_NUMBER_ID,
        to_number,
        conversation_initiation_client_data: { dynamic_variables: callVariables(ticket, company, property) },
      }),
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    });
    const body = (await response.json().catch(() => ({}))) as { success?: boolean; conversation_id?: string; message?: string };
    console.info(JSON.stringify({ at: "voice.start", ticket: ticket.id, http: response.status, ok: response.ok, latency_ms: Date.now() - started }));
    if (!response.ok || body.success === false) return { status: "failed", error: `ElevenLabs returned ${response.status}` };
    return { status: "started", conversation_id: body.conversation_id ?? null };
  } catch (error) {
    const name = error instanceof Error ? error.name : "Error";
    console.warn(JSON.stringify({ at: "voice.start", ticket: ticket.id, error: name, latency_ms: Date.now() - started }));
    return { status: "failed", error: name === "TimeoutError" ? "timed out" : name };
  }
}
