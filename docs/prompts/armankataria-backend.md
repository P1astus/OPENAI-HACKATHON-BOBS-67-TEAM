# Prompt: armaNKataria — backend, rules and AI triage

Paste everything below the line into Claude Code (or Codex) at the repo root, after Antoni's setup commit is on `main`.

---

You are the backend lead on a 24-hour hackathon team. Deadline: **Sat Nov 21, 10:30**. Read these first, fully, before writing code: `CLAUDE.md`, `docs/system-design.md`, `docs/contract.md`, `docs/task-split.md`. `docs/contract.md` is yours: it and `types.ts` are the only shapes anyone builds against.

## Your scope
You own: `types.ts`, `lib/` (except `lib/api-client.ts` and `lib/mock.ts`, which are Antoni's), `app/api/`, `.env.example`, `docs/contract.md`.
You do NOT edit screens (`app/tenant|owner|partner|admin`, `components/`) or the seed data (`data/*.json`, which is Teammate 4's). Need different seed data? Ask Teammate 4.

Branch: `feat/core`. Small PRs, in this order, so others are unblocked early.

## PR 1: contract and stubs (target: 45 min after scaffold)
1. Check that `types.ts` matches `docs/contract.md` exactly. Add `lib/schemas.ts` with `zod` schemas for every request body in the contract, plus the seed file shapes.
2. Every route in the contract exists and returns realistic fixed data in the right shape. Antoni and Teammate 4 can start against it immediately.
3. Add `scripts/validate-data.ts` and `npm run check:data`: it loads every `data/*.json`, validates it with zod and checks references (every `unit.property_id` exists, and so on). Print clear errors. Teammate 4 runs it.
4. Post in the chat: "contract v1 live". Any later change goes in the same PR as the matching `docs/contract.md` update, announced in the chat.

## PR 2: store (`lib/store.ts`)
- `getState(): Promise<State>` and `mutate(fn: (s: State) => void | Promise<void>): Promise<State>`. `State = { properties, units, people, companies, tickets, invoices }`.
- If `UPSTASH_REDIS_REST_URL` is set, use `@upstash/redis` with one key `centrix:state` (JSON). Otherwise use a module-level in-memory copy for local dev. Seed from `data/*.json` on first read. `POST /api/reset` reseeds.
- Vercel serverless instances don't share memory, so production must use Redis. Help Antoni add the Upstash integration in the Vercel project.
- A read-modify-write per request is fine at demo scale. Keep it simple.

## PR 3: rules (pure functions, unit tested)
`lib/rating.ts`, implementing `docs/system-design.md` section 7 exactly:
- `reviewScore(r)`: 1→-1, 2→-0.75, 3→-0.5, 4→-0.25, 5→0, 6→0.25, 7→0.5, 8→0.67, 9→0.83, 10→1, using the piecewise formula in the doc (round to 2 decimals only for display).
- `companyRating(company): CompanyRating`. Fewer than 5 reviews: `label "new"`, `score null`. Otherwise average, then < -0.3 bad, > 0.4 good, else neutral.
- `potential_partner = !is_partner && above6_count >= 3 && bad_count <= good_count && label === "good"`.
- `applyBlacklist(company)`: label `bad` → `status "blacklisted"`. Run it after every rating.

`lib/matching.ts`, implementing system-design section 6:
- Candidates: `status === "active"`, trade matches, `distance_km <= service_radius_km` (haversine on lat/lng).
- `match = 0.5 * reviews + 0.3 * price + 0.2 * distance`. Here `reviews` = (score + 1) / 2 with new = 0.5; `price` and `distance` are min-max normalised over the candidates (cheapest or closest = 1; one candidate = 1).
- `est_cost_eur = callout_fee_eur + hourly_rate_eur * typicalHours[trade]`. Keep a small table (heating 2 h, plumbing 1.5 h, locksmith 1 h, …) and write the assumption in a code comment.
- Partners first: if any partner qualifies, rank only partners. Otherwise rank non-partners. Return every candidate with its `parts` so the admin panel can show why.

Tests (`vitest`): every row of the examples table in system-design section 7 (9,9,9,9 → new; 8,9,7,8,9 → 0.70 good, potential partner; 7,7,7,1,1,1 → neutral, not approached; 3,2,4,3,2 → -0.55 bad, removed), the 5-review threshold, partner-first ranking, an out-of-radius company excluded, and a blacklisted company excluded. Add `npm test`.

## PR 4: AI triage (`lib/agent/triage.ts`)
Input: the tenant's `claim`, plus unit and property context. Output: the `Triage` type.
1. **Safety rules first, no model:** a keyword check (EN + DE) for gas (`gas`, `Gasgeruch`, `smell of gas`), water emergencies (`flood`, `Wasserrohrbruch`, `water everywhere`, `ceiling dripping`), fire or smoke, and sparks or burning smell. A hit means `urgency "emergency"`, `needs_human true`, `source "rules"`, and we skip the model. A model must never be the only thing between a gas leak and a person.
2. **Model call:** OpenAI with **structured outputs** (JSON schema from zod), model from `OPENAI_MODEL`. Use whatever current model we have credits for, and check OpenAI's docs for the structured-output syntax of the SDK version you install. System prompt: you triage repair reports for a German property manager; choose exactly one trade from the enum or null; judge urgency (no heating in winter = urgent); give honest confidence; summary in one neutral sentence without personal data; if the report is vague, mixed or not a repair, say so with low confidence. Include 6–8 few-shot examples covering heating, plumbing, a locksmith, a vague one ("strange smell from the wall" → null trade, low confidence) and a non-repair ("my neighbour is loud" → null).
3. **Validate** the response with zod. If invalid, or the call is over the **10 s timeout**, fall back to a keyword trade guess with `confidence 0.4`, then `needs_human true`, `source "rules"`.
4. **Decision in code, not in the prompt:** `needs_human = trade === null || confidence < 0.7 || urgency === "emergency"`, and `reason` names which one applied.
5. Log the input length, trade, confidence and latency. Never log the API key, and never log the claim at info level.
6. A small eval: `scripts/eval-triage.ts` with ~20 labelled claims, printing accuracy and every miss. Run it before the demo and keep only the claims that pass in the demo script.

## PR 5: the flow (`POST /api/tickets` and the transition routes)
- `POST /api/tickets`: validate the body → create the ticket (`reported`) → triage → if `needs_human`, status `needs_human` or `emergency` and stop → else match → take the top candidate → `matched` → if `est_cost_eur > 300`, `owner_approval "pending"`, status `awaiting_owner` → else fill slots. Partners: the next 3 `calendar_slots` after now + 2 h. Non-partners: start the voice call (see below) and return with `proposed_slots: []` plus an event "Calling <company> to agree on a time".
- Implement every transition route from the contract with state checks (409 on a wrong state) and an event appended each time.
- `complete`: create the invoice (`payer "owner"`, `due_at` = +14 days; no commission, the amount is the company's price) → `invoiced`.
- `rate`: store the rating and add a `Review` to the company → recompute `companyRating` → `applyBlacklist`. Return the new rating so the screen can show it change live.
- `GET /api/companies/:id/balance`: computed from invoices (6 months: earned / paid / outstanding / jobs).

## PR 6: voice hook (with Teammate 3)
- `lib/agent/voice.ts`: `startCompanyCall(ticket, company)`. If `ELEVENLABS_AGENT_ID` is set, start an outbound call through the ElevenLabs API (Teammate 3 will give you the exact endpoint and dynamic variable names from their `docs/voice-agent.md`). Pass only the problem summary, street + postcode, preferred days and a callback ticket id. **No tenant name or phone before consent.** Use a 10 s timeout. On failure, set `needs_human` with reason "Couldn't reach the company".
- `POST /api/agent/voice-result`: check the `x-webhook-secret` header against `VOICE_WEBHOOK_SECRET` (401 otherwise), validate the body, set `proposed_slots`, append the event "WarmHaus offered 3 times by phone".
- Demo fallback: `POST /api/agent/voice-result` can be called by hand from the admin sheet, so the flow still finishes if the call fails on stage.

## Engineering rules
- Validate every request body with zod and return 400 with a readable message.
- Every external call (OpenAI, ElevenLabs, Upstash, n8n) gets a timeout and a fallback. One failing service must not break the demo.
- Server-only secrets, never `NEXT_PUBLIC_`, never logged.
- Before each PR: `npm run typecheck && npm run lint && npm test && npm run build`.

## Milestones
- +45 min after scaffold: PR 1 merged (contract + stubs).
- +2 h: store + rules with tests.
- ~19:00: the real flow behind every route; Antoni switches off mocks; the heater story runs end to end.
- Fri night: triage eval passing, voice hook connected with Teammate 3.
- Sat 07:30: freeze.
