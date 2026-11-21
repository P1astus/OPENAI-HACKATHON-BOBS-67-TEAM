# Prompt: valoi2 — demo data, connector spec and pitch

> Historical: the task prompt used on Fri 20 Nov. Some details changed later; see [README.md](../../README.md) and [docs/system-design.md](../system-design.md) for the final product.

Paste everything below the line into Claude (chat or Claude Code at the repo root).

---

I own three things on a 24-hour hackathon team: the **demo data**, the **partner connector spec** and the **pitch**. Deadline: **Sat Nov 21, 10:30**. First read `CLAUDE.md` (sections 3a and 4 "Pitch"), `docs/system-design.md`, `docs/contract.md` and `docs/task-split.md` in our repo.

I own: `data/*.json`, `docs/connector-spec.md`, `docs/pitch.md` and the slides. I don't edit code. If the data shape doesn't fit, I ask armaNKataria, who owns `types.ts` and `docs/contract.md`.

## Part 1: demo data (`data/*.json`, branch `feat/data`, first priority, everyone needs it)
Write six JSON files, each an array in **exactly** the types from `docs/contract.md`: `properties.json`, `units.json`, `people.json`, `companies.json`, `tickets.json`, `invoices.json`. After every change, run `npm run check:data` (armaNKataria provides it) and fix every error.

Realistic, all in and around **Aachen**:
- **4 properties**, including Musterstraße 12, 52062 Aachen (built 1972, gas central heating), with real-looking lat/lng for each address. Building years and heating types should vary (gas, district heating, heat pump).
- **10 units** across them, with `access_notes` (caretaker, key box code "on request").
- **People:** 10 tenants and 3 owners. Must include tenant **Lena Hoffmann** (`p_lena`, unit `unit_4b` at Musterstraße 12) and owner **Maria Becker** (`p_maria`). Fake phone numbers in the `+49 151 0000…` style and `@example.com` emails only. No real people.
- **~15 companies**, across trades: heating ×3, plumbing ×3, electrical ×2, locksmith ×2, appliances, windows_doors, pest_control, roofing, general. Each has German-sounding fictional names, lat/lng in or near Aachen, radius 10–30 km, hourly €55–95, callout €0–49. Partners get `booking "calendar"` and 8–12 `calendar_slots` between **Sat 21 Nov and Fri 27 Nov 2026**, weekdays 08:00–17:00 Berlin time, written in UTC.

The reviews must be designed so each rule from system-design section 7 shows up in the demo. Write each one on purpose:
| Company | Partner | Reviews | Shows |
|---|---|---|---|
| `c_warmhaus` "WarmHaus Heizungstechnik" (heating) | yes | 9, 8, 9, 10, 8, 9 | Good partner, wins the heater case |
| a second heating company | yes | 7, 6, 8, 5, 7 | Neutral, ranks below WarmHaus |
| a non-partner plumber | no | 8, 9, 7, 8 (4 reviews) | "New". The 5th review in the demo (9) promotes it to potential partner |
| a non-partner | no | 8, 9, 7, 8, 9 | Already a potential partner |
| a non-partner | no | 7, 7, 7, 1, 1, 1 | Edge case: meets the count rule but is not Good, so not approached |
| a company | either | 3, 2, 4, 3, 2 | Bad, `status "blacklisted"` |
| a brand-new company | no | none | New |
Ask armaNKataria to confirm the computed labels with the rating tests.

- **Tickets and invoices history:** ~12 past tickets (Sep–Nov 2026) in final states (`paid`, some `invoiced`), each with an invoice, so the admin invoice grouping, the partner's 6-month balance chart and the owner's Paid column aren't empty. Include: one invoice forwarded to a tenant and unpaid, one overdue (due date before 21 Nov, not paid), and one waiting for owner approval (> €300). Every review in `companies.json` should point to a real past `ticket_id` where possible.
- **Not in the seed:** Lena's heater ticket. That one is created live in the demo.

