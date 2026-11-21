# centrix Fix connector specification

## 1. In one paragraph

The centrix Fix connector gives service companies one way to receive, book and close jobs from centrix. When something breaks in an apartment, the tenant reports it in centrix, the best eligible company gets a prefilled job, and the tenant books a time in one tap. centrix writes the appointment, outcome, invoice and feedback back to the unit. A partner can start with a phone number and add calendar or API access later while keeping the same job lifecycle. [Track brief](../CLAUDE.md#3a-our-track-reltix-plug-a-partner-into-centrix) · [System design](./system-design.md)

```text
Tenant reports repair → centrix triages, matches and checks owner approval
  → Company offers times → tenant confirms a time and agrees what to share
  → Company completes job → centrix links invoice and feedback to the unit
Emergency, no match or failed handoff → property manager
```

| Capability | Status | What is available |
|---|---|---|
| Ticket lifecycle, approval, consent and rating | Implemented in demo | centrix routes and screens, consent recorded on booking, field visibility in the partner view and automated rating rules. |
| Calendar availability and booking | Implemented in demo (simulated) | centrix reads and updates its own `calendar_slots`. |
| Phone availability | Implemented in demo (live) | ElevenLabs calls a tester standing in for the company. `POST /api/agent/voice-result` received the slots in the documented live test. |
| Partner manifest, external availability and jobs APIs, `POST /api/partner-events` | Specified (target) | The manifest, partner-hosted endpoints and centrix event receiver below define the real integration. The demo has no `/api/partner-events` route. |
| Invoice and wallet | Implemented in demo (simulated) | Invoice linked to the unit and marked paid. Real settlement belongs to reltix finance. |

## 2. What a partner gets and gives

| The partner gets | The partner provides |
|---|---|
| A steady source of local jobs without marketing costs | Trades, coverage, prices and a reliable booking contact |
| Prefilled repair context and bookings from its own calendar or by phone | Free times, confirmation of the selected time and completion details |
| Tenant contact data once the tenant confirms the slot and agrees to share it | Use of those details to deliver the job and arrange access |
| The full invoice amount from the owner's centrix wallet for finished work | An invoice at its normal price with a job reference |

Owners pay a subscription, the service's only source of revenue. Partners and non-partners pay nothing to participate and centrix takes no commission. reltix finance sets and manages payment terms. [Business model](./system-design.md#3-business-model)

## 3. Three integration levels

| Level | Partner must provide | Effort | What centrix does |
|---|---|---|---|
| **1 · Phone-only** | A staffed phone number and a person who can offer and confirm times | No IT work | Calls with the ElevenLabs voice agent, posts offered times back to centrix, confirms the tenant's choice through the agreed channel and records outcomes. |
| **2 · Calendar** | `GET /availability` and `POST /jobs` backed by its own calendar | Small calendar adapter | Reads free times, proposes a time, books it after tenant confirmation and gives the partner a portal or assisted channel for completion and invoices. |
| **3 · Full API** | Level 2 endpoints, outbound status webhooks and invoice data | Calendar plus job and billing integration | Receives signed events, updates the timeline and links the invoice automatically. |

WarmHaus Heizungstechnik and the other calendar partners illustrate Level 2 with simulated calendars. **Hauswerk Aachen illustrates Level 1: a partner that takes bookings by phone.** The demo placed a live call with the voice agent (routed to a tester's phone). The demo chooses the channel by the partner's booking method: calendar partners offer calendar times, phone partners are called by the voice agent. Commercial partner status controls matching priority and is set separately by reltix. [Demo matching and booking contract](./contract.md) · [Recorded voice test](./voice-agent.md#8-test-scenarios)

## 4. Partner manifest

Register one JSON document with reltix. Use a stable `c_` ID and HTTPS URLs. Level 1 can supply its details by phone for reltix to register. Levels 2 and 3 supply an API base URL. A website can support assisted booking at any level.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | Yes | Stable company ID assigned or confirmed by reltix. |
| `legal_name` | string | Yes | Name used for onboarding and billing. |
| `trades` | nonempty array of strings | Yes | Current demo accepts `heating`, `plumbing`, `electrical`, `locksmith`, `appliances`, `windows_doors`, `pest_control`, `roofing`, `general`. Target codes can be extended by agreement. |
| `service_area` | object | Yes | Either `center: { lat, lng }` and positive `radius_km`, or `postcodes` as a nonempty array of strings. Postcodes are scoped to the country agreed at onboarding. |
| `pricing` | object | Yes | Nonnegative `hourly_rate_eur` and `callout_fee_eur`. Optional `fixed_prices` maps trade codes to all-in visit prices in EUR. |
| `integration_level` | integer | Yes | `1`, `2` or `3`. |
| `booking` | object | Yes | `phone` required at Level 1, `base_url` required at Levels 2–3, `website` optional at all levels. |
| `required_job_fields` | array of strings | Yes | Booking requirements from the job schema in §6, as field paths. An empty array means the core fields suffice. |
| `consent_scopes` | array of strings | Yes | Subset of `name`, `phone`, `address`, `access_notes`, `photos`. Each required personal field must have a matching scope. |
| `support` | object | Yes | At least one operational contact, `email` or `phone`, for booking exceptions. |
| `sla` | object | Yes | Positive integer `response_minutes` for offer response during agreed service hours, boolean `emergency` for availability to the property manager. |
| `webhook_signing` | object | Level 3 | `algorithm` is `HMAC-SHA256`, `header` is `X-Centrix-Signature`. Share signing material separately through a secure channel. |

Money is expressed as EUR numbers with up to two decimal places. The demo estimates hourly labour plus callout. The target can use a registered fixed price for the trade when one is available. A partner's emergency capability helps a property manager pick whom to call. Emergency tickets always go to a human first.

```json
{
  "id": "c_warmhaus",
  "legal_name": "WarmHaus Heizungstechnik",
  "trades": ["heating", "plumbing"],
  "service_area": {
    "center": { "lat": 50.7791, "lng": 6.0918 },
    "radius_km": 22
  },
  "pricing": { "hourly_rate_eur": 92, "callout_fee_eur": 44 },
  "integration_level": 2,
  "booking": {
    "base_url": "https://warmhaus.example/api/centrix/v1",
    "website": "https://warmhaus.example/book"
  },
  "required_job_fields": ["selected_slot", "contact.address"],
  "consent_scopes": ["name", "phone", "address", "access_notes"],
  "support": { "email": "dispatch@warmhaus.example", "phone": "<SUPPORT_PHONE>" },
  "sla": { "response_minutes": 30, "emergency": false }
}
```

## 5. Availability

**Levels 2–3 (specified).** `GET {partner_base}/availability?trade=&from=&to=&lat=&lng=`

- Send the registered trade, an inclusive `from` and exclusive `to`, and coordinates for the service area check. Use a coarse point such as the postcode centroid before confirmation. centrix checks exact coverage internally and uses the registered postcodes for postcode-based partners.
- Return unique, free appointment start times as ISO 8601 UTC strings ending in `Z`. Return an empty `slots` array if none are available. The partner applies its working hours and capacity for the trade in its local timezone.
- centrix shows the first three free slots in chronological order, at least two hours ahead. A returned time is a proposal. The partner reserves the time atomically on confirmation. In the demo, seeded calendars use workdays at 09:00, 11:00 and 14:00 Berlin time, and the code filters strictly beyond the two-hour cutoff. [Calendar data](./contract.md#where-the-data-lives) · [Slot selection](../lib/flow.ts)

```json
{
  "slots": ["2026-11-23T08:00:00Z", "2026-11-23T13:00:00Z", "2026-11-24T10:00:00Z"]
}
```

**Level 1 (live voice path in the demo).** The agent calls for concrete times. The agent's tool posts the result to `POST {centrix}/api/agent/voice-result` with `Content-Type: application/json` and the `x-webhook-secret` header. centrix checks the shared secret and accepts results only for the assigned company while the ticket is `matched` with zero proposed slots. It acknowledges with `{ "ok": true }`, normalizes and deduplicates times, discards past or already booked starts and keeps up to three. The two-hour calendar cutoff does not apply to the demo's voice results. This request uses the live route's payload shape with a placeholder ticket ID. [Voice agent and test results](./voice-agent.md) · [Webhook schema](../lib/schemas.ts)

```json
{
  "ticket_id": "t_voice_example",
  "company_id": "c_schluessel",
  "slots": ["2026-11-23T08:00:00Z", "2026-11-23T13:00:00Z"],
  "summary": "Offered Monday at 09:00 and 14:00 Berlin time."
}
```

## 6. Jobs

**Levels 2–3 (specified).** `POST {partner_base}/jobs` with `Content-Type: application/json` and `Idempotency-Key`. centrix supplies a stable `job_id` for this assignment and a `ticket_id` for the original service request. A reassignment gets a new job ID. Use HTTPS and a credential scoped to the partner and environment, provisioned at onboarding. The same authentication covers availability reads.

**A. Offer before consent.** The offer supplies the trade, urgency, a redacted problem summary, street name and postcode, proposed times and an estimate. `urgency` is `normal` or `urgent` for automatic offers. A successful offer response means the partner accepts the job in principle. It may release unconfirmed proposals through normal calendar updates.

```json
{
  "stage": "offer",
  "job_id": "job_warmhaus_001",
  "ticket_id": "t_repair_001",
  "trade": "heating",
  "urgency": "normal",
  "problem_summary": "Apartment radiators stay cold when heating is on.",
  "location": { "street": "Example Street", "postcode": "52062" },
  "proposed_slots": ["2026-11-23T08:00:00Z", "2026-11-23T13:00:00Z"],
  "estimated_cost_eur": 228.00
}
```

**B. Confirmation after the tenant chooses a slot.** centrix repeats the offer context, adds the `selected_slot` and includes only contact fields needed for the job, listed in the manifest and agreed to by the tenant. The `address` scope covers the full address, floor and unit label. The optional `photos` scope allows short-lived authorized photo links in `contact.photos`. If the tenant withholds a required field, centrix gives the property manager the case to resolve.

```json
{
  "stage": "confirm",
  "job_id": "job_warmhaus_001",
  "ticket_id": "t_repair_001",
  "trade": "heating",
  "urgency": "normal",
  "problem_summary": "Apartment radiators stay cold when heating is on.",
  "location": { "street": "Example Street", "postcode": "52062" },
  "proposed_slots": ["2026-11-23T08:00:00Z", "2026-11-23T13:00:00Z"],
  "selected_slot": "2026-11-23T08:00:00Z",
  "estimated_cost_eur": 228.00,
  "contact": {
    "name": "<TENANT_NAME>",
    "phone": "<TENANT_PHONE>",
    "address": {
      "street_address": "12 Example Street",
      "postcode": "52062",
      "city": "Aachen",
      "floor": 2,
      "unit_label": "2nd floor left"
    },
    "access_notes": "Ring the bell marked with the unit label."
  }
}
```

Both stages return a 2xx with the same job ID. A confirm succeeds only after the partner reserves the selected time. Use a distinct idempotency key per stage and per changed selection. On a retry, repeat the same body and key. Return the original success for a duplicate. Use `409` with JSON `code` set to `idempotency_conflict` for conflicting key reuse, `slot_unavailable` for a taken slot and `offer_declined` if the partner cannot take the job. centrix refreshes slots and asks the tenant to choose again on a slot conflict.

```json
{ "job_id": "job_warmhaus_001" }
```

At Level 1, the call plays the role of an offer. Confirm the selected time through the agreed channel after the tenant confirms it. In the demo, the booked notification contains the appointment time and the partner view shows permitted fields. External confirmation and scoped API delivery are target behavior. [Booking flow](../lib/flow.ts) · [Partner view](../app/partner/_components/partner-jobs.tsx)

## 7. Status updates back to centrix

**Level 3 (specified).** Send events to `POST {centrix}/api/partner-events` as JSON. Level 2 uses the same status meanings through the centrix portal. At Level 1, centrix records the same outcomes from the call or assisted follow-up.

```text
offered → accepted → scheduled → in_progress → done → invoiced
offered → declined
offered / accepted / scheduled / in_progress → cancelled
scheduled → rescheduled → scheduled (after tenant confirmation)
```

`offered` starts when centrix sends the job. At Levels 2–3, the successful offer and booking responses establish `accepted` and `scheduled`. A webhook reporting either state can acknowledge the same transition. `in_progress` is optional. A reschedule proposes replacement times and keeps the ticket on the same job ID.

| Partner status | centrix `TicketStatus` | Handling |
|---|---|---|
| `offered` | `matched` | centrix has selected a company. |
| `accepted` | `matched` | Partner accepted the offer. In the demo, `/accept` adds an event after booking and leaves the status `scheduled`. |
| `scheduled` | `scheduled` | Tenant confirmed and the time is reserved. |
| `in_progress` | `scheduled` | Record the start in the timeline. |
| `done` | `done` | Record completion and final amount. Demo `/complete` also creates and marks the invoice paid in one action. |
| `invoiced` | `invoiced` → `paid` | Link the invoice and reflect wallet payment. `paid` is a centrix state. |
| `declined` | `needs_human` | Close the offer and surface it to the property manager. |
| `rescheduled` | `matched` → `scheduled` | Record replacement slots, release the old appointment and wait for a new confirmation. |
| `cancelled` | `needs_human` | Record the cancellation reason, release capacity and route the ticket to the property manager. |

Each event sends `event_id`, `company_id`, `job_id`, `ticket_id`, `status` and UTC `occurred_at`. Add `slots` for a reschedule, a short `reason` for a decline or cancellation, `amount_eur` for completion and `invoice` for invoicing (§8).

- Set `X-Centrix-Signature: t=<unix-seconds>,v1=<hex-signature>`. Sign the UTF-8 timestamp, a literal period and the raw request body bytes with HMAC SHA-256. centrix compares signatures in constant time, allows five minutes of past or future clock skew and verifies that the sending company owns the job.
- Send `Idempotency-Key` equal to `event_id`. centrix stores each event and state update together, acknowledges identical duplicates and rejects conflicting key reuse with `409` and JSON `code` set to `idempotency_conflict`. A stale, already-applied event can be acknowledged without reverting state. An event waiting on a prerequisite returns `409` with code `missing_prerequisite`.
- A 2xx acknowledges durable receipt. On a timeout, `409` for a missing prerequisite, `429` or 5xx, retry with backoff, for example after 1 m, 5 m, 30 m, 2 h and 12 h. Keep the original body and idempotency key and sign each delivery with a fresh timestamp. Fix validation or authentication errors before retrying. Escalate exhausted retries to support.

```json
{
  "event_id": "evt_warmhaus_001_done",
  "company_id": "c_warmhaus",
  "job_id": "job_warmhaus_001",
  "ticket_id": "t_repair_001",
  "status": "done",
  "occurred_at": "2026-11-23T09:45:00Z",
  "amount_eur": 228.00
}
```

## 8. Invoice

For `status: "invoiced"`, attach an `invoice` object. centrix links it to the existing completed job. The Level 2 portal and Level 1 assisted channel capture the same information.

| Field on the linked invoice | Source and rule |
|---|---|
| `id` | centrix assigns an `inv_` ID. The partner sends a stable `invoice_ref` inside the invoice object so centrix can deduplicate invoice submissions across events. |
| `amount_eur`, `issued_at` | Partner supplies the final positive EUR total and UTC issue timestamp inside `invoice`. The total agrees with `done.amount_eur`. |
| `ticket_id`, `job_id`, `company_id` | Partner sends these in the event envelope. centrix checks them against the assignment. `job_id` is a connector reference and the demo `Invoice` stores `ticket_id` and `company_id`. |
| `unit_id`, `property_id` | Required on the stored invoice. centrix derives them from the ticket and its unit. |
| `payer`, `status`, `paid_at`, `forwarded_at` | centrix sets payment fields. The owner pays by default and may forward the charge to the tenant. |

```json
{
  "event_id": "evt_warmhaus_001_invoiced",
  "company_id": "c_warmhaus",
  "job_id": "job_warmhaus_001",
  "ticket_id": "t_repair_001",
  "status": "invoiced",
  "occurred_at": "2026-11-23T09:46:00Z",
  "invoice": {
    "invoice_ref": "warmhaus-invoice-001",
    "amount_eur": 228.00,
    "issued_at": "2026-11-23T09:46:00Z"
  }
}
```

The finished job is paid from the owner's centrix wallet when the invoice is linked. The partner receives the full amount. Forwarding changes who pays the charge within centrix and leaves the company invoice amount intact. reltix finance handles company settlement terms, such as 30 days. The demo `Invoice` has an internal `due_at` field. Payment terms are outside the connector. [Invoice type](../types.ts) · [Invoice lifecycle](./contract.md#ticket-lifecycle)

## 9. Result written to the unit

centrix stores the internal job result against the unit and resolves its property through `unit_id`. The example is a target joined view of the ticket, company and invoice, with a shortened timeline. In the demo, completion time is recorded through the invoice and timeline. The consent record lists fields shared and when and where the tenant agreed. Contact values stay out of the timeline. [Ticket and Invoice types](../types.ts) · [Demo lifecycle](./contract.md#ticket-lifecycle)

```json
{
  "ticket_id": "t_repair_001",
  "job_id": "job_warmhaus_001",
  "unit_id": "unit_example",
  "property_id": "prop_example",
  "company": { "id": "c_warmhaus", "name": "WarmHaus Heizungstechnik" },
  "trade": "heating",
  "appointment_at": "2026-11-23T08:00:00Z",
  "completed_at": "2026-11-23T09:45:00Z",
  "status": "paid",
  "invoice": {
    "id": "inv_repair_001",
    "amount_eur": 228.00,
    "issued_at": "2026-11-23T09:46:00Z",
    "payer": "owner",
    "status": "paid",
    "paid_at": "2026-11-23T09:46:00Z"
  },
  "rating": 9,
  "events": [
    { "at": "2026-11-20T10:00:00Z", "actor": "tenant", "type": "booked", "message": "Appointment confirmed." },
    { "at": "2026-11-23T09:45:00Z", "actor": "company", "type": "done", "message": "Repair completed." },
    { "at": "2026-11-23T09:46:00Z", "actor": "agent", "type": "paid_from_wallet", "message": "Invoice paid from the owner's wallet." },
    { "at": "2026-11-23T11:00:00Z", "actor": "tenant", "type": "rated", "message": "Tenant rated the repair 9/10." }
  ],
  "consent": {
    "data_shared": ["name", "phone", "address", "access_notes"],
    "given_at": "2026-11-20T10:00:00Z",
    "channel": "portal"
  }
}
```

## 10. Consent and privacy (GDPR)

- **Before confirmation.** Personal fields stay in centrix. Strip names, contact details, building numbers, unit information and photos from offer and call text. Share only the repair summary and street/postcode as repair context, with a coarse location for availability. A street and postcode can still be identifying in context. The voice prompt refuses tenant contact or access details and leaves no voicemail. The demo passes the seeded building address and triage summary into the call context. Strict street-only output and free-text redaction are target safeguards. [Voice implementation](../lib/agent/voice.ts) · [Voice prompt](./voice-agent.md)
- **At confirmation.** Show the company, purpose and fields to the tenant. Intersect the tenant's choices with the manifest scopes and the minimum needed for the job. Record `data_shared`, `given_at` and `channel` on the ticket. The demo records that choice and gates the partner view. Its booking schema also supports `email` and has no `photos` field. [Demo booking schema](../lib/schemas.ts) · [Partner view](../app/partner/_components/partner-jobs.tsx)
- **Use and retention.** Use job data for scheduling, access, service and billing. Restrict access to staff handling the job. Delete contact details and photos after completion and required follow-up, and retain only legally required invoice data for the applicable statutory period. Keep personal details out of logs and webhook status messages. [GDPR Article 5](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng/)
- **Legal basis and roles.** For necessary tenancy-repair processing, use GDPR Article 6(1)(b) where the tenant is party to the contract and processing is necessary for its performance. The booking consent record documents the tenant's sharing choices for transparency. Before go-live, establish who determines the purposes for each activity. A provider acting only on instructions needs Article 28 processor terms. A company deciding its own billing or statutory retention may be a controller for that activity. [GDPR Articles 4, 6 and 28](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng/)
- **Calls.** The target agent discloses that it is AI and who it represents at the start, with recording off by default. The documented demo prompt identifies the assistant and discloses AI when asked. Recording settings are outside the application code. [Voice agent configuration](./voice-agent.md#3-agent-configuration)

## 11. Quality and lifecycle

A tenant can leave one whole-number rating from 1 to 10 after the repair is invoiced or paid. From five reviews onward, the company score is the mean of all converted reviews.

| Tenant rating `r` | Review score |
|---|---|
| 1–5 | `(r - 5) / 4`, so 1 → −1 and 5 → 0 |
| 6–7 | `(r - 5) × 0.25`, so 6 → 0.25 and 7 → 0.5 |
| 8–10 | `0.5 + (r - 7) / 6`, so 10 → 1 |

| Company result | Rule and effect |
|---|---|
| New | Fewer than five reviews. No company score, removal or promotion. |
| Good | Score strictly above 0.4. A higher score raises the reviews component in matching. |
| Neutral | Score from −0.3 to 0.4 inclusive. Company remains eligible. |
| Bad | Score strictly below −0.3 with at least five reviews. Automatically removed from future matching. |
| Potential partner | Non-partner with a Good score, at least three reviews strictly above 6, and at least as many good reviews (above 5) as bad reviews (below 5). A rating of 5 counts toward neither total. reltix can approach the company for a deal. |

centrix ranks active companies that cover the trade and area. Eligible partners form the first pool. If none qualify, centrix ranks eligible non-partners. The formula is **0.5 × reviews + 0.3 × price + 0.2 × distance**. Reviews are rescaled to 0–1 and a new company gets 0.5. Within the pool, cheapest and closest each get 1, highest and farthest each get 0, and an all-equal dimension gets 1. The demo estimate is callout plus hourly rate times typical labour hours for the trade. Above €300, the owner must approve the estimate before booking proceeds. At €300 or below, centrix proceeds automatically if triage and matching allow it. Emergencies and cases with no match go to the property manager. [Matching](../lib/matching.ts) · [Rating](../lib/rating.ts) · [Ticket flow](../lib/flow.ts)

## 12. Plug in a new partner in five steps

1. [ ] **Register the manifest.** Confirm the legal name, stable ID, trades, coverage, pricing and dispatch contact with reltix.
2. [ ] **Choose an integration level.** Agree response time, service hours and minimum job fields. Confirm how centrix will send the selected time and share approved details.
3. [ ] **Connect the channel.** Give reltix a staffed phone number for Level 1. For Level 2, expose availability and jobs and verify portal access. For Level 3, also send signed events and invoices. Exchange credentials securely.
4. [ ] **Test in the sandbox.** Run one job through offer, confirmation, completion and invoice. Exercise a decline, a taken slot and a retry. Verify scoped disclosure, status mapping and one invoice on duplicate delivery. For Level 1, test a call with no available time.
5. [ ] **Go live.** Confirm production contacts or URLs, privacy roles and retention, and the escalation route. Verify the first job reaches the company's calendar or dispatcher and the result appears on the unit.

## 13. Two more manifests

**NetzWerk Aachen · fibre installation at move-in.** Use the property event “tenant moves in” to start the same job flow. `internet_installation` is an example of a registered extension. The target registry needs a trade code, trigger mapping and pricing rule for it. The demo's closed `Trade` enum and validator would reject the new code today. [Demo trades](../types.ts) · [Validator](../lib/schemas.ts)

```json
{
  "id": "c_netzwerk",
  "legal_name": "NetzWerk Aachen",
  "trades": ["internet_installation"],
  "service_area": { "postcodes": ["52062", "52064"] },
  "pricing": {
    "hourly_rate_eur": 65,
    "callout_fee_eur": 35,
    "fixed_prices": { "internet_installation": 129 }
  },
  "integration_level": 3,
  "booking": { "base_url": "https://netzwerk.example/api/centrix/v1" },
  "required_job_fields": ["selected_slot", "contact.address"],
  "consent_scopes": ["name", "phone", "address"],
  "support": { "email": "dispatch@netzwerk.example" },
  "sla": { "response_minutes": 60, "emergency": false },
  "webhook_signing": { "algorithm": "HMAC-SHA256", "header": "X-Centrix-Signature" }
}
```

**Hauswerk Aachen · phone-only partner.** An example registration for the partner used in the documented voice test.

```json
{
  "id": "c_hauswerk",
  "legal_name": "Hauswerk Aachen",
  "trades": ["general", "windows_doors", "plumbing", "electrical"],
  "service_area": { "center": { "lat": 50.7659, "lng": 6.0695 }, "radius_km": 16 },
  "pricing": { "hourly_rate_eur": 69, "callout_fee_eur": 40 },
  "integration_level": 1,
  "booking": { "phone": "<DISPATCH_PHONE>" },
  "required_job_fields": ["selected_slot", "contact.address"],
  "consent_scopes": ["address", "phone"],
  "support": { "phone": "<SUPPORT_PHONE>" },
  "sla": { "response_minutes": 15, "emergency": false }
}
```

- **Trigger and trade.** A balcony door that no longer closes starts a windows-and-doors job. A move-in can start a fibre and router installation. The trigger supplies the trade and a short job summary.
- **Partner setup.** The installer serves postcodes at a fixed visit price and reports by API. The handyman partner serves a radius at hourly rates and works by phone.
- **Shared flow.** Both use the same job reference, scoped booking confirmation, status meanings and invoice link to the unit.

## 14. Errors and edge cases

| Case | Behavior | Status |
|---|---|---|
| Partner declines or has no slots | Record the reason and send the ticket to `needs_human`. A manager can assign another available company. | Implemented in demo for empty calendar or voice results. API decline specified. |
| No proposed time suits the tenant | Refresh availability or request more times. If no time can be agreed, send to `needs_human`. | Specified tenant-requested refresh. Demo handles zero usable slots. |
| Call start fails or answering machine | Failed start or empty voice result → `needs_human`. Agent leaves no voicemail when it detects an answering machine. A started call with no callback uses a deadline in the target flow. | Demo handles failed start and empty result. Callback deadline specified. |
| Slot already taken | Return `409`, refresh times and let the tenant choose again. | Demo returns `409` from booking for unavailable times. External reserve and refresh specified. |
| Partner no-show | Record a no-show reason, surface the ticket to the property manager and hold invoicing pending resolution. | Specified. |
| Reschedule | Offer replacement times and reconfirm with the tenant. Update the appointment and timeline on the same ticket. | Specified. |
| Emergency, such as a gas smell | Set `emergency` and route to the property manager. The demo advises calling 112 from outside for gas smell. Automatic partner offers are disabled. | Implemented in demo. [Tenant emergency view](../app/tenant/_components/repair-sheet.tsx) · [EU emergency number](https://digital-strategy.ec.europa.eu/en/policies/112) |

## 15. Assumptions

- No real reltix API or resident records are available. The demo uses synthetic seed data, with in-memory state locally or Redis when configured. Partner calendars are simulated in centrix; phone-booking partners are reached by the voice agent (demo calls go to a tester's phone).
- The documented live ElevenLabs call routes to a test phone. With voice configuration missing the demo labels the call as simulated. Callback deadlines, partner invoice submission via webhook and end-to-end confirmation delivery belong to the target integration.
- The demo models one property manager and role-specific screens, with consent visibility in the interface. Production needs authenticated, scoped access and server-side field filtering. The demo marks invoices paid and tracks forwarding with invoice fields and timeline events. Real wallet settlement is outside the demo.
- The examples use EUR and `Europe/Berlin` for local scheduling. API timestamps are UTC. Example details, domains and contact placeholders are synthetic. Real partners agree their service hours, coverage and dispatch process during onboarding. [Demo data and routes](./contract.md) · [Demo scope](./system-design.md#8-what-is-realistic-in-24-hours)
