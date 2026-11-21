# System design: repair matching for centrix (reltix challenge)

Compiled from the whiteboard session, Fri Nov 20.

> **Update (Sat Nov 21, after reltix feedback):** the focus is working with **partner companies**. The voice agent collects times from **partners that take bookings by phone** (e.g. Hauswerk Aachen). Calendar partners offer times from simulated calendars. The voice agent also handles the automatic fallback when only a non-partner fits.

## 1. In one sentence
When something breaks in an apartment, we find the best company to fix it, book the appointment with the tenant, pay for the finished repair from the owner's centrix wallet, and use the tenant's rating to improve future matches.

## 2. Who uses it
| Who | What they see |
|---|---|
| **Tenant** | Report a problem, confirm the appointment, see the status, rate the job (1–10). Sees an invoice only if the owner forwards it. |
| **Home owner** | Dashboard with urgent, upcoming and done repairs. Sees invoices paid from their centrix wallet and can charge a repair to the tenant. Approves estimates over €300 and can clarify reports or assign a company. |
| **Property manager / us (reltix)** | All tickets and invoices, partner list, potential partners, removed companies. Handles emergencies, unclear reports and cases with no match. |
| **Repair company** | Offers times from a calendar or by phone, accepts booked jobs, marks repairs done and submits the invoice amount. |

## 3. Business model
- **The owners' subscription** is the service's only source of revenue.
- **No commission from anyone.** Partners and non-partners pay us nothing, and we take no cut of their invoices. The company bills the job at its normal price.
- **centrix manages the owner's wallet.** Finished repairs are paid from that wallet automatically. reltix finance handles settlement terms, such as 30 days, and accounting. The product displays payment status.
- **Why partners still join:** steady jobs with no marketing cost, scheduling through their calendar or over the phone, and prefilled repair context.

## 4. Two kinds of companies
- **Partners**: companies we have a deal with. The demo directory lists their booking method. WarmHaus offers simulated calendar times, and Hauswerk Aachen takes bookings by phone.
- **Non-partners**: local companies in the demo directory without a partner agreement. Automatic matching considers them only when no partner fits and uses the voice path for their availability.

## 5. The flow, step by step
1. **Tenant reports a problem**, for example "the heating doesn't work".
2. **Triage.** Safety keywords such as gas, flooding or no power in the whole flat route to emergency review before any model call. OpenAI classifies the trade and urgency and returns confidence and a short summary. Emergencies, unclear trades and confidence below 0.7 go to a person. If the model is unavailable, new reports go to a person with a labelled keyword fallback.
3. **Check partners first.** If a partner covers this trade and area, go to step 5.
4. **No partner fits → check eligible non-partners** in the directory. If none fit, send the ticket to a property manager.
5. **Pick the best company** with a fixed formula (section 6), not an AI guess.
6. **Owner approval.** If the expected cost is over **€300**, the owner approves with one click first. At €300 or below, the flow proceeds to availability.
7. **Find a time.**
   - Calendar partner: offer dates from the simulated calendar.
   - Phone-booking partner or non-partner fallback: the **AI voice agent calls** and collects times for the tenant to choose from.
8. **Tenant picks and confirms a time.** A failed call start or an empty set of usable times goes to human review.
9. **Connect tenant and company.** The partner view shows tenant contact details, the full address and access notes according to the consent recorded on booking. The record stores the fields, time and channel.
10. **Work is done.** The company marks it done and sends the invoice amount. A scheduled job past its appointment time shows a green **Mark as done** button.
11. **centrix links the invoice to the apartment and pays it immediately from the owner's wallet.** The owner can charge the cost to the tenant, for example when the tenant caused the damage. The demo records wallet payment through invoice status and timeline events. Forwarding records a wallet refund and gives the tenant an unpaid invoice they can pay in the demo.
12. **Tenant rates the repair** in the app on a 1–10 scale.
13. **Rating update** (section 7). The score affects future matching and removal.

**Human review.** The owner or admin can call or email the tenant and enter what they learned under **What’s the actual problem?** (`POST /api/tickets/:id/clarify`). A clear, non-emergency clarification runs through matching again. If OpenAI is unavailable, a clarification with keywords for exactly one trade can still proceed. Emergencies always need manual assignment. The assignment list groups all active companies by trade. When the trade and location are known, **Search online** (`POST /api/companies/search-web`) returns unverified suggestions for manual follow-up.

