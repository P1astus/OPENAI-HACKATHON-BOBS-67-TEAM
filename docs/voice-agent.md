# centrix Fix voice agent handover

## 1. What it does and when it runs

The centrix Fix voice agent calls a repair company to collect appointment times and sends those times to the app for the tenant to choose. It runs when the matched company takes bookings by phone instead of an online calendar (for example the partner Hauswerk Aachen), after owner approval if the estimate exceeds €300. Automatic matching falls back to non-partners only when no eligible partner fits. The demo uses the voice path for non-partners and simulated slots for calendar partners.

## 2. Call flow

1. **App.** centrix Fix selects a company for the phone path and records `calling_company`. The ticket waits for a result with `proposed_slots: []`.
2. **ElevenLabs outbound call.** The server sends the call context to ElevenLabs, which dials through Twilio. If `VOICE_TEST_TO_NUMBER` is set, every call goes to the teammate playing the company.
3. **Conversation.** The agent explains the repair, asks for concrete times, and repeats each weekday, date and local start time for confirmation. It aims for two or three slots and accepts one.
4. **`submit_slots`.** The agent submits the confirmed start times in UTC and a one-sentence summary, then ends the call. For a refusal or a fully booked company it sends `slots: []`. On an answering machine it leaves no message, sends `slots: []` with the summary `Answering machine, no slots`, and ends the call.
5. **centrix Fix API.** The webhook validates the result, normalizes and deduplicates the times, drops past or already booked times, and stores up to three sorted `proposed_slots`. If no usable times remain, or if the outbound request fails, the ticket moves to `needs_human` for the property manager.
6. **Tenant.** The tenant picks a proposed slot with one tap and confirms it in the app. The app schedules the repair and records consent for the data shared with the company.

If any of `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `ELEVENLABS_PHONE_NUMBER_ID` or `VOICE_WEBHOOK_SECRET` is missing, the app simulates the call and labels it in the ticket timeline.

## 3. Agent configuration

These settings and the prompt are a setup template. The agent prompt and settings are managed in ElevenLabs.

| Setting | Value |
| --- | --- |
| Platform | ElevenLabs Agents Platform |
| Agent name | centrix repair booking |
| Agent ID | `<ELEVENLABS_AGENT_ID>` |
| LLM | `gpt-4.1` |
| Temperature | `0.2` |
| Timezone | `Europe/Berlin` |
| Maximum call duration | 180 s. The prompt asks the agent to keep calls under 2 minutes. |
| Built-in tool | `end_call` |
| Voice | George, the ElevenLabs default voice, a calm British male voice. ID `JBFqnCBsd6RMkjVDRZzb`. |
| Demo language | English |
| Production language | German (`de`) with a German voice |

### First message

> Hello, this is the booking assistant from reltix property management. Am I speaking with {{company_name}}? Do you have a minute to book a repair job?

### System prompt

```text
# Role
You are the booking assistant of reltix property management. You call a repair company to collect appointment times for a repair in a rented apartment. You speak English for this demo. Be polite, calm, brief and concrete. Keep the whole call under 2 minutes.

# The job (filled in for each call)
- Company you are calling: {{company_name}}
- What is wrong: {{problem_summary}}
- Where: {{street_and_postcode}}
- Preferred times: {{preferred_days}}
- Today is {{current_date}}. All times are local time in {{time_zone}} (Europe/Berlin: UTC+1 in winter, UTC+2 in summer).

# Goal
Get 2 to 3 concrete appointment start times (day + start time) when the company can come, ideally within the preferred times. One time is acceptable if that is all they offer.

# How the call goes
1. After your greeting, briefly give the repair summary and the building's street address and postcode. Ask when they could come.
2. If they offer times, make each one concrete (weekday, date, start time). If they say "Monday morning", ask for a start time.
3. Repeat the times back in one sentence and ask them to confirm, e.g. "So that's Monday 23 November at 9:00, and Tuesday 24 November at 14:00. Correct?"
4. Say the tenant will choose one of the times through our app and the company can see the approved contact details in the partner view after the tenant confirms. Thank them.
5. Call the submit_slots tool once, with the confirmed times converted to UTC ISO 8601 (for example Monday 23 November 2026 at 09:00 Berlin time is 2026-11-23T08:00:00Z), and a one-sentence summary. Then say goodbye and end the call.

