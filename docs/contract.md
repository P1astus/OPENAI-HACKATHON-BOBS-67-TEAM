# Contract v1: data shapes and API

The one agreement everyone builds against. **Owner: armaNKataria.** Want a change? Ask armaNKataria, who updates this file and `types.ts` in the same PR and posts in the team chat. Never change a shape silently.

Product rules live in [system-design.md](./system-design.md). This file only says *how data looks and moves*.

## Conventions
- IDs are strings with a prefix: `prop_`, `unit_`, `p_` (person), `c_` (company), `t_` (ticket), `inv_`.
- Generated timestamps use UTC ISO 8601. Booking and voice-result inputs also accept explicit offsets. Money is a number in euros, with calculated estimates and invoice amounts rounded to cents.
- The app’s route handlers respond with JSON. Errors: HTTP 4xx/5xx with `{ "error": "human readable message" }`.
- We take no commission: invoices go from the company to the owner (or tenant) at the company's price. Revenue is the owners' subscription only, which isn't modelled in the demo data.
- Estimates, distance, match scores and company ratings come from server code. OpenAI provides triage confidence in a validated field.

## Types (`types.ts`)

reltix finance handles payment terms. The API retains legacy `due_at` and `overdue` fields, while the UI shows payment status.

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
  booking: "calendar" | "website" | "phone";            // e.g. "calendar" for WarmHaus, "phone" for Hauswerk
  calendar_slots: string[];                              // free slots (ISO), used for calendar partners
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
  data_shared: string[];     // permitted: name, phone, email, address, access_notes
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
reported ──triage──► emergency / needs_human ──manual assignment──► matched
needs_human ──clear non-emergency clarification──► matching again
reported ──triage──► matched
matched ──est. cost > €300──► awaiting_owner ──owner approves──► (slots)
matched ──≤ €300──► (slots)
(slots) calendar partner: proposed_slots filled from calendar_slots
        phone-booking partner or non-partner fallback: proposed_slots filled by the voice result
