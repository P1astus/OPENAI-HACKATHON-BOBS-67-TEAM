# centrix Fix

When something breaks in a rented apartment, centrix Fix uses AI to understand the tenant’s report, lets them book the best-matched repair company in one tap once they pick a time, records payment from the owner’s centrix wallet, and asks the tenant to rate the company.

**Live:** https://centrix-fix.vercel.app · **Demo (all four views side by side):** https://centrix-fix.vercel.app/demo

## Try the demo

Open `/demo` at 1200 px wide or more to follow each action across the four views.

1. **Report a cold apartment in `/tenant`.** As Lena, select **Report a problem** and enter “The heating is cold in every room.”
   AI triages the report as heating, and the matching code picks WarmHaus Heizungstechnik.
   Pick a time and select **Confirm booking** to agree to share the listed repair details.
2. **Approve the €420 pump repair in `/owner`.** Open the separate pump-fault ticket already waiting for Maria.
   Repairs estimated above €300 need owner approval. Approve it, have Lena pick and confirm a time in `/tenant`,
   then select **Accept** in `/partner`.
3. **Try the phone-partner call in `/tenant`.** As Lena, enter “The balcony door doesn't close properly anymore, the handle is loose.”
   The best match is Hauswerk Aachen, a partner that takes bookings by phone instead of an online calendar, so the AI voice agent calls it.
   In the demo, the call goes to a teammate playing the company. The agreed times appear for Lena to choose.
4. **Finish a repair and rate it.** In `/partner`, use WarmHaus’s green **Mark as done** on the seeded past radiator appointment
   to see the invoice flow. For Lena’s newly booked job, use **Mark done**.
   Confirm the amount with **Send invoice** and see the payment recorded against Maria’s wallet in `/owner`.
   You can use **Charge to tenant** to forward the cost. Back in `/tenant`, send a 1–10 rating for Lena’s completed repair and watch WarmHaus’s score update.
5. **Clarify an unclear request in `/owner` or `/admin`.** Open the seeded “Something in the hallway seems wrong” ticket.
   Call or email the tenant from the ticket. Enter “The hallway radiator is cold” under **What’s the actual problem?** and select **Find the right company**.
   The app re-triages the report and matches it again. While a ticket needs a person, the owner or admin can assign any active company from the list grouped by trade. If the trade and location are known, **Search online** provides unverified suggestions.

Use **Reset demo** in `/demo` or `/admin` to restore the seed data.

## The four views

| Route | Who | What they do |
|---|---|---|
| `/tenant` | Tenant, phone-first | Report a problem, track progress, book with consent, rate repairs, and pay forwarded invoices. |
| `/partner` | Repair company | Accept booked jobs, mark work done, send an invoice, and see company ratings. |
| `/owner` | Property owner | Approve estimates, clarify reports, see wallet-paid invoices, and forward charges to tenants. |
| `/admin` | reltix operations | Review emergencies and unclear reports, assign companies, and inspect tickets, invoices, and company ratings. |
| `/demo` | Judges and presenters | Follow the same tickets across all four views in one place. |

## How it works

```text
Tenant report → triage → match → tenant books → company marks done → wallet payment recorded → tenant rates

Triage → human review for an emergency, unclear trade, or low confidence
Match → owner approval if the estimate is over €300
Availability → partner calendar, or a voice-agent call to a partner that books by phone → tenant picks a time
```

- **AI triage.** OpenAI returns validated structured output for trade, urgency, confidence, and a short summary.
  Safety rules catch terms such as “gas” before any model call. Emergencies, unclear trades, and confidence below 0.7
  go to a human. If the model fails, a labelled keyword guess sends new reports to a property manager.
  A human clarification that identifies a single trade can still proceed.
- **Matching.** Code ranks active companies that cover the trade and address using
  `0.5 × reviews + 0.3 × price + 0.2 × distance`, with each input scaled to 0–1.
  Eligible partners come first. An estimate over €300 requires owner approval before the app offers times.
- **Voice.** ElevenLabs Agents calls partners that book by phone (and, as a fallback, non-partners) through Twilio. Agreed times come back through a
  shared-secret-authenticated webhook. The call context includes a repair summary and building location. The app omits the structured tenant contact fields, unit details, and access notes from the call payload.