# Rules
- Privacy: keep the unit, floor, tenant name, phone number, email and access notes private. If asked, say: "For privacy, the tenant's contact details are shared with you once they confirm one of the times through our app." Share the repair summary without personal details and the building's street address, including the building number, and postcode.
- Price: never promise or negotiate a price. If asked, say: "Your normal rates apply, and the property owner approves costs above 300 euros." 
- If the company cannot do the job, is fully booked, or is not interested: thank them, call submit_slots with an empty slots list and a short summary, then end the call.
- If you reach voicemail or an answering machine: do not leave any details. Call submit_slots with an empty slots list and the summary "Answering machine, no slots", then end the call.
- Never invent times the company did not say. Never call submit_slots more than once.
- If the person asks who you are: you are an AI assistant calling on behalf of reltix property management.
```

## 4. Dynamic variables

The app sends these values with each outbound call. The examples use demo data. [`callVariables`](../lib/agent/voice.ts)

| Name | Example | Source |
| --- | --- | --- |
| `company_name` | Hauswerk Aachen | Matched company's name |
| `company_id` | `c_hauswerk` | Matched company's ID |
| `problem_summary` | The balcony door does not close. | Ticket triage summary, with the fallback “A repair in an apartment” |
| `street_and_postcode` | Musterstraße 12, 52062 | Building street address and postcode |
| `preferred_days` | the next three working days, between 8:00 and 17:00 | Fixed preference in `callVariables` |
| `ticket_id` | `t_…` | Repair ticket ID |
| `attempt_id` | UUID | ID for this call attempt |
| `current_date` | `2026-11-20` | Current Berlin date in `YYYY-MM-DD` |
| `time_zone` | `Europe/Berlin` | Fixed call timezone in `callVariables` |

## 5. Webhook tool `submit_slots`

| Setting | Value |
| --- | --- |
| Tool ID | `<ELEVENLABS_TOOL_ID>` (assigned in the dashboard) |
| Request | `POST https://centrix-fix.vercel.app/api/agent/voice-result` |
| Headers | `Content-Type: application/json` and `x-webhook-secret: <VOICE_WEBHOOK_SECRET>`. The secret is a static header value in the tool configuration. |
| Response timeout | 20 s |
| Success response | `{ "ok": true }` |

The JSON Schema describes the tool's request body. Bind `ticket_id`, `company_id` and `attempt_id` directly to the dynamic variables with the same names. The model supplies `slots` and `summary`. The callback needs `attempt_id` when calling the same company again for a ticket, including seed tickets reused after a reset. [ElevenLabs webhook tool configuration](https://elevenlabs.io/docs/eleven-agents/customization/tools/webhook-tools)

```json
{
  "type": "object",
  "required": ["ticket_id", "company_id", "slots", "summary"],
  "properties": {
    "ticket_id": { "type": "string", "pattern": "^t_" },
    "company_id": { "type": "string", "pattern": "^c_" },
    "attempt_id": { "type": "string", "format": "uuid" },
    "slots": {
      "type": "array",
      "minItems": 0,
      "maxItems": 3,
      "items": { "type": "string", "format": "date-time", "pattern": "Z$" }
    },
    "summary": {
      "type": "string",
      "maxLength": 1000,
      "description": "One sentence summarizing the outcome of the call."
    }
  }
}
```

### Example payload

At 09:00 in Berlin in winter, the UTC time is 08:00Z.

```json
{
  "ticket_id": "t_…",
  "company_id": "c_hauswerk",
  "slots": ["2026-11-23T08:00:00Z", "2026-11-23T13:00:00Z", "2026-11-24T10:00:00Z"],
  "summary": "Offered Mon 09:00, Mon 14:00 and Tue 11:00; normal rates apply."
}
```

### Receiver validation

The API compares the shared secret in constant time for equal-length values. It returns `401` with `Invalid or missing webhook secret` if the header is wrong or missing, or if the server secret is unset. After authentication, an unknown ticket returns `404`. A ticket assigned to a different company or one that is no longer waiting for a call result returns `409`. [Webhook route](../app/api/agent/voice-result/route.ts) · [Comparison helper](../lib/http.ts)

The receiver accepts up to ten ISO 8601 timestamps, including explicit offsets, and defaults an omitted summary to an empty string. The tool sends at most three UTC timestamps and a summary. [Body validator](../lib/schemas.ts) · [Result handling](../lib/flow.ts)

## 6. Start-call API

The app sends `POST https://api.elevenlabs.io/v1/convai/twilio/outbound-call` with `xi-api-key: <ELEVENLABS_API_KEY>` and `Content-Type: application/json`. The destination is the demo override when set, otherwise the assigned company's phone number. [App implementation](../lib/agent/voice.ts)