proposed_slots set ──tenant books + consent──► scheduled
scheduled ──company marks done + amount──► paid   (invoice recorded as paid from the owner's centrix wallet)
paid ──owner forwards a wallet-paid invoice + wallet refund──► invoiced   (tenant pays)
invoiced ──tenant pays──► paid
rating can be posted from "invoiced" or "paid"
```
Every transition appends a `TicketEvent`. A request in the wrong state returns 409.
Completing a job appends `invoiced` and `paid_from_wallet`. Forwarding appends `forwarded_to_tenant`. Wallet charges and refunds are simulated with invoice and timeline updates.

## API routes

The callers below describe the intended UI. The voice callback checks a shared secret. The other demo routes have no role authentication.

| Method + path | Who calls it | Body | Returns |
|---|---|---|---|
| `GET /api/bootstrap?company_id=` | all screens (company ID optional) | – | `{ properties, units, people }` for lookups |
| `GET /api/tickets?tenant_id=&owner_id=&company_id=&status=` | all screens | – | `Ticket[]` newest first |
| `GET /api/tickets/:id` | tenant, owner, admin | – | `Ticket` |
| `POST /api/tickets` | tenant | `{ tenant_id, unit_id, claim }` (claim 3–2000 characters after trimming) | `Ticket` after triage and any matching and call-start work |
| `POST /api/tickets/:id/clarify` | owner, admin | `{ note, actor: "owner" \| "admin" }` (5–1000 characters after trimming) | `Ticket` after re-triage + matching |
| `POST /api/tickets/:id/assign` | owner, admin | `{ company_id, actor?: "owner" \| "admin" }` | `Ticket` (from `needs_human`, `emergency`, or `matched` with no slots or appointment) |
| `POST /api/tickets/:id/approve` | owner | `{ approved: boolean }` | `Ticket` |
| `POST /api/tickets/:id/book` | tenant | `{ slot, consent: { data_shared } }` | `Ticket` (scheduled) |
| `POST /api/tickets/:id/accept` | company | – | `Ticket` (event only) |
| `POST /api/tickets/:id/complete` | company | `{ amount_eur }` | `{ ticket, invoice }` (simulated wallet payment, `payer: "owner"`, `paid_at: now`) |
| `POST /api/tickets/:id/rate` | tenant | `{ rating }` (integer 1–10) | `{ ticket, company_rating }` |
| `GET /api/invoices?owner_id=&tenant_id=&company_id=` | all | – | `(Invoice & { overdue })[]` |
| `POST /api/invoices/:id/forward` | owner | – | `Invoice` (wallet-paid owner invoices only, wallet refunded, `payer: "tenant"`, `forwarded_at: now`, `status: "not_paid"`, `paid_at: null`) |
| `POST /api/invoices/:id/pay` | tenant | – | `Invoice` (`status: "paid"`, `paid_at: now`). Only unpaid tenant invoices are eligible. Owner invoices return 409. |
| `GET /api/companies` | all screens | – | `(Company & { rating: CompanyRating })[]` |
| `POST /api/companies/search-web` | owner, admin | `{ trade: Trade, postcode: string, city: string }` | `{ results: [{ name, phone, website, address, source_url }], note? }` |
| `POST /api/agent/voice-result` | ElevenLabs webhook | `{ ticket_id, company_id, attempt_id?, slots: string[], summary? }` + header `x-webhook-secret` | `{ ok: true }` |
| `POST /api/reset` | demo operator | – | `{ ok: true, source: "data" \| "builtin" }` |

## Behaviour notes
- `POST /api/tickets` returns 400 if the tenant doesn't live in the unit. Triage runs first (safety keywords → `emergency`, no model). Code sends unclear trades, confidence below 0.7 and emergencies to a human. Model failure also sends new reports for review. When the ticket goes to a human, `candidates` holds suggestions for the admin (every active company for the trade, radius ignored).
- `clarify` accepts `needs_human` and `emergency` tickets, and returns 409 in other states. It appends `clarified` and `triaged` events, then runs normal matching for a clear non-emergency trade. A rejected estimate with an unchanged trade keeps the ticket in `needs_human` for manual assignment. When AI triage is unavailable, a single trade identified by keywords in the clarification can proceed. If the issue stays unclear, candidates include all active companies regardless of radius. Emergencies always require manual assignment.
- `assign` records the actor (defaults to `admin`), clears the triage review flag, records the manual assignment reason, and adds the chosen company to the candidate list if it is absent.
- `search-web` returns up to three sourced suggestions, with empty strings for missing contact details. Suggestions can be viewed and contacted manually. They are never stored or automatically called. Missing configuration, errors and the 20-second timeout return HTTP 200 with `{ results: [], note: "Web search unavailable" }`.
- Calendar partners offer up to three free slots strictly more than two hours ahead. Phone partners and non-partners use ElevenLabs when configured with `VOICE_WEBHOOK_SECRET`, and otherwise use a labeled simulation. Failed calls or empty results go to `needs_human`. Ticket reads and mutations also send an unbooked phone match with no slots to `needs_human` more than four minutes after the latest call event. Owners and managers can reassign it while it waits.
- `book` requires a future, offered slot and records portal consent for `name`, `phone`, `email`, `address` and `access_notes`. A slot already booked with the same company returns 409. Booking removes that slot from other open offers for that company and refills affected calendar offers from free times, sending them to `needs_human` if none remain. The tenant UI submits name, phone, address and access notes on confirmation.
- `complete` requires a scheduled ticket and an invoice amount from €0.01 to €100,000 with at most two decimal places. If an estimate exists and the amount exceeds both €300 and 125% of the estimate, completion returns 409 and asks the company to contact the owner. `accept` records the company’s confirmation as an event.
- `GET /api/bootstrap?company_id=…` limits properties and units to that company’s tickets, blanks access notes without consent for that unit, and includes only tenants with consent on those tickets and their shared contact fields. Omitting the parameter returns all lookups.
- `approve` with `approved: false` → `owner_approval: "rejected"`, status `needs_human` (the property manager decides).
- `rate` appends `company_removed` or `potential_partner` events when that changes. Blacklisting moves the company’s open, unbooked assignments to `needs_human`. Approval and booking recheck active status and send unavailable matches for review, with booking returning 409.
- Event types: `reported`, `clarified`, `triaged`, `needs_human`, `emergency`, `no_partner`, `matched`, `owner_approval_requested`, `approved`, `rejected`, `calling_company`, `call_started`, `slots_proposed`, `booked`, `accepted`, `invoiced`, `paid_from_wallet`, `forwarded_to_tenant`, `invoice_paid`, `rated`, `company_removed`, `potential_partner`.
- `voice-result` requires a valid `x-webhook-secret` (401 otherwise) and the latest pending call in the current reset generation (409 otherwise). The attempt ID may be omitted for an unambiguous ticket/company pair. A reset also invalidates pending triage and call-start outcomes, and saved slots take precedence over a later call-start failure.

## Where the data lives
- Seed: this checkout uses [the built-in demo seed](../lib/seed.ts). The loader also supports six optional JSON arrays in `data/`, named for properties, units, people, companies, tickets and invoices. It uses them when all six exist and pass the schema checks. On seed load, calendar partners with fewer than six upcoming slots get a top-up of weekday times at 09:00, 11:00 and 14:00 Berlin time. `npm run check:data` validates JSON seed files: partners book by `calendar` or `phone`, and only calendar partners carry `calendar_slots`.
- Live state: Upstash Redis (one key holding the whole state) when a Redis REST URL and token are configured. It uses memory otherwise. Each value prefers the `UPSTASH_REDIS_REST_*` name, even if blank. Leave the primary variables unset to use the `KV_REST_API_*` aliases. `POST /api/reset` copies the seed back in.

## Environment variables (server only, never `NEXT_PUBLIC_`)
`OPENAI_API_KEY`, `OPENAI_MODEL`, `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `ELEVENLABS_PHONE_NUMBER_ID`, `VOICE_TEST_TO_NUMBER` (demo: call the teammate instead of the company), `VOICE_WEBHOOK_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (alternates `KV_REST_API_URL` and `KV_REST_API_TOKEN`), and `N8N_WEBHOOK_URL`. See [`.env.example`](../.env.example) for what happens when each one is missing.