## Part 2: connector spec (`docs/connector-spec.md`, 15% of the score)
Audience: a developer at a new partner company and the reltix judges. Goal: **any service partner can plug into centrix the same way, without us redesigning anything.** Write it from the real routes in `docs/contract.md`; ask armaNKataria when unsure. Sections:
1. **What a partner gets / gives**, in plain words (steady jobs without marketing cost, booking from their calendar, jobs arrive with context filled in; they pay us nothing and we take no commission).
2. **Partner manifest** (one JSON document a partner registers): id, legal name, trades (our enum), service area (centre + radius or postcode list), pricing (hourly, callout, optional fixed prices), booking method (`calendar` API / `website` / `phone`), required job fields, consent scopes it needs (name, phone, address, access notes, photos), support contact, SLA (response time). Give a full example for WarmHaus.
3. **Availability**: `GET {partner}/availability?trade=&from=&to=&lat=&lng=` → slots. Say what happens for phone-only partners (our voice agent).
4. **Orders/jobs**: `POST {partner}/jobs` with the prefilled context we send (problem summary, address, access notes, photos, appointment, contact only after consent) → `{ job_id }`. Show the exact JSON.
5. **Status updates back to centrix**: webhook `POST centrix/partner-events` with one shared status machine (`accepted → scheduled → in_progress → done → invoiced`, plus `declined`, `rescheduled`), signed with HMAC SHA-256 in a header, idempotency key, retries with backoff.
6. **Invoice**: required fields; linked to the unit and the case.
7. **Result written to the unit**: the shape we store, modelled on reltix's own example (`service_contract` / job record with `consent: { data_shared, given_at, channel }`).
8. **Consent and privacy**: data minimisation (only the fields the manifest declares), nothing personal before the tenant confirms, retention, GDPR basis.
9. **Quality**: rating 1–10 → score, removal below -0.3, the partner promotion path (in plain words, link system-design).
10. **Plug in a new partner in 5 steps**, plus a second example manifest for a different category (e.g. a locksmith or an internet provider) to prove it's generic.
11. **Assumptions** we made, as a short honest list (the brief asks "tell us what you assumed").

## Part 3: pitch (`docs/pitch.md` + slides, start early, refine all night)
Live stage pitch, about 3 minutes plus questions. Structure:
1. **One sentence first:** "We turn 'my heating is broken' into a booked, paid and rated repair, with zero forms for the tenant, by matching every problem to the best local company."
2. **Problem** (20 s): the brief's own line, "a broken heater can take a dozen calls and emails". No invented statistics: any number on a slide must come from our app (counts and euros from the admin screen) or from a source we can name. Mark unknowns as `[CHECK]`.
3. **Live demo** (90 s): write the click-by-click script with who does what. Antoni drives; armaNKataria and Tropimatico are on standby for the call. Heater: tenant reports → match with visible formula → tenant picks a time → partner accepts and marks done → owner forwards or pays → tenant rates 9 → score updates. Then the short second case: the non-partner gets its 5th good review and appears under "Potential partners".
4. **Why this partner and this moment** (10% of the score): the landlord must fix it, it's urgent, and today it costs the property manager the most calls.
5. **Connector spec** in one slide: manifest → availability → job → status → invoice → result on the unit.
6. **Business model:** home owners pay a subscription, and that's all. No commission from companies, which is why good local companies happily join as partners. Price shown as `[OWNER SUBSCRIPTION PRICE]` until the team agrees on it.
7. **Honest limits and "what breaks first?"**: the AI misreads vague reports (so they go to a person), the voice call on bad lines, seeded search instead of a real places API.
8. **What's next:** real places API, German voice, photo triage, owner monthly statements.
- Prepare answers to 6 likely jury questions (privacy, who pays, why not just MyHammer-style marketplaces, liability, scaling to thousands of units, what if no company answers).
- Backup plan in order: live demo → 60-second screen recording (record it Sat by 09:00) → screenshots in the slides.
- Rehearse out loud with a timer at least 3 times. Everyone says one part.

## Milestones
- +1.5 h after `types.ts` lands: data files pass `npm run check:data`, PR merged.
- +4 h: connector spec draft; pitch outline + demo script.
- Fri night: slides v1; rehearse with the team.
- Sat 09:00: screen recording done. Sat 10:00: submitted.