```json
{
  "agent_id": "<ELEVENLABS_AGENT_ID>",
  "agent_phone_number_id": "<ELEVENLABS_PHONE_NUMBER_ID>",
  "to_number": "<DESTINATION_PHONE_NUMBER>",
  "conversation_initiation_client_data": {
    "dynamic_variables": {
      "company_name": "Hauswerk Aachen",
      "company_id": "c_hauswerk",
      "problem_summary": "The balcony door does not close.",
      "street_and_postcode": "Musterstraße 12, 52062",
      "preferred_days": "the next three working days, between 8:00 and 17:00",
      "ticket_id": "t_…",
      "current_date": "2026-11-20",
      "time_zone": "Europe/Berlin"
    }
  }
}
```

The provider response has `success` (boolean), `message` (string), and optional `conversation_id` and `callSid` strings. The app reads `success` and returns `conversation_id` when provided. The request times out after 8 s. A timeout, request error, non-2xx response or explicit `success: false` sends the ticket to `needs_human`. [ElevenLabs outbound-call API](https://elevenlabs.io/docs/eleven-agents/api-reference/integrations/twilio/outbound-call) · [Ticket flow](../lib/flow.ts)

## 7. Privacy and consent

- Before consent, the call shares the repair summary and the building's street address and postcode. The unit, floor, tenant name, phone number, email and access notes stay private. The app passes this context and scheduling metadata to ElevenLabs. The prompt instructs the agent to omit personal details from the spoken summary.
- If asked for the tenant's name, phone, email, floor or access notes, the agent declines and explains that contact details are shared after the tenant confirms a slot in the app. If asked who is calling, it says it is an AI assistant calling on behalf of reltix property management.
- The partner view shows tenant name, phone number, full address and access notes after the tenant confirms a slot and consents to those fields in the app. The ticket records which fields the tenant agreed to share, when, and through which channel. The prototype's booking notification to the company contains the appointment time. [Ticket flow](../lib/flow.ts)
- On an answering machine, the agent leaves no message.

## 8. Test scenarios

Final demo call (used in the pitch video): tenant reported "The balcony door doesn't close properly anymore, the handle is loose" → windows/doors → matched to the phone-booking partner Hauswerk Aachen → the agent called (routed to a tester's phone), collected Monday 09:00 and 14:00 → times appeared in the tenant app → booked.

Earlier fallback test (20 Nov): tenant reported "locked out, key broke" → AI triage locksmith (urgent, 99%) → no partner covers locksmith → app called the non-partner Schlüsseldienst am Markt via ElevenLabs + Twilio (routed to the tester's phone by `VOICE_TEST_TO_NUMBER`) → agent collected Monday 09:00 and 14:00 → `submit_slots` posted to the live API → times appeared in the tenant app → tenant booked with consent.


Each submitted payload includes the same ticket and company IDs from the call context.

| What the repair company says | Expected agent behaviour | Expected payload | Status |
| --- | --- | --- | --- |
| “Monday 23 November at 09:00 or 14:00, or Tuesday 24 November at 11:00.” | Repeat all three Berlin times, confirm them, and submit once. | Three slots and the summary from section 5. | Two-slot variant passed in the documented live test. Three-slot variant remains to rehearse. |
| “Only Wednesday 25 November at 10:00 next week.” | Confirm the date and time and accept the single slot. | `slots: ["2026-11-25T09:00:00Z"]` and a one-sentence summary. | to rehearse |
| “We're fully booked.” | Thank the company, submit the empty result, then end the call. | `slots: []` and a summary such as “The company is fully booked.” | to rehearse |
| “What should we charge?” | Say normal rates apply and the property owner approves costs above €300. Return to collecting times without agreeing a price. | No payload for the question alone. Submit confirmed slots and an outcome summary once the company responds about availability. | to rehearse |
| “What's the tenant's phone number?” | Decline and explain when contact details are shared. Return to collecting times. | No payload for the question alone. Submit the call outcome without tenant contact details. | to rehearse |
| Answering machine greeting | Leave no message, submit the empty result, then end the call. | `slots: []`, `summary: "Answering machine, no slots"`. | to rehearse |
| No conversation. Send a valid test body with a wrong secret, then with the right secret and an unknown ticket. | API checks authentication before looking up the ticket. | See the curl check below. Wrong secret → `401 Invalid or missing webhook secret`. Right secret with unknown ticket → `404`. | passed |

## 9. What breaks first

| Risk | What to expect |
| --- | --- |
| Accents, background noise and date recognition | The agent may mishear a weekday or time. It asks for a concrete start time and repeats the weekday, date and time for confirmation. |
| Timezone conversion | The agent may apply the wrong Berlin offset around daylight-saving changes. The server validates ISO 8601 and normalizes timestamps to UTC. A valid timestamp can still encode the wrong hour. |
| Answering machines | A recorded greeting can sound like a person. The prompt instructs the agent to submit zero slots and hang up without leaving a message when it detects voicemail. |
| Twilio limits | Check Twilio Voice geo permissions for the destination. On a trial account, outbound calls can reach only verified recipients. Verify the teammate’s number before rehearsing. [Twilio trial restriction](https://www.twilio.com/docs/api/errors/14111) |
| Requests outside the script | If the company needs details the agent cannot provide, the call may produce no slots and require a property manager to follow up. |
| Latency and missing callbacks | Dialling, turn-taking and the webhook can take time. Ticket reads and mutations send an unbooked phone match with no slots to `needs_human` more than four minutes after its latest call event. |

## 10. Plan B for the stage

Open the configured agent’s browser test link in ElevenLabs and have a teammate play the repair company. Append the eight URL-encoded parameters below. Use synthetic repair details and the IDs of a demo ticket and its assigned company if you want the webhook to attach slots. The ticket must be `matched` with no proposed slots. [ElevenLabs URL parameter format](https://elevenlabs.io/docs/eleven-agents/customization/personalization/dynamic-variables)

```text
&var_company_name=<COMPANY_NAME>
&var_company_id=<COMPANY_ID>
&var_problem_summary=<PROBLEM_SUMMARY>
&var_street_and_postcode=<STREET_AND_POSTCODE>
&var_preferred_days=<PREFERRED_DAYS>
&var_ticket_id=<TICKET_ID>
&var_current_date=<CURRENT_DATE>
&var_time_zone=<TIME_ZONE>
```

For the manual fallback, an owner or admin can open a ticket in `needs_human` or `emergency` in their view and assign an active company. Calendar partners use their calendar. Phone-booking partners and non-partners use the voice path. [Admin ticket view](../app/admin/_components/ticket-sheet.tsx) · [Ticket flow](../lib/flow.ts)

## 11. Setup checklist

- [ ] To recreate the setup, create the agent with section 3's settings, first message and prompt. Add the eight dynamic variables and enable `end_call`.
- [ ] Create and attach the `submit_slots` webhook tool using section 5's schema, variable bindings, static header and timeout.
- [x] **Twilio connected (20 Nov).** The team imported a Twilio number into ElevenLabs and linked it to the agent for the recorded demo. In ElevenLabs go to **Phone Numbers → Import → Twilio**, import a Twilio number and link it to the agent. Enter the Twilio Account SID and Auth Token in the dashboard only. For trial use, verify the phone number of the teammate playing the company. [ElevenLabs Twilio import guide](https://elevenlabs.io/docs/eleven-agents/phone-numbers/twilio-integration/native-integration)
- [ ] Set the server-only variables in the Vercel project and redeploy. Keep local copies in teammates' `.env.local` files only.
- [ ] Verify the webhook with the curl check below. Then rehearse the live call scenarios with the verified demo recipient.

| Server variable | Value or purpose |
| --- | --- |
| `ELEVENLABS_API_KEY` | `<ELEVENLABS_API_KEY>` authenticates the outbound API request. |
| `ELEVENLABS_AGENT_ID` | ID of the booking agent. |
| `ELEVENLABS_PHONE_NUMBER_ID` | ElevenLabs ID of the imported Twilio number. |
| `VOICE_TEST_TO_NUMBER` | `<VERIFIED_DEMO_PHONE_NUMBER>` routes all demo calls to the teammate. |
| `VOICE_WEBHOOK_SECRET` | `<VOICE_WEBHOOK_SECRET>` matches the static header value in the ElevenLabs tool. |

Run this with `VOICE_WEBHOOK_SECRET` set in your shell from the configured value. Leave `t_unknown_test` as a nonexistent ticket. The expected result is `409`. To check authentication, replace the header value with the literal placeholder `<WRONG_WEBHOOK_SECRET>` and expect `401`.

```bash
curl -i -X POST 'https://centrix-fix.vercel.app/api/agent/voice-result' \
  -H 'Content-Type: application/json' \
  -H "x-webhook-secret: ${VOICE_WEBHOOK_SECRET}" \
  --data '{"ticket_id":"t_unknown_test","company_id":"c_hauswerk","slots":[],"summary":"Webhook test."}'
```

## 12. Connector for the next partner

Any voice or booking provider can use the eight inputs in section 4. The app supplies the company and ticket IDs, the repair summary and location, the preferred time window, the current date, and the local timezone. A phone provider also needs a destination number. Keep tenant contact details and access notes behind the app's confirmation and consent step.

Return the original IDs, up to three confirmed UTC start times, and a one-sentence outcome by authenticated `POST /api/agent/voice-result`. Send an empty array when the provider cannot offer a time so a property manager can take over. The app validates and stores proposed times, and the tenant makes the booking decision in centrix Fix. ElevenLabs and Twilio are specific to this demo. The request shape and ticket state rules are shared. [Voice-result contract and behaviour notes](./contract.md)
