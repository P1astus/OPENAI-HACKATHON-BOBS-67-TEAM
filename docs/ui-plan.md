# UI design plan: four views for repair matching

## Context
The four views follow the [system design](./system-design.md). The intended reading order is the next action first, then history. At 1200 px and wider, [`/demo`](https://centrix-fix.vercel.app/demo) shows all four together. At smaller widths it links to each view.

## Look and feel: Apple-style, clean and minimal
All four views share one slick, minimal look in the spirit of Apple's apps (our own design, no Apple logos or copied screens):
- **Lots of white space**, few elements per screen, one clear main action.
- **Font:** the system font with Inter and Segoe UI as fallbacks. Big bold headings, small grey secondary text.
- **Colors:** white or very light grey background (#F5F5F7-ish), near-black text, **one blue accent** for buttons and links. Green / orange / red only for status.
- **Shapes:** rounded corners (12–16 px on cards, fully rounded pills and buttons), very soft shadows, almost no borders.
- **Grouped lists** like iOS Settings: rows in rounded white blocks with thin dividers.
- **Frosted glass** top bar (blurred, see-through) on scroll.
- **Motion:** short fades (180 ms for `fade-in`). Reduced-motion preferences disable CSS animations and transitions.
- **Dark mode** comes for free with the same tokens.

## Shared rules for all four views
- One look for all (above), status shown as colored pills.
- Ticket status pills show **Reported**, **Matched**, **Scheduled**, **Done**, **Invoiced**, **Paid**, **Waiting for owner**, **Needs a person** and **Emergency**. Sending the invoice records simulated wallet payment and moves the job straight to **Paid**.
- Invoice pills show **Paid** (green) or **Not paid** (grey).
- Rating shown the same everywhere: score -1…1 as a meter with label **Good / Neutral / Bad / New (<5 reviews)**.
- The partner job card gates tenant contact fields, full address and access notes on booking consent. Contact cards can show when and how sharing was recorded.
- Tenant screen is phone-first (390 px). The other three are desktop dashboards that still work on a phone.

## 1. Tenant (phone)
- **Top: "Report a problem"** button. Opens a sheet with a text field. After matching, the tenant picks a time and confirms that the listed details can be shared.
- **My requests**: open requests as cards with status pill.
- **Upcoming appointment**: date + time, company name, contact card (call/email) and timeline.
- **Finished appointments**: list with date, company, "Rate this job" (1–10 slider) if not rated yet.
- **Invoices** show only costs forwarded to the tenant, with amount, company, payment status and a **Pay** button for unpaid invoices. Empty state: "No costs for you. Repairs are paid by your landlord."
- **Support**: a sheet previews a message to the property manager in the demo.

## 2. Partner company (desktop)
- **Jobs**: problem summary, appointment time, and consented address and contact details. A scheduled job can be accepted or completed. Past appointments show a green **Mark as done**, which opens the invoice amount dialog.
- **Done** shows the date, unit, summary, amount and an **Invoice sent** pill for each invoiced job. reltix finance handles company payment terms. centrix takes no commission.
- **Rating meter**: big score with Good / Neutral / Bad label, review count and the **Reviews** tab with individual ratings.
- **Support**: preview a message to centrix partner support.

## 3. Home owner (desktop, PMS / hotel-style dashboard)
- Three columns like a front desk board: **Urgent** (emergencies, needs a person and waiting for owner approval) · **Upcoming** (reported, matched and scheduled jobs) · **Done** (completed repairs).
- Each card: unit, problem, company, cost, status.
- **Approve** and **Decline** on estimates over €300. In a ticket awaiting human review, call or email the tenant, enter **What’s the actual problem?**, or assign an active company from the list grouped by trade. **Search online** offers unverified suggestions when the trade and location are known.
- **Repairs paid from your wallet** shows the unit, company, job date, amount and a **Paid from wallet** or **Forwarded to tenant · Not paid/Paid** pill. **Charge to tenant** is available for wallet-paid invoices and opens an inline confirmation explaining the wallet refund and naming the tenant.
- The invoice section shows payment and forwarding status. reltix finance handles terms and accounting.

## 4. Us / reltix (desktop admin)
Tabs along the top:
- **Tickets**: table with one row per ticket; label pill **Partner / Non-partner**; columns: claim (what the tenant said), repair type, company, cost, status. Click a row → side panel with the full ticket as readable fields plus a "Raw JSON" section showing the actual record. The panel also supports tenant contact, clarification and manual assignment for tickets waiting for human review.
- **Invoices** shows a flat table, newest first, with date, property address, unit, company, amount, payer and payment status. Filter by **Owner wallet** or **Tenant**.
- **Companies by rating**: sorted list, score meter, label, review count, partner or not.
- **Partners** and **Potential partners**: two lists. Potential partners show why they qualify (reviews >6 count, score) and an **Approach** button that previews outreach in a toast.
- **Blacklist**: companies removed for score below -0.3, with their score and five most recent ratings.

## Implementation
- Next.js 16 App Router, TypeScript, Tailwind v4 and shadcn/ui. Shared components in `components/` include `StatusPill`, `InvoicePill`, `RatingMeter`, `ContactCard` and `TicketCard`.
- The built-in seed in `lib/seed.ts` ties all four views to one property in Aachen. The views use the same API and SWR polling so booking, invoice and rating changes appear across them.
- The rating logic lives in `lib/rating.ts`. Screens use the company score and labels returned by the API.
- The app is deployed from the Vercel CLI. See [team setup](../TEAM_SETUP.md).

## Verification
- Check the workflows in sections 1–4, including the green completion action on a past appointment and the owner/admin clarification controls.
- Run the heater story end to end: tenant reports → admin sees the ticket → owner approves when required → tenant books → partner completes the job → centrix pays from the wallet → owner charges the tenant → tenant pays and rates → admin shows the new rating. Each step is visible on the right screen.
- Check the tenant view at phone width. Run typecheck, lint and build before each merge.
