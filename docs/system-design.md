# System design: repair matching for centrix (reltix challenge)

Compiled from the whiteboard session, Fri Nov 20.

> **Update (Sat Nov 21, after reltix feedback):** the focus is working with **partner companies**. The voice agent is used for **partners that take bookings by phone** (e.g. Hauswerk Aachen) instead of an online calendar; calendar partners offer their calendar times. Calling non-partners remains only a fallback when no partner fits, and finding new companies is not part of the pitch. Later sections that say "the AI calls a non-partner" describe that fallback.

## 1. In one sentence
When something breaks in an apartment, we find the best company to fix it, book the appointment with the tenant, pay for the finished repair from the owner's centrix wallet, and use the tenant's rating to decide which companies to keep, remove or sign as partners.

## 2. Who uses it
| Who | What they see |
|---|---|
| **Tenant** | Report a problem, confirm the appointment, see the status, rate the job (1–10). Sees an invoice only if the owner forwards it. |
| **Home owner** | Dashboard with urgent, upcoming and done repairs. Sees invoices paid from their centrix wallet and can charge a repair to the tenant. Approves jobs over €300. Can hand a job to the tenant to handle. |
| **Property manager / us (reltix)** | All tickets and invoices, partner list, potential partners, removed companies. Handles emergencies and cases with no match. |
| **Repair company** | Partners: jobs come in through their calendar. Non-partners: an AI phone call. |

## 3. Business model
- **The owners' subscription** is the service's only source of revenue.
- **No commission from anyone.** Partners and non-partners pay us nothing, and we take no cut of their invoices. The company bills the job at its normal price.
- **centrix manages the owner's wallet.** Finished repairs are paid from that wallet automatically. reltix finance handles company payments within 30 days and owns the accounting. Due dates and overdue statuses are outside the product scope.
- **Why partners still join:** steady jobs with no marketing cost, booking straight from their calendar, and every job comes with the context they need already filled in.

## 4. Two kinds of companies
- **Partners**: companies we have a deal with. They are in our database and we can see their calendar, so booking is instant.
- **Non-partners**: any other local company. We look for them when no partner fits and contact them through their website booking page or by phone.

## 5. The flow, step by step
1. **Tenant reports a problem**, for example "the heating doesn't work".
2. **Emergency check.** Gas smell, flooding, no power in the whole flat → straight to the property manager. No automatic booking.
3. **Check partners first.** If a partner covers this trade and area, go to step 5.
4. **No partner fits → search for non-partners** near the address. Nobody found → property manager.
5. **Pick the best company** with a fixed formula (section 6), not an AI guess.
6. **Owner approval.** If the expected cost is over **€300**, the owner approves with one click first. Under €300, the job goes ahead automatically.
7. **Find a time.**
   - Partner: read their calendar and propose dates.
   - Non-partner: use their online booking page if they have one, otherwise an **AI voice agent calls them** and agrees on dates.
8. **Tenant picks a date.** If no date works, go back to step 7.
9. **Connect tenant and company.** Phone numbers are exchanged only after the tenant agrees. We save what was shared, when and how (consent record).
10. **Work is done.** The company marks the job done.
11. **centrix links the invoice to the apartment and pays it immediately from the owner's wallet.** The owner can charge the cost to the tenant, for example when the tenant caused the damage. Forwarding refunds the owner's wallet and gives the tenant an unpaid invoice they can pay in centrix.
12. **Feedback form** goes to the tenant: "How happy are you with the repair, 1 to 10?" Satisfaction is the only thing we measure.
13. **Rating update** (section 7). It changes who gets picked next time, who gets removed and which non-partners we approach.

## 6. Picking a company
Each candidate gets a match score from 0 to 1:

```
match = 0.5 × reviews + 0.3 × price + 0.2 × distance
```

- **reviews**: the company score (section 7), rescaled from -1…1 to 0…1. A "new" company counts as 0 (the middle).
- **price**: cheapest candidate = 1, most expensive = 0.
- **distance**: closest candidate = 1, farthest = 0.
- **Partners come first** when they qualify. Non-partners are only ranked if no partner fits.
- Removed companies are never picked.

