# UI design plan: four views for repair matching

## Context
The design is agreed and merged ([docs/system-design.md](./system-design.md)). Next is UI design for the four users: tenant, partner company, home owner, and us (reltix). The team listed what each screen must hold. reltix scores UX at 25% ("minimal effort for resident, partner and property manager"), so each screen should show the one next action first, then history.

Decision: **no mockups, we go straight to code.** This plan is the UI spec the team builds from.

## Look and feel: Apple-style, clean and minimal
All four views share one slick, minimal look in the spirit of Apple's apps (our own design, no Apple logos or copied screens):
- **Lots of white space**, few elements per screen, one clear main action.
- **Font:** the system font (`-apple-system, BlinkMacSystemFont, "Inter", sans-serif`). It shows Apple's own font on Macs and iPhones and Inter elsewhere. Big bold headings, small grey secondary text.
- **Colors:** white or very light grey background (#F5F5F7-ish), near-black text, **one blue accent** for buttons and links. Green / orange / red only for status.
- **Shapes:** rounded corners (12–16 px on cards, fully rounded pills and buttons), very soft shadows, almost no borders.
- **Grouped lists** like iOS Settings: rows in rounded white blocks with thin dividers.
- **Frosted glass** top bar (blurred, see-through) on scroll.
- **Motion:** short, gentle fades and slides only (~200 ms); nothing bouncy.
- **Dark mode** comes for free with the same tokens.
- Tell v0 "Apple-style minimal, iOS grouped lists, system font, one blue accent" in every prompt so all screens match.

## Shared rules for all four views
- One look for all (above), status shown as colored pills.
- Same status set everywhere: **Reported → Matched → Scheduled → Done → Invoiced → Paid**, plus **Needs human** and **Emergency**.
- Invoice pill: **Paid** (green), **Not paid** (grey), **Overdue** (red) + deadline date.
- Rating shown the same everywhere: score -1…1 as a meter with label **Good / Neutral / Bad / New (<5 reviews)**.
- Contact cards (company ↔ tenant) only show phone/email after the tenant gave consent; a small "shared on <date>" line under it.
- Tenant screen is phone-first (390 px). The other three are desktop dashboards that still work on a phone.

## 1. Tenant (phone)
- **Top: "Report a problem"** button. Opens a chat-style box: type or photo, nothing else.
- **My requests**: open requests as cards with status pill.
- **Upcoming appointment**: date + time, company name, contact card (call / message), "reschedule" link.
- **Finished appointments**: list with date, company, "Rate this job" (1–10 slider) if not rated yet.
- **Invoices**: only invoices the owner forwarded to the tenant. Amount, Paid / Not paid, deadline, "Pay" button.
- **Support**: chat button at the bottom (goes to the property manager).

## 2. Partner company (desktop)
- **Today / upcoming jobs**: date, address, problem description, tenant contact card, "Accept" / "Propose other time".
- **Done jobs**: list, "Mark done + upload invoice" on open ones.
- **Rating meter**: big score with Good / Neutral / Bad label, number of reviews, last 5 reviews.
- **Monthly balance**: earned this month, how much is already paid and how much is still outstanding, number of jobs; bar chart of the last 6 months. (We take no commission, so earned = what they invoiced.)
- **Support**: contact the property manager.

## 3. Home owner (desktop, PMS / hotel-style dashboard)
- Three columns like a front desk board: **Urgent** (emergencies, waiting for owner approval over €300) · **Upcoming** (scheduled jobs) · **Paid** (closed).
- Each card: unit, problem, company, cost, status.
- **Approve** button on jobs over €300.
- **Invoices** table: amount, Paid / Not paid pill, deadline, **"Forward to tenant"** button (owner decides who pays). Once forwarded the pill says "Forwarded to tenant · Not paid".

## 4. Us / reltix (desktop admin)
Tabs along the top:
- **Tickets**: table with one row per ticket; label pill **Partner / Non-partner**; columns: claim (what the tenant said), repair type, company, cost, status. Click a row → side panel with the full ticket as readable fields plus a "Raw JSON" toggle showing the actual record.
- **Invoices**: suggested grouping **by property, then by month**, with a filter bar for status (Not paid / Overdue / Paid) and payer (owner / tenant). Each group shows a subtotal. Reason: a property manager thinks per building, and month groups match the owners' monthly statements.
- **Companies by rating**: sorted list, score meter, label, review count, partner or not.
- **Partners** and **Potential partners**: two lists. Potential partners show why they qualify (reviews >6 count, score) and an "Approach" button.
- **Blacklist**: companies removed for score below -0.3, with their score and last reviews.

## How we build it (straight to code)
Proposed stack (team confirms at kickoff): **Next.js + Tailwind + shadcn/ui** (ready-made tables, tabs, cards, badges, charts).

**We use Vercel for the UI:**
- **v0 (Vercel's UI generator)** makes the first version of each screen from the specs in sections 1–4. v0 outputs Next.js + Tailwind + shadcn/ui, so it's the same stack and the code drops straight into our repo. We then wire it to our data and shared pieces by hand.
- **Vercel hosting** gives us the live URL the hackathon requires. Every push gets its own preview link, so teammates can check each other's screens before merging.
- Prompt v0 with the screen's spec plus the shared rules (status set, pills, rating labels) so all four screens look the same.

1. **Setup commit on `main`** (one person): Next.js app, Tailwind, shadcn/ui, the shared pieces below, and seed JSON in `data/`.
2. **Shared pieces first** (`components/`), so the four views look the same:
   - `StatusPill` (Reported … Paid, Needs human, Emergency)
   - `InvoicePill` (Paid / Not paid / Overdue + deadline)
   - `RatingMeter` (-1…1, Good / Neutral / Bad / New)
   - `ContactCard` (phone/email, hidden until consent, "shared on …")
   - `TicketCard`
3. **Seed data** (`data/*.json`): units, people, companies (partner flag, trades, area, prices, reviews), tickets, invoices. One heater story runs through all of it (Musterstraße 12, Aachen; WarmHaus heating) so all four screens show the same ticket, dates and amounts.
4. **Rating logic** in one file (`lib/rating.ts`): review → score table, average after 5 reviews, Good/Neutral/Bad, promotion and blacklist rules from the design doc. All screens read labels from here, never compute their own.
5. **Four routes, one owner each, built in parallel on `feat/<area>` branches:**
   - `/tenant` (phone layout)
   - `/partner`
   - `/owner`
   - `/admin` (tabs: Tickets, Invoices, Companies, Partners, Potential partners, Blacklist)
6. Buttons (Accept, Approve, Forward to tenant, Rate, Mark done) change the data through small API routes, so a click on one screen shows up on the others. That's the "close the loop" moment in the demo.

Order of work: shared pieces + seed data → tenant and admin views (needed for the demo) → owner → partner. Monthly charts and the support chat come last.

## Verification
- Every item from the user's list appears on its screen (checklist in sections 1–4).
- Run the heater story end to end: tenant reports → admin sees ticket → partner accepts → owner approves/forwards → tenant pays and rates → admin shows new rating. Each step visible on the right screen.
- Tenant view checked at phone width; type check, lint and build pass before each merge.
