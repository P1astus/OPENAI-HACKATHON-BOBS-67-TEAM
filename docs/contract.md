# Contract v1: data shapes and API

The one agreement everyone builds against. **Owner: armaNKataria.** Want a change? Ask armaNKataria, who updates this file and `types.ts` in the same PR and posts in the team chat. Never change a shape silently.

Product rules live in [system-design.md](./system-design.md). This file only says *how data looks and moves*.

## Conventions
- IDs are strings with a prefix: `prop_`, `unit_`, `p_` (person), `c_` (company), `t_` (ticket), `inv_`.
- Dates are ISO 8601 strings in UTC (`2026-11-21T09:00:00Z`). Money is a number in euros with 2 decimals (`184.50`).
- Every API response is JSON. Errors: HTTP 4xx/5xx with `{ "error": "human readable message" }`.
- We take no commission: invoices go from the company to the owner (or tenant) at the company's price. Revenue is the owners' subscription only, which isn't modelled in the demo data.
- All numbers shown on screen (scores, money, counts) come from the API, computed in code. Screens never compute them.

## Types (`types.ts`)

UI ignores `due_at` and `overdue`: payment terms are handled by reltix finance (v1.1)

```ts
export type Trade =
  | "heating" | "plumbing" | "electrical" | "locksmith" | "appliances"
  | "windows_doors" | "pest_control" | "roofing" | "general";

export type Property = {
  id: string; address: string; postcode: string; city: string;
  lat: number; lng: number; building_year: number; heating: string;
};

export type Unit = {
  id: string; property_id: string; label: string;      // "2nd floor left"
  floor: number; size_sqm: number; owner_id: string; tenant_id: string | null;
  access_notes: string;                                  // "key with caretaker, Mr. Weber"
};

export type Person = {
  id: string; role: "tenant" | "owner"; name: string; email: string; phone: string;
};

export type Review = { ticket_id: string; rating: number; created_at: string };  // rating 1–10

export type Company = {
  id: string; name: string; is_partner: boolean; trades: Trade[];
  lat: number; lng: number; service_radius_km: number;
  hourly_rate_eur: number; callout_fee_eur: number;
  phone: string; email: string;
  booking: "calendar" | "website" | "phone";            // partners: always "calendar"
  calendar_slots: string[];                              // free slots (ISO), partners only
  reviews: Review[];
  status: "active" | "blacklisted";
};

export type RatingLabel = "new" | "good" | "neutral" | "bad";

export type CompanyRating = {
  score: number | null;      // -1..1, null while "new" (<5 reviews)
  label: RatingLabel;
  review_count: number;
  good_count: number;        // reviews > 5
  bad_count: number;         // reviews < 5
  above6_count: number;      // reviews > 6
  potential_partner: boolean;
};

export type TicketStatus =
  | "reported" | "needs_human" | "emergency" | "matched" | "awaiting_owner"
  | "scheduled" | "done" | "invoiced" | "paid";

export type Triage = {
  trade: Trade | null;
  urgency: "emergency" | "urgent" | "normal";
  confidence: number;        // 0..1
  summary: string;           // one line, for the company and the owner
  needs_human: boolean;
  reason: string;            // why it went to a human, or "" 
  source: "model" | "rules"; // "rules" = model failed or emergency keyword hit
};

export type Consent = {
  data_shared: string[];     // ["name", "phone", "address", "access_notes"]
  given_at: string;
  channel: "portal" | "voice" | "email";
};

export type TicketEvent = {
  at: string;
  actor: "tenant" | "owner" | "company" | "agent" | "admin";
  type: string;              // "reported", "triaged", "matched", "slots_proposed", "booked", ...
  message: string;           // shown in timelines
};

export type MatchCandidate = {
  company_id: string; match: number;                     // 0..1
  parts: { reviews: number; price: number; distance: number };
  distance_km: number; est_cost_eur: number;
};

export type Ticket = {
  id: string; unit_id: string; tenant_id: string; created_at: string;
  claim: string;                                         // tenant's own words
  triage: Triage | null;
  candidates: MatchCandidate[];                          // ranked, for the admin panel
  company_id: string | null;
  partner_type: "partner" | "non_partner" | null;
  est_cost_eur: number | null;
  owner_approval: "not_needed" | "pending" | "approved" | "rejected";
  proposed_slots: string[];
  appointment_at: string | null;
  consent: Consent | null;
  invoice_id: string | null;
  rating: number | null;                                 // tenant's 1–10 after the job
  status: TicketStatus;
  events: TicketEvent[];
};

export type Invoice = {
  id: string; ticket_id: string; company_id: string; unit_id: string; property_id: string;
  amount_eur: number;
  issued_at: string; due_at: string;                     // due = issued + 14 days
  payer: "owner" | "tenant";
  forwarded_at: string | null;
  status: "not_paid" | "paid";
  paid_at: string | null;
};
// "Overdue" is not stored: status === "not_paid" && now > due_at. The API adds `overdue: boolean` on reads.
```