## 6. Picking a company
Each candidate gets a match score from 0 to 1:

```
match = 0.5 × reviews + 0.3 × price + 0.2 × distance
```

- **reviews**: the company score (section 7), rescaled from -1…1 to 0…1. A "new" company has no rating score and gets 0.5 for this component.
- **price**: cheapest candidate = 1, most expensive = 0.
- **distance**: closest candidate = 1, farthest = 0. Price and distance are normalized within the chosen pool. If all values for a component are equal, each candidate gets 1 for that component. Tied match scores favor the lower estimate.
- **Partners come first** when they qualify. Non-partners are only ranked if no partner fits.
- Automatic matching requires an active company that covers the trade and is within its service radius. The estimate is the callout fee plus hourly rate × assumed labour hours for the trade.

## 7. Company rating (the "reward function")

### Our rules
- Each review is 1–10. A review **above 5 is good**, **below 5 is bad**, exactly 5 is neither.
- A company with **fewer than 5 reviews is "new"**: the rating doesn't apply yet, so it can't be removed or promoted, and a few unhappy tenants can't sink it.
- From 5 reviews on, each company has a score from **-1 to 1**:

| Company score | Label | What happens |
|---|---|---|
| below -0.3 | **Bad** | **Removed.** We stop sending it jobs. |
| -0.3 to 0.4 | **Neutral** | Remains eligible. |
| above 0.4 | **Good** | Preferred in matching. |

- A non-partner becomes a **potential partner** in the admin view when all three are true:
  1. it got **more than 6/10 at least 3 times**,
  2. it has **no more bad reviews than good ones**,
  3. it is **rated Good right now** (so it has at least 5 reviews).
- The scoring and removal rules apply to both partners and non-partners.

### Turning a review into a score
The conversion is built so the rules agree with each other: 5 is exactly 0 (neither good nor bad), and a review that counts toward the potential-partner rule (7 or more) is already in the **Good** band.

| Review | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Score | -1.00 | -0.75 | -0.50 | -0.25 | 0 | 0.25 | 0.50 | 0.67 | 0.83 | 1.00 |

```
if rating <= 5:   review_score = (rating - 5) / 4          # 1 → -1, 5 → 0
elif rating <= 7: review_score = (rating - 5) * 0.25       # 6 → 0.25, 7 → 0.5
else:             review_score = 0.5 + (rating - 7) / 6    # 10 → 1

company_score = average of all its review_scores   # only once it has 5+ reviews
```

### Why the Good score is required
A company with reviews 7, 7, 7, 1, 1, 1 has three ratings above 6 and as many good as bad reviews. Its converted average is −0.25, so it stays Neutral.

### Examples
| Reviews | Score | Label | Result |
|---|---|---|---|
| 9, 9, 9, 9 | – | New | Too few reviews to judge |
| 2, 3 | – | New | Too few reviews to remove it |
| 8, 9, 7, 8, 9 | 0.70 | Good | Non-partner → potential partner |
| 7, 7, 7, 1, 1, 1 | -0.25 | Neutral | Does not qualify |
| 3, 2, 4, 3, 2 | -0.55 | Bad | Removed |

## 8. What is realistic in 24 hours
| Part | How we do it for the demo |
|---|---|
| Partner database | Built-in synthetic seed in `lib/seed.ts`: eight companies, one property, prices, reviews and simulated calendars. The app supports nine trade codes. |
| Non-partner search | Automatic fallback uses non-partners from the seed. Owner/admin web search uses OpenAI and returns unverified suggestions for manual follow-up. |
| Calendar booking | The app reads and reserves its simulated slots. |
| AI phone call to a partner | ElevenLabs Agents and Twilio call a teammate playing Hauswerk Aachen. Missing voice configuration gives a labelled simulation. |
| Tenant date pick, owner approval, invoice + forward to tenant, feedback form | Implemented in the four role views. |
| Matching + rating + removal | Deterministic code. The company rating also exposes the potential-partner flag. |
| Subscription billing | Business model only. |

**Demo path** — Open [`/demo`](https://centrix-fix.vercel.app/demo) on a wide screen to see the tenant, partner, owner and operations views together. Book WarmHaus for a heating report, then report a balcony door problem to see Hauswerk Aachen offer times by phone. Complete the seeded past radiator appointment to see wallet payment, and clarify the seeded hallway report to see matching resume. The [pitch video notes](pitch-video.md) document the recorded flow.
