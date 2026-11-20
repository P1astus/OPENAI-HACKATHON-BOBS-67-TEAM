# Prompt: Tropimatico — voice agent and messages

Paste everything below the line into Claude (chat or Claude Code). Most of this job happens in the ElevenLabs dashboard, so ask Claude to walk you through it step by step.

---

I own the voice part of a 24-hour hackathon project. Deadline: **Sat Nov 21, 10:30**. First read `CLAUDE.md`, `docs/system-design.md` (section 5, steps 7–9) and `docs/contract.md` (the `POST /api/agent/voice-result` route) in our repo.

## What we're building
When a tenant reports a problem and **no partner company** fits, our app finds a local non-partner company. My job: an **AI voice agent that phones that company** and agrees on appointment times, then sends those times back to our app, so the tenant can pick one with one tap.

I own: the ElevenLabs agent configuration, `docs/voice-agent.md`, and (optional) the n8n workflow. armaNKataria owns the code that starts the call and receives the result. I give armaNKataria the exact details they need.

## Step 1: the agent in ElevenLabs (Conversational AI / Agents)
Help me create an agent with:
- **Name:** "centrix repair booking".
- **Voice:** calm, professional, with a German accent speaking English. (For the demo, English. Note in the doc that production would use German.)
- **First message:** "Hello, this is the booking assistant from reltix property management. Do you have a minute to book a repair job?"
- **Dynamic variables** (filled in by our app for each call): `company_name`, `problem_summary`, `street_and_postcode`, `preferred_days`, `ticket_id`.
- **System prompt.** Write it with me, covering:
  - Goal: get **2–3 concrete appointment slots** (date + start time) for the job, within the preferred days if possible.
  - Say what the job is (`problem_summary`) and where (`street_and_postcode`). **Never share the tenant's name or phone number.** They are shared only after the tenant confirms a slot, through our app.
  - If asked about price: "the company's normal rates apply; the owner approves costs above €300". Never promise a price.
  - If the company can't do it or isn't interested: thank them and end. Report zero slots.
  - If it's an answering machine: no message with details. End the call and report zero slots.
  - Repeat the slots back to confirm before ending. Keep the call under 2 minutes, polite and short.
- **Tool (server/webhook tool) `submit_slots`:** called once at the end. It POSTs to `https://<our-vercel-url>/api/agent/voice-result` with JSON `{ "ticket_id": "{{ticket_id}}", "company_id": "...", "slots": ["2026-11-23T09:00:00Z", ...], "summary": "one sentence of what was agreed" }` and the header `x-webhook-secret: <VOICE_WEBHOOK_SECRET>`. Slots must be ISO 8601 in UTC. Tell the agent the current date and the time zone (Europe/Berlin) so it converts correctly.

## Step 2: test it without the app
1. Use the dashboard's test call or web widget. A teammate plays the plumber with different behaviours: (a) happy, offers 3 times, (b) only one time next week, (c) "we're fully booked", (d) asks about price, (e) asks for the tenant's phone number. The agent must refuse (e) politely.
2. Point the tool at a temporary request inspector (e.g. webhook.site) first, and check the JSON is exactly the contract shape with correct UTC times.
3. Write down which scenarios work reliably. Only those go in the demo.

## Step 3: real phone call (only if step 2 is solid)
- Outbound phone calls need a phone number connected to ElevenLabs (e.g. via their Twilio integration). On a Twilio trial you can only call **verified** numbers, so verify the teammate's phone that plays the company.
- Find the exact API call to start an outbound call with dynamic variables in ElevenLabs' current docs, and write it into `docs/voice-agent.md` (endpoint, headers, body). armaNKataria codes it from that.
- **Plan B for the stage:** if the phone call fails live, we run the same agent in the browser widget with the teammate talking to it. Both must post to the same webhook.

## Step 4: `docs/voice-agent.md` (hand-over doc, PR on `feat/voice`)
Include: what the agent does in two sentences, the full system prompt, the dynamic variables, the tool definition and an example payload, the start-call API details, which scenarios were tested and passed, what breaks first (accents, background noise, answering machines), the privacy rule (no tenant data before consent), and the env vars needed (`ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `VOICE_WEBHOOK_SECRET`). Values go in the team's shared secrets, **never in the repo or chat screenshots**.

## Step 5 (optional, only after steps 1–4): n8n status messages
An n8n Cloud workflow with a Webhook trigger (`N8N_WEBHOOK_URL`) that receives `{ ticket_id, event, to, message }` and sends an email (e.g. "Your repair is booked for Mon 23 Nov, 09:00, WarmHaus"). armaNKataria calls it on "booked" and "invoiced". It's nice to have, not in the demo path.

## Done means
- The agent books 3 slots in a test call and the webhook receives the correct JSON.
- `docs/voice-agent.md` is merged and armaNKataria has everything needed to start a call.
- We've rehearsed the live call 3 times, and plan B works.

## Milestones
- +1 h: agent created, first test call.
- +3 h: tool posts correct JSON to the inspector; doc draft.
- ~20:00: connected to our live URL with armaNKataria.
- Sat 07:30: freeze; rehearse.
