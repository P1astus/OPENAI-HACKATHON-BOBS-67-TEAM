# Prompt: Antoni — setup, deploy and all UI

Paste everything below the line into Claude Code at the repo root.

---

You are the frontend lead on a 24-hour hackathon team. Deadline: **Sat Nov 21, 10:30**, with a working live URL. Read these first, fully, before writing code: `CLAUDE.md`, `docs/system-design.md`, `docs/ui-plan.md`, `docs/contract.md`, `docs/task-split.md`.

## Your scope
You own: project setup, Vercel deploy, `components/`, `app/tenant/`, `app/owner/`, `app/partner/`, `app/admin/`, `app/page.tsx`, `app/globals.css`.
You do NOT edit: `types.ts`, `lib/` (except `lib/api-client.ts` and `lib/mock.ts`, which are yours), `app/api/`, `data/`. Those belong to armaNKataria and Teammate 4. If you need a field that isn't in `docs/contract.md`, stop and ask armaNKataria.

## Phase 1: setup commit (target: 30 min, push straight to `main`, everyone is waiting on it)
1. Scaffold in the repo root (keep the existing docs): latest stable Next.js, App Router, TypeScript strict, Tailwind, ESLint, `src/` off, import alias `@/*`. Check the Next.js docs bundled in `node_modules/next/dist/docs` (if present) before using any API you're unsure of. This version may differ from what you remember.
2. `shadcn/ui` init, then add: button, card, badge, tabs, table, dialog, sheet, input, textarea, slider, separator, scroll-area, sonner, chart.
3. Install `swr` for data fetching with polling.
4. Create `types.ts` at the root **exactly** as in `docs/contract.md` (armaNKataria owns it from this commit on; you create it once so nobody is blocked).
5. Empty folders with a `.gitkeep`: `data/`, `lib/`, `app/api/`.
6. `package.json` scripts: `typecheck` (`tsc --noEmit`), `lint`, `build`. All three must pass.
7. Update `.env.example` with every variable listed in the contract (empty values).
8. Update `TEAM_SETUP.md` section 1 with the real commands: `npm install`, `npm run dev`, the three check commands. Write the same check commands into CLAUDE.md section 6 where it says to.
9. Deploy to Vercel (use the Vercel connection), link the GitHub repo so every push gets a preview URL and `main` deploys to production. Post the production URL in the team chat and put it in the README.
10. Commit `chore: scaffold Next.js app` and push to `main`. From here on, work on `feat/ui`.

## Phase 2: design system (Apple-style, from `docs/ui-plan.md`)
Set tokens in `app/globals.css` as CSS variables (light + dark via `prefers-color-scheme`), mapped into shadcn's theme:
- Font stack `-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif`. Load Inter from `next/font/google` as the fallback.
- Background `#F5F5F7`, surface `#FFFFFF`, text `#1D1D1F`, secondary text `#6E6E73`, accent blue `#0071E3`, success `#34C759`, warning `#FF9F0A`, danger `#FF3B30`. Dark: background `#000000`, surface `#1C1C1E`, text `#F5F5F7`, secondary `#98989D`, accent `#0A84FF`.
- Radius 14 px on cards, full on pills and buttons. Shadows very soft (`0 1px 2px rgb(0 0 0 / 0.04), 0 4px 16px rgb(0 0 0 / 0.04)`). Almost no borders: dividers inside grouped lists only.
- Large titles (34 px bold, tight tracking), section headers as small uppercase grey labels above grouped lists (iOS Settings style).
- Sticky top bar with `backdrop-filter: blur(20px)` and a translucent background.
- Motion 150–200 ms ease-out fades only. Respect `prefers-reduced-motion`.
Our own design in an Apple-like spirit: no Apple logos, icons or copied screens. Use `lucide-react` icons.

## Phase 3: shared components (`components/`)
Build these once and use them on every screen. Each one is driven only by contract types:
- `StatusPill({ status: TicketStatus })`: labels "Reported", "Needs a person", "Emergency", "Matched", "Waiting for owner", "Scheduled", "Done", "Invoiced", "Paid". Colors: grey for in progress, blue for scheduled, green for done/paid, orange for waiting/needs a person, red for emergency.
- `InvoicePill({ invoice })`: "Paid" (green), "Not paid · due 5 Dec" (grey), "Overdue · due 5 Dec" (red). Use `invoice.overdue` from the API, never compute it.
- `RatingMeter({ rating: CompanyRating, size })`: horizontal bar from -1 to 1 with a marker, the label (Good / Neutral / Bad / New), "12 reviews". "New" shows "3 of 5 reviews" and no marker.
- `ContactCard({ name, phone, email, consent })`: if `consent` is null, show "Contact shared after the tenant confirms" instead of the numbers. If set, show the numbers plus "Shared on 21 Nov via portal".
- `TicketCard({ ticket, company, unit })`, `Timeline({ events })`, `GroupedList` and `GroupedRow` (the iOS rounded white block with dividers), `EmptyState`, `Money` (formats `€184.50` with `Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })`).

