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
| `POST /api/tickets/:id/assign` | admin | `{ company_id }` | `Ticket` (from needs_human/emergency) |
| `POST /api/tickets/:id/approve` | owner | `{ approved: boolean }` | `Ticket` |
| `POST /api/tickets/:id/book` | tenant | `{ slot, consent: { data_shared } }` | `Ticket` (scheduled) |
| `POST /api/tickets/:id/accept` | company | – | `Ticket` (event only) |
| `POST /api/tickets/:id/complete` | company | `{ amount_eur }` | `{ ticket, invoice }` (both paid immediately from the centrix wallet, `payer: "owner"`, `paid_at: now`) |
| `POST /api/tickets/:id/rate` | tenant | `{ rating }` (1–10) | `{ ticket, company_rating }` |
| `GET /api/invoices?owner_id=&tenant_id=&company_id=` | all | – | `(Invoice & { overdue })[]` |
| `POST /api/invoices/:id/forward` | owner | – | `Invoice` (wallet-paid owner invoices only, wallet refunded, `payer: "tenant"`, `forwarded_at: now`, `status: "not_paid"`, `paid_at: null`) |
| `POST /api/invoices/:id/pay` | tenant | – | `Invoice` (`status: "paid"`, `paid_at: now`). Only unpaid tenant invoices are eligible. Owner invoices return 409. |
| `GET /api/companies` | admin, partner | – | `(Company & { rating: CompanyRating })[]` |
| `GET /api/companies/:id/balance` | Unused in v1.1 | – | Company payment terms and accounting are handled by reltix finance. |
| `POST /api/agent/voice-result` | ElevenLabs webhook | `{ ticket_id, company_id, slots: string[], summary }` + header `x-webhook-secret` | `{ ok: true }` |
| `POST /api/reset` | demo operator | – | reseeds all data from `data/*.json` |

## Where the data lives
- Seed: `data/properties.json`, `units.json`, `people.json`, `companies.json`, `tickets.json`, `invoices.json` (arrays of the types above).
- Live state: Upstash Redis (one key holding the whole state) when `UPSTASH_REDIS_REST_URL` is set, otherwise in memory (local dev). `POST /api/reset` copies the seed back in.

## Environment variables (server only, never `NEXT_PUBLIC_`)
`OPENAI_API_KEY`, `OPENAI_MODEL`, `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `VOICE_WEBHOOK_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `N8N_WEBHOOK_URL`.