## Ticket lifecycle

```
reported ──triage──► emergency / needs_human ──admin assigns──► matched
reported ──triage──► matched
matched ──est. cost > €300──► awaiting_owner ──owner approves──► (slots)
matched ──≤ €300──► (slots)
(slots) partner: proposed_slots filled from calendar_slots
        non-partner: proposed_slots filled by the voice agent webhook
proposed_slots set ──tenant books + consent──► scheduled
scheduled ──company marks done + amount──► paid   (invoice paid immediately from the owner's centrix wallet)
paid ──owner forwards a wallet-paid invoice + wallet refund──► invoiced   (tenant pays)
invoiced ──tenant pays──► paid
rating can be posted from "invoiced" or "paid"
```
Every transition appends a `TicketEvent`. A request in the wrong state returns 409.
Completing a job appends `invoiced` and `paid_from_wallet`. Forwarding appends `forwarded_to_tenant`.

## API routes

| Method + path | Who calls it | Body | Returns |
|---|---|---|---|
| `GET /api/bootstrap` | all screens | – | `{ properties, units, people }` for lookups |
| `GET /api/tickets?tenant_id=&owner_id=&company_id=&status=` | all screens | – | `Ticket[]` newest first |
| `GET /api/tickets/:id` | all | – | `Ticket` |
| `POST /api/tickets` | tenant | `{ tenant_id, unit_id, claim }` | `Ticket` after triage + match (≤ 12 s) |
| `POST /api/tickets/:id/clarify` | owner, admin | `{ note, actor: "owner" \| "admin" }` (5–1000 characters after trimming) | `Ticket` after re-triage + matching |
| `POST /api/tickets/:id/assign` | owner, admin | `{ company_id }` | `Ticket` (from needs_human/emergency) |
| `POST /api/tickets/:id/approve` | owner | `{ approved: boolean }` | `Ticket` |
| `POST /api/tickets/:id/book` | tenant | `{ slot, consent: { data_shared } }` | `Ticket` (scheduled) |
| `POST /api/tickets/:id/accept` | company | – | `Ticket` (event only) |
| `POST /api/tickets/:id/complete` | company | `{ amount_eur }` | `{ ticket, invoice }` (both paid immediately from the centrix wallet, `payer: "owner"`, `paid_at: now`) |
| `POST /api/tickets/:id/rate` | tenant | `{ rating }` (1–10) | `{ ticket, company_rating }` |
| `GET /api/invoices?owner_id=&tenant_id=&company_id=` | all | – | `(Invoice & { overdue })[]` |
| `POST /api/invoices/:id/forward` | owner | – | `Invoice` (wallet-paid owner invoices only, wallet refunded, `payer: "tenant"`, `forwarded_at: now`, `status: "not_paid"`, `paid_at: null`) |
| `POST /api/invoices/:id/pay` | tenant | – | `Invoice` (`status: "paid"`, `paid_at: now`). Only unpaid tenant invoices are eligible. Owner invoices return 409. |
| `GET /api/companies` | admin, partner | – | `(Company & { rating: CompanyRating })[]` |
| `POST /api/companies/search-web` | owner, admin | `{ trade: Trade, postcode: string, city: string }` | `{ results: [{ name, phone, website, address, source_url }], note? }` |
| `POST /api/agent/voice-result` | ElevenLabs webhook | `{ ticket_id, company_id, slots: string[], summary }` + header `x-webhook-secret` | `{ ok: true }` |
| `POST /api/reset` | demo operator | – | reseeds all data from `data/*.json` |