## 7. Company rating (the "reward function")

### Our rules
- Each review is 1–10. A review **above 5 is good**, **below 5 is bad**, exactly 5 is neither.
- A company with **fewer than 5 reviews is "new"**: the rating doesn't apply yet, so it can't be removed or promoted, and a few unhappy tenants can't sink it.
- From 5 reviews on, each company has a score from **-1 to 1**:

| Company score | Label | What happens |
|---|---|---|
| below -0.3 | **Bad** | **Removed.** We stop sending it jobs. |
| -0.3 to 0.4 | **Neutral** | Still used, watched. |
| above 0.4 | **Good** | Preferred in matching. |

- A non-partner becomes a **potential partner** (we approach them for a deal) when all three are true:
  1. it got **more than 6/10 at least 3 times**,
  2. it has **no more bad reviews than good ones**,
  3. it is **rated Good right now** (so it has at least 5 reviews).
- Same rules for partners and non-partners. A partner that drops below -0.3 is removed too.

### Turning a review into a score
The conversion is built so the rules agree with each other: 5 is exactly 0 (neither good nor bad), and a review that counts toward promotion (7 or more) is already in the **Good** band.

| Review | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Score | -1.00 | -0.75 | -0.50 | -0.25 | 0 | 0.25 | 0.50 | 0.67 | 0.83 | 1.00 |

```
if rating <= 5:   review_score = (rating - 5) / 4          # 1 → -1, 5 → 0
elif rating <= 7: review_score = (rating - 5) * 0.25       # 6 → 0.25, 7 → 0.5
else:             review_score = 0.5 + (rating - 7) / 6    # 10 → 1

company_score = average of all its review_scores   # only once it has 5+ reviews
```

In plain words: a company whose reviews average about **7 or more is Good**, about **4 or less is Bad**, everything between is Neutral.

### Why promotion rule 3 exists
A company can meet rules 1 and 2 and still have a low average, for example reviews 7, 7, 7, 1, 1, 1 (three good, three bad, average -0.25). Rule 3 stops us from approaching it. In normal cases a company that meets rules 1 and 2 is already Good.

### Examples
| Reviews | Score | Label | Result |
|---|---|---|---|
| 9, 9, 9, 9 | – | New | Too few reviews to judge |
| 2, 3 | – | New | Too few reviews to remove it |
| 8, 9, 7, 8, 9 | 0.70 | Good | Non-partner → potential partner |
| 7, 7, 7, 1, 1, 1 | -0.25 | Neutral | Not approached (not Good) |
| 3, 2, 4, 3, 2 | -0.55 | Bad | Removed |

## 8. What is realistic in 24 hours
| Part | How we do it for the demo |
|---|---|
| Partner database | Made-up JSON: ~15 companies, ~8 trades, calendars, prices, reviews. |
| Non-partner search | Seeded "search results" shaped like a real places API. Scraping is slow, unreliable and against most sites' terms. In the pitch: "in production this is a places API". |
| Website calendar access | Skip for the demo; most small companies have none. |
| AI phone call to non-partner | ElevenLabs voice agent calling a teammate who plays the company. Build after the main flow works. |
| Tenant date pick, owner approval, invoice + forward to tenant, feedback form | Simple web pages. Must-have. |
| Matching + rating + promotion + removal | Pure code. Must-have, and easy to show live. |
| Owner dashboard extras, subscription billing | Nice-to-have, goes on the "what's next" slide. |

**Demo path (2 minutes)** — heater breaks → partner picked and booked from their calendar → tenant confirms → job done → centrix pays the invoice from the owner's wallet → owner charges the tenant and the wallet is refunded → tenant pays and rates 9/10 → score updates live. In the second demo, the AI calls a non-partner with four earlier good reviews. The tenant gives the fifth and the company appears under "potential partners".