- **Ratings.** A 1–10 review maps to a score from −1 to 1 (1 → −1, 5 → 0, 7 → 0.5, 10 → 1).
  From five reviews onward, the company score is the average of its converted reviews.
  Companies scoring below −0.3 are removed from matching. A non-partner becomes a potential partner when its score is
  above 0.4, at least three reviews are above 6, and good reviews (above 5) are at least as numerous as bad ones (below 5).
- **Consent.** The partner view shows tenant contact details, the full address, and access notes only after the tenant
  confirms the booking and agrees to share those fields. The app records what was shared, when, and through which channel.
- **Business model.** Owners pay a subscription. centrix takes no commission from anyone. reltix finance handles payment terms, such as 30 days, and accounting. The app shows invoice payment status.
- **Numbers.** Code computes estimates, distances, match scores, and company ratings from stored data and user input.
  AI confidence comes from a validated numeric field and is formatted by code. Model prose supplies none of those figures.

## Connector for the next partner

- **Phone only.** Provide a staffed dispatch number that can offer and confirm appointment times.
- **Calendar.** Provide availability and job endpoints backed by the company’s calendar so centrix can offer times and book the selected slot.
- **Full API.** Add signed status webhooks and invoice data so centrix can update the ticket and link the invoice to the unit.

The [connector spec](docs/connector-spec.md) defines the three levels and the data each partner provides.

## Tech

Next.js 16 App Router, TypeScript, Tailwind CSS v4, and shadcn/ui. SWR polls every two seconds so changes appear
across views. OpenAI handles triage and web search. ElevenLabs Agents and Twilio handle voice calls.
The app is deployed through the Vercel CLI. Upstash Redis shares state on Vercel, and local development defaults to in-memory state.
Vitest covers the repair flow, triage, matching, ratings, and web search parsing.

| Folder | Contents |
|---|---|
| `app/` | Tenant, partner, owner, operations, and demo pages |
| `app/api/` | Ticket, company, invoice, reset, and voice callback routes |
| `components/` | Shared UI, repair clarification, and rating displays |
| `lib/` | Ticket workflow, matching, ratings, seed data, and state |
| `lib/agent/` | OpenAI triage and web search, plus outbound voice calls |
| `docs/` | Design, contracts, and integration guides |
| `tests/` | Vitest suites |

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000 or http://localhost:3000/demo.

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

| Environment variable | What happens when unset |
|---|---|
| `OPENAI_API_KEY` | New reports go to human review through the safety rules or a labelled keyword fallback. Web search is unavailable. |
| `OPENAI_MODEL` | Triage and web search fall back to `gpt-5.5`. The example file sets a model override. |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `ELEVENLABS_PHONE_NUMBER_ID` | If any is unset, calls are simulated and labelled in the ticket timeline. |
| `VOICE_TEST_TO_NUMBER` | When voice is configured, the call uses the matched company’s stored number. |
| `VOICE_WEBHOOK_SECRET` | The voice callback rejects requests. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | The app checks the alternate Vercel variable names and uses memory if Redis credentials are unavailable. |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Alternate Redis settings. Leave the corresponding `UPSTASH_REDIS_REST_*` variables unset when using these aliases. A blank primary value takes precedence. |
| `N8N_WEBHOOK_URL` | Optional status webhooks for booking and invoicing are skipped. |
| `NEXT_PUBLIC_USE_MOCKS` | The UI uses the app API by default. Set `NEXT_PUBLIC_USE_MOCKS=1` for a UI-only mock backend. |

## Honest limits

- Partner calendars are simulated. Wallet payments are recorded as invoice status changes in the demo.
- Demo calls route to a test phone. The voice agent speaks English, with German planned for production.
- The OpenAI SDK also supports `OPENAI_BASE_URL` for the local recording fixture. See the [recording guide](scripts/video/README.md).
- The demo uses synthetic data for one property and one owner.
- Web search returns unverified local company suggestions for human review.
- The `?as=` query parameter selects the demo viewer. The demo has no authentication, and booking consent controls field visibility in the partner UI.

## Docs

- [System design](docs/system-design.md)
- [API contract](docs/contract.md)
- [Connector spec](docs/connector-spec.md)
- [Voice agent](docs/voice-agent.md)
- [UI plan](docs/ui-plan.md)
- [Pitch video and transcript](docs/pitch-video.md)

## Team

Antoni Potrykowski (P1astus), Arman Kataria (armaNKataria), Timo Aavila (Tropimatico), and Valentin Nagel (valoi2). MAIN Summit & AI Hackathon 2026, Maastricht.

reltix track · “Plug a Partner into centrix”