## Behaviour notes (v1.3)
- `POST /api/tickets` returns 400 if the tenant doesn't live in the unit. Triage runs first (safety keywords → `emergency`, no model). Then `needs_human = trade === null || confidence < 0.7 || urgency === "emergency"` is decided in code. When the ticket goes to a human, `candidates` holds suggestions for the admin (every active company for the trade, radius ignored).
- `clarify` accepts `needs_human` and `emergency` tickets, and returns 409 in other states. It appends `clarified` and `triaged` events, then runs normal matching for a clear non-emergency trade. When AI triage is unavailable, a single trade identified by keywords in the clarification can proceed. If the issue stays unclear, candidates include all active companies regardless of radius. Emergencies always require manual assignment.
- `search-web` returns up to three sourced suggestions, with empty strings for missing contact details. Suggestions can be viewed and contacted manually. They are never stored or automatically called. Missing configuration, errors and the 20-second timeout return HTTP 200 with `{ results: [], note: "Web search unavailable" }`.
- Partner slots are the next 3 free `calendar_slots` at least 2 h from now. For a non-partner, the API starts the ElevenLabs call and returns `proposed_slots: []`, and the slots arrive through `voice-result`. **Without ElevenLabs configured, the call is simulated** and the timeline says so. If the call fails, or the company offers no time, the ticket goes to `needs_human`.
- `approve` with `approved: false` → `owner_approval: "rejected"`, status `needs_human` (the property manager decides).
- `rate` appends `company_removed` or `potential_partner` events when that changes. The company's `status` flips to `blacklisted` automatically when its label is `bad`.
- Event types: `reported`, `clarified`, `triaged`, `needs_human`, `emergency`, `no_partner`, `matched`, `owner_approval_requested`, `approved`, `rejected`, `calling_company`, `call_started`, `slots_proposed`, `booked`, `accepted`, `invoiced`, `paid_from_wallet`, `forwarded_to_tenant`, `invoice_paid`, `rated`, `company_removed`, `potential_partner`.
- `voice-result` needs `x-webhook-secret` equal to `VOICE_WEBHOOK_SECRET` (401 otherwise, and always 401 when the secret isn't set). The ticket must be `matched` to that company with no slots yet (409 otherwise).
- `POST /api/reset` returns `{ ok: true, source: "data" | "builtin" }`.

## Where the data lives
- Seed: `data/properties.json`, `units.json`, `people.json`, `companies.json`, `tickets.json`, `invoices.json` (arrays of the types above). They are used only when **all six** exist and pass validation. Otherwise the built-in demo seed in `lib/seed.ts` is used. Partner calendars are always topped up with future working-day slots (09:00, 11:00, 14:00 Berlin time). Run `npm run check:data` after editing the data.
- Live state: Upstash Redis (one key holding the whole state) when `UPSTASH_REDIS_REST_URL` is set, otherwise in memory (local dev). `POST /api/reset` copies the seed back in.

## Environment variables (server only, never `NEXT_PUBLIC_`)
`OPENAI_API_KEY`, `OPENAI_MODEL`, `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `ELEVENLABS_PHONE_NUMBER_ID`, `VOICE_TEST_TO_NUMBER` (demo: call the teammate instead of the company), `VOICE_WEBHOOK_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `N8N_WEBHOOK_URL`. See `.env.example` for what happens when each one is missing.