## Phase 4: data access (`lib/api-client.ts`, `lib/mock.ts`)
- `lib/api-client.ts`: typed functions for every route in the contract (`getTickets(filter)`, `bookSlot(id, slot, consent)`, ...). `fetch` with a 15 s timeout via `AbortController`. On error, throw with the API's `error` message so screens can show it in a toast.
- Until armaNKataria's API is live, `lib/mock.ts` returns fixtures in the exact contract shapes (use the heater story: Musterstraße 12, 52062 Aachen; tenant Lena Hoffmann; owner Maria Becker; partner WarmHaus Heizungstechnik). Switch with `NEXT_PUBLIC_USE_MOCKS=1`. That flag is not a secret, so the prefix is fine here.
- Hooks with SWR, `refreshInterval: 2000`, so a click on one screen shows up on the others within 2 s. That live update is the "close the loop" moment in the demo.
- Who is viewing comes from the URL: `/tenant?as=p_lena`, `/owner?as=p_maria`, `/partner?as=c_warmhaus`. There's no login. Default to the demo IDs when `as` is missing.

## Phase 5: the four screens
Use v0 to generate the first version of each screen, then bring the code into the repo and replace its markup with our shared components and real data. Give v0 this context every time:

> Next.js App Router + Tailwind + shadcn/ui. Apple-style minimal: lots of white space, iOS Settings-style grouped lists in rounded white blocks on a #F5F5F7 background, system font, one blue accent (#0071E3), status shown as small rounded pills, soft shadows, no borders, sticky translucent blurred header, large bold page title. No gradients, no emoji, lucide icons. Realistic German example data (Aachen). Then the screen spec below.

Screen specs (expand from `docs/ui-plan.md` sections 1–4):

**`/tenant`: phone first, max width 430 px, centered on desktop.**
- Large title "Hi Lena", grey subtitle with the address.
- Primary button "Report a problem" opens a bottom sheet with one textarea ("What's wrong? e.g. The heating is cold in every room") and "Send". While the API triages (up to 12 s), show the steps live: "Reading your message…", "Finding a heating company…", "Checking free times…". Then show the result: company name, rating meter and "Pick a time" with the `proposed_slots` as large tappable chips. Picking one opens a consent row ("Share name, phone, address and access notes with WarmHaus?") and a "Confirm" button. One tap, no forms.
- If the triage says `needs_human` or `emergency`: a calm card. "A property manager is taking this over and will contact you shortly." For an emergency, add the safety line "If you smell gas: open windows, don't use switches, leave the flat, call 112."
- Sections: Upcoming appointment (date, company, ContactCard, timeline) · My requests · Finished (with a 1–10 slider "How happy are you with the repair?" and a "Send rating" button if `rating` is null) · Invoices (only `payer === "tenant"`, InvoicePill, "Pay" button) · Support (a row that opens a simple message sheet; the message only appears as a toast, which is fine for the demo).

**`/partner`: desktop, works on phone.**
- Title = company name, RatingMeter large in the header.
- Tabs: Jobs (upcoming, sorted by date: address, problem summary, ContactCard, "Accept"; scheduled ones get "Mark done" which opens a dialog with an amount field, then "Send invoice") · Done · Balance (6-month bar chart with the shadcn chart component from `/api/companies/:id/balance`: gross, our 10%, net; this month's totals as three numbers on top) · Reviews (last reviews with rating and date) · Support.

**`/owner`: desktop, hotel front desk style.**
- Three columns: Urgent (emergency, needs_human, awaiting_owner) · Upcoming (matched, scheduled) · Paid. Cards: unit label, problem summary, company, cost, StatusPill.
- On `awaiting_owner` cards: "Approve €420" and "Decline" buttons.
- An Invoices table below: unit, company, amount, InvoicePill, actions "Pay" and "Forward to tenant" (hide both once paid; after forwarding show "Forwarded to tenant").

**`/admin`: reltix ops, desktop.** Tabs:
- Tickets: table (created, unit, claim, trade, company, Partner / Non-partner pill, cost, StatusPill). Clicking a row opens a right `Sheet` with every field readable, the ranked `candidates` with their match parts as small bars (this proves the matching is a formula), the Timeline, and a "Raw JSON" toggle showing the record in a monospace block. For `needs_human` and `emergency` tickets the sheet shows "Assign" next to each candidate.
- Invoices: grouped by property, then month, with subtotals; filter chips for Not paid / Overdue / Paid and Owner / Tenant.
- Companies: sorted by score, RatingMeter, Partner pill, review count.
- Partners · Potential partners (shows "4 reviews above 6, score 0.70" and an "Approach" button that only shows a toast) · Blacklist (score, last 5 ratings).
- A small "Reset demo" button in the header calling `POST /api/reset`, with a confirmation built into the page (no `confirm()`).

**`/` (home):** four large cards linking to the four views with the demo IDs, plus "Reset demo". This is what we open on the projector.

**Stretch (only after the heater story works live):** `/demo` shows tenant (phone frame) · partner · owner · admin side by side, so the jury sees one click change all four.

## Quality bar
- Every screen has loading, empty and error states. A failed request shows a toast with the API's message. The screen never goes blank.
- Every interactive element is a real `<button>` or `<a>` with a visible focus state. Contrast at least 4.5:1, touch targets 44 px.
- Tenant screen checked at 390 px wide, no horizontal scroll anywhere.
- Never show a number you computed in the browser: scores, totals, overdue and commission all come from the API.
- Before each PR: `npm run typecheck && npm run lint && npm run build` all pass. Open the Vercel preview link and click through the heater story.

## Milestones
- 30 min: scaffold on `main`, deployed, URL in the chat.
- +2 h: all four screens on mock data, merged.
- ~19:00: mocks off, real API, heater story clicks through end to end on the preview URL.
- Fri night: production URL works; polish; `/demo` if time allows.
- Sat 07:30: freeze. Fixes only.
