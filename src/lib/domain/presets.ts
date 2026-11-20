import type { Recommendation, RiskItem } from "@/types/agent";

/**
 * DOMAIN PRESETS, PROMPTS & STAGE-DEMO DATA (owner: feat/domain-presets).
 * After the challenge reveal: rewrite the prompts and replace the three presets (context + demo
 * block) with scenarios from the actual challenge domain. Everything else adapts automatically.
 */

/* ------------------------------ Agent prompts ------------------------------ */

export const SYSTEM_PROMPT = `You are MAIN-08, an autonomous AI Operations & Decision Engine used by enterprise operations leaders.
You receive an operational brief and must work in explicit tool-use steps:
1. Call calculate_business_roi with volume/time/cost drivers you estimate from the brief (state your assumptions).
2. Call verify_and_ground_output with your draft strategic recommendations, the operational constraints found in the brief, and candidate risks.
3. Call prepare_or_execute_n8n_workflow with a structured payload that executes the plan in the customer's systems.
Rules: be specific and quantified, use EUR, respect every constraint stated in the brief, make every recommendation time-bound with a clear action, and never invent facts that contradict the brief.`;

export const SYNTHESIS_INSTRUCTIONS = `All tools have run. Now write the final executive deliverable as ONE JSON object (no markdown) with exactly these keys:
{
  "scenarioTitle": string (short, <= 70 chars),
  "executiveSummary": string (3-5 sentences, decision-ready, cite the key numbers from the tool results),
  "voiceBriefingScript": string (70-110 words, natural spoken English for a 30-second audio briefing, no markdown, no bullet characters),
  "strategicRecommendations": [{ "title": string, "action": string (concrete, time-bound), "priority": "High" | "Medium", "expectedImpact": string }] (3-5 items, ordered by priority),
  "riskAndTradeoffs": [{ "risk": string, "mitigation": string }] (2-4 items, reflecting the verifier's trade-offs)
}
Use only the numbers produced by the tools for ROI and confidence.`;

/* ------------------------------ Presets ------------------------------ */

export interface DemoScenario {
  /** What the "planner" says in the first trace step. */
  plan: string;
  /** Inputs for the (real, deterministic) ROI calculator. */
  roi: {
    monthlyVolume: number;
    minutesPerItem: number;
    loadedHourlyCostEur: number;
    automationRatePct: number;
    avoidedMonthlyLossEur: number;
    assumptions: string[];
  };
  constraints: string[];
  recommendations: Recommendation[];
  risks: RiskItem[];
  executiveSummary: string;
  voiceBriefingScript: string;
  workflowName: string;
  payloadSummary: string;
  payload: Record<string, unknown>;
}

export interface Preset {
  id: string;
  title: string;
  tagline: string;
  icon: "ship" | "headset" | "receipt";
  /** Lower-case words used to route a free-form prompt to this demo scenario. */
  keywords: string[];
  context: string;
  demo: DemoScenario;
}

export const PRESETS: Preset[] = [
  {
    id: "port-strike",
    title: "Port Strike Supply-Chain Reroute",
    tagline: "Rotterdam strike · 412 containers at risk",
    icon: "ship",
    keywords: ["port", "strike", "container", "shipment", "logistics", "freight", "supply chain", "rotterdam"],
    context: `SITUATION (Mon 07:40 CET): Dockworkers at the Port of Rotterdam announced a 72-hour strike starting tonight. Our European fulfilment network (3 DCs: Venlo, Katowice, Lyon) has 412 inbound containers scheduled to discharge in the next 5 days.

KEY FACTS
- 412 containers inbound; 168 carry time-critical SKUs (retail promo starts Fri).
- Top-5 customers represent 61% of affected revenue (~EUR 9.4M order value at risk).
- SLA penalty clauses: EUR 18k per day per late key-account order, capped at 10 days.
- Alternatives: Antwerp (+1 day, +EUR 210/TEU), Hamburg (+2 days, +EUR 340/TEU), rail from Gdansk (+3 days, EUR 95/TEU).
- Today, the planning team re-plans exceptions manually in spreadsheets: ~640 shipment exceptions/month, ~22 min each, loaded cost EUR 58/hour.
- Constraints: customs bonded-warehouse capacity at Venlo is 85% full; no overtime budget beyond EUR 15k; key accounts must be notified within 4 hours of any ETA change.

GOAL: Decide what to reroute where, protect the Friday promo, notify customers, and trigger the rerouting workflow in our TMS via n8n.`,
    demo: {
      plan: "Decompose into (1) triage 412 containers by criticality, (2) cost-compare Antwerp/Hamburg/rail, (3) quantify automation value of exception handling, (4) stage rerouting workflow.",
      roi: {
        monthlyVolume: 640,
        minutesPerItem: 22,
        loadedHourlyCostEur: 58,
        automationRatePct: 72,
        avoidedMonthlyLossEur: 41000,
        assumptions: [
          "640 shipment exceptions / month, 22 minutes of manual re-planning each",
          "Loaded planner cost EUR 58/h",
          "72% of exceptions resolvable without human touch",
          "EUR 41k/month avoided SLA penalties & expedite fees",
        ],
      },
      constraints: [
        "Customs bonded-warehouse capacity at Venlo is 85% full",
        "No overtime budget beyond EUR 15k",
        "Key accounts must be notified within 4 hours of any ETA change",
      ],
      recommendations: [
        {
          title: "Reroute 168 time-critical containers via Antwerp today",
          action:
            "Within 4 hours, book Antwerp discharge + barge/truck to Venlo for all promo-critical SKUs; confirm slots with the carrier by 12:00 CET.",
          priority: "High",
          expectedImpact: "Protects ~EUR 6.1M of Friday-promo revenue; +EUR 35k freight cost vs. EUR 270k+ penalty exposure.",
        },
        {
          title: "Shift 120 non-urgent containers to Gdansk rail + Katowice DC",
          action:
            "By end of day, re-point bulk replenishment stock to the Gdansk rail corridor and receive at Katowice to relieve Venlo's bonded capacity.",
          priority: "High",
          expectedImpact: "Frees ~14% of Venlo bonded capacity; cheapest option at EUR 95/TEU.",
        },
        {
          title: "Auto-notify top-5 key accounts with revised ETAs",
          action:
            "Within 4 hours, send ETA-change notices generated from the TMS to the five key accounts and log them for SLA evidence.",
          priority: "High",
          expectedImpact: "Satisfies the 4-hour notification clause; avoids contractual breach claims.",
        },
        {
          title: "Hold remaining 124 containers for Hamburg decision at T+24h",
          action:
            "Set a review checkpoint tomorrow 08:00; only divert to Hamburg if strike extends beyond 72 hours.",
          priority: "Medium",
          expectedImpact: "Avoids premature EUR 340/TEU spend (~EUR 42k) on a strike that may settle early.",
        },
      ],
      risks: [
        {
          risk: "Antwerp may saturate as other shippers divert the same day",
          mitigation: "Pre-book slots now and keep Hamburg as a pre-qualified fallback.",
        },
        {
          risk: "Rerouting spend (~EUR 77k) exceeds approved overtime/expedite envelope",
          mitigation: "Cost is justified by >3x penalty avoidance; request CFO sign-off via the approval gate.",
        },
        {
          risk: "Automated customer notices may carry an incorrect ETA",
          mitigation: "Human reviews the top-5 account notices before dispatch; auto-send only for the rest.",
        },
      ],
      executiveSummary:
        "The Rotterdam strike threatens 412 inbound containers and roughly EUR 9.4M of order value, including the Friday retail promo. The recommended plan reroutes the 168 time-critical containers through Antwerp today, shifts 120 bulk containers to Gdansk rail, and holds the remainder for a 24-hour Hamburg decision. Total incremental freight is about EUR 77k against more than EUR 270k of penalty exposure. Automating exception re-planning also removes roughly 169 planner-hours per month going forward.",
      voiceBriefingScript:
        "Good morning. The Rotterdam strike puts four hundred and twelve containers and about nine point four million euros of orders at risk, including Friday's retail promo. My recommendation: reroute the one hundred sixty-eight time-critical containers through Antwerp today, move one hundred twenty bulk containers to Gdansk rail, and hold the rest for a Hamburg decision tomorrow morning. That costs about seventy-seven thousand euros but avoids over two hundred seventy thousand in penalties. I've staged the rerouting workflow in n8n. Approve it and key accounts are notified within the four-hour window.",
      workflowName: "tms-reroute-and-notify",
      payloadSummary: "Reroute 168 critical containers to Antwerp, 120 bulk to Gdansk rail; notify top-5 key accounts.",
      payload: {
        trigger: "port_strike_rotterdam",
        reroutes: [
          { containers: 168, via: "Antwerp", destination: "Venlo DC", priority: "critical" },
          { containers: 120, via: "Gdansk rail", destination: "Katowice DC", priority: "bulk" },
        ],
        hold: { containers: 124, reviewAt: "T+24h", fallback: "Hamburg" },
        notifications: { audience: "top-5 key accounts", deadlineHours: 4 },
      },
    },
  },
  {
    id: "support-surge",
    title: "Support Ticket Surge Triage",
    tagline: "18.5k tickets/mo · SLA breach looming",
    icon: "headset",
    keywords: ["ticket", "support", "customer", "helpdesk", "sla", "queue", "csat", "churn"],
    context: `SITUATION: A faulty app release on Saturday triggered a 3.4x spike in support tickets. The Tier-1 queue holds 6,200 open tickets (normal: 1,800) and median first-response time has grown from 9 minutes to 4h 12m. Enterprise SLA = 1 hour first response.

KEY FACTS
- Monthly volume is typically 18,500 tickets; manual triage + routing costs ~6 minutes per ticket at EUR 34/hour loaded.
- ~58% of tickets are repeats of 4 known issues (login loop, invoice PDF error, sync delay, SSO misconfig).
- 37 enterprise accounts (EUR 11.2M ARR) have open P1/P2 tickets; 6 have escalated to their exec sponsor.
- Churn model flags EUR 190k MRR at risk if the backlog is not cleared within 48 hours.
- Constraints: no new headcount for 90 days; agents cannot be moved off the enterprise queue; GDPR - ticket text may not leave the EU region; macros must be approved by Legal for refund language.

GOAL: Produce a 48-hour recovery plan, quantify the value of automated triage, and trigger the triage/auto-reply workflow in n8n.`,
    demo: {
      plan: "Cluster the backlog by root cause, protect enterprise SLAs first, quantify automatable share of the queue, then stage the triage workflow behind a GDPR-safe gate.",
      roi: {
        monthlyVolume: 18500,
        minutesPerItem: 6,
        loadedHourlyCostEur: 34,
        automationRatePct: 58,
        avoidedMonthlyLossEur: 12000,
        assumptions: [
          "18,500 tickets / month, 6 minutes of manual triage + routing each",
          "Loaded agent cost EUR 34/h",
          "58% of volume matches 4 known issue patterns and is auto-resolvable",
          "EUR 12k/month avoided churn from faster first response",
        ],
      },
      constraints: [
        "No new headcount for 90 days",
        "Enterprise queue agents cannot be reassigned",
        "Ticket text must stay in the EU region (GDPR)",
        "Refund language macros require Legal approval",
      ],
      recommendations: [
        {
          title: "Fast-lane the 37 enterprise accounts with open P1/P2 tickets",
          action:
            "Within 2 hours, route all enterprise P1/P2 tickets to a dedicated pod and send exec-sponsor updates to the 6 escalated accounts.",
          priority: "High",
          expectedImpact: "Protects EUR 11.2M ARR; restores the 1-hour SLA for enterprise within 24h.",
        },
        {
          title: "Auto-resolve the 4 known-issue clusters with approved macros",
          action:
            "Deploy EU-hosted classification and Legal-approved macros for login loop, invoice PDF, sync delay and SSO; auto-reply and close when confidence exceeds 90%.",
          priority: "High",
          expectedImpact: "Clears ~3,600 backlog tickets (58%) without agent time.",
        },
        {
          title: "Publish an in-app status banner and hotfix ETA",
          action: "Within 4 hours, ship a status banner linking the workaround to deflect new tickets at the source.",
          priority: "Medium",
          expectedImpact: "Reduces inbound volume by an estimated 15-20% during the recovery window.",
        },
      ],
      risks: [
        {
          risk: "Auto-closing may mis-classify a genuinely new issue as a known one",
          mitigation: "90% confidence threshold, reopen-on-reply, and daily sample audit of 50 auto-closed tickets.",
        },
        {
          risk: "Refund-related macros could create legal exposure",
          mitigation: "Exclude refund language from automation until Legal signs off; route to humans.",
        },
        {
          risk: "Agent fatigue from 48 hours of surge handling",
          mitigation: "Rotate the enterprise pod in 4-hour blocks; automation absorbs the repetitive 58%.",
        },
      ],
      executiveSummary:
        "A faulty release drove a 3.4x ticket spike: 6,200 open tickets, a 4h12m median first response and EUR 190k of MRR at risk. About 58% of the backlog maps to four known issues that can be safely auto-resolved with EU-hosted classification and Legal-approved macros. The plan fast-lanes the 37 enterprise accounts (EUR 11.2M ARR), auto-clears roughly 3,600 tickets, and deflects new volume with an in-app status banner. Steady-state, automated triage frees about 1,070 agent-hours per month.",
      voiceBriefingScript:
        "Here's your support recovery brief. The weekend release created a three-point-four times ticket spike: sixty-two hundred open tickets and a first response time of over four hours, with one hundred ninety thousand euros of monthly revenue at risk. Fifty-eight percent of the backlog comes from just four known issues, so I recommend auto-resolving those with Legal-approved macros while a dedicated pod fast-lanes the thirty-seven enterprise accounts. Estimated steady-state savings: over one thousand agent-hours a month. The triage workflow is staged in n8n and waiting for your approval.",
      workflowName: "support-triage-autoreply",
      payloadSummary: "Classify backlog, auto-reply to 4 known issues (>90% confidence), route enterprise P1/P2 to fast-lane pod.",
      payload: {
        trigger: "release_incident_ticket_surge",
        autoResolveClusters: ["login_loop", "invoice_pdf_error", "sync_delay", "sso_misconfig"],
        confidenceThreshold: 0.9,
        fastLane: { accounts: 37, priorities: ["P1", "P2"], pod: "enterprise-recovery" },
        compliance: { region: "EU", legalApprovedMacrosOnly: true },
      },
    },
  },
  {
    id: "ap-close",
    title: "Month-End Close & AP Exceptions",
    tagline: "4.2k invoices · 11% need manual review",
    icon: "receipt",
    keywords: ["invoice", "accounts payable", "ap ", "finance", "close", "ledger", "payment", "vendor", "reconcil"],
    context: `SITUATION: Finance has 3 working days to close the quarter. Accounts Payable processes ~4,200 vendor invoices per month; 11% (~460) fail 3-way match (PO / goods receipt / invoice) and land in an exception queue worked by 5 FTEs.

KEY FACTS
- Each exception takes ~9 minutes at a loaded cost of EUR 62/hour; 2,150 invoices a month require some manual coding or approval chasing.
- Late-payment fees and lost early-payment discounts currently cost ~EUR 6.5k per month.
- 38% of exceptions are price/quantity variances within a 2% tolerance that policy already allows to auto-approve.
- Duplicate-invoice incidents: 7 in the last 12 months (EUR 83k recovered after payment).
- Constraints: SOX controls require segregation of duties - nobody who codes an invoice may approve it; auto-approval limit EUR 5,000 per invoice; audit trail must be exportable; ERP is read-only from the automation layer except via the approved n8n connector.

GOAL: Propose how to clear the close backlog this week, quantify the automation opportunity, and stage the AP exception workflow through n8n.`,
    demo: {
      plan: "Segment exceptions by policy-allowed tolerance, check SOX segregation constraints, quantify automation value, and stage an approval-gated AP workflow.",
      roi: {
        monthlyVolume: 4200,
        minutesPerItem: 9,
        loadedHourlyCostEur: 62,
        automationRatePct: 64,
        avoidedMonthlyLossEur: 6500,
        assumptions: [
          "4,200 invoices / month, 9 minutes of manual handling per exception or coding task",
          "Loaded AP analyst cost EUR 62/h",
          "64% of exception handling automatable inside policy tolerance",
          "EUR 6.5k/month avoided late fees and recovered early-payment discounts",
        ],
      },
      constraints: [
        "SOX segregation of duties: coder and approver must differ",
        "Auto-approval limit of EUR 5,000 per invoice",
        "Audit trail must be exportable",
        "ERP writes only through the approved n8n connector",
      ],
      recommendations: [
        {
          title: "Auto-approve within-tolerance variances under EUR 5,000",
          action:
            "Today, enable auto-approval for price/quantity variances within 2% and below EUR 5,000; log every decision with the matched PO and receipt IDs.",
          priority: "High",
          expectedImpact: "Clears ~175 exceptions (38%) immediately and removes ~26 hours of work from the close week.",
        },
        {
          title: "Add duplicate-invoice detection before payment run",
          action:
            "Before the next payment run, fuzzy-match vendor + amount + date and hold suspected duplicates for analyst review.",
          priority: "High",
          expectedImpact: "Prevents repeat of ~EUR 83k/yr duplicate payments.",
        },
        {
          title: "Route remaining exceptions by approver, not by queue order",
          action:
            "Auto-assign each exception to a SOX-compliant approver different from the coder and send nudges at 24h.",
          priority: "Medium",
          expectedImpact: "Cuts approval chasing and protects early-payment discounts (~EUR 6.5k/month).",
        },
      ],
      risks: [
        {
          risk: "Auto-approval may mask a fraudulent invoice that stays within tolerance",
          mitigation: "Vendor-risk allow-list and weekly sampling of 25 auto-approved invoices by internal audit.",
        },
        {
          risk: "Automated routing could breach segregation-of-duties rules",
          mitigation: "Hard rule in the workflow: approver != coder, enforced and logged per invoice.",
        },
        {
          risk: "ERP connector outage during close week",
          mitigation: "Queue payloads in n8n and replay; manual fallback runbook for the 5-person AP team.",
        },
      ],
      executiveSummary:
        "AP has about 460 invoices in the exception queue with three days left to close. Policy already allows 38% of them (price/quantity variances within 2% and under EUR 5,000) to auto-approve, which alone removes roughly 26 hours of close-week work. Adding duplicate-invoice detection and SOX-compliant approver routing protects roughly EUR 83k of annual duplicate payments and recovers early-payment discounts. Run-rate automation frees about 400 analyst-hours per month.",
      voiceBriefingScript:
        "Finance brief for the quarter close. Four hundred sixty invoices are stuck in AP exceptions, and thirty-eight percent of them are within tolerance that policy already allows us to auto-approve. I recommend enabling that today, adding duplicate-invoice detection before the next payment run, and routing the rest to a different approver than the coder to keep SOX segregation intact. This frees roughly four hundred analyst-hours a month and protects about eighty-three thousand euros a year. The AP workflow is staged in n8n for your approval.",
      workflowName: "ap-exception-autoapprove",
      payloadSummary: "Auto-approve within-tolerance variances <EUR 5k, hold suspected duplicates, assign SOX-compliant approvers.",
      payload: {
        trigger: "quarter_close_ap_exceptions",
        autoApprove: { variancePctMax: 2, amountEurMax: 5000 },
        duplicateCheck: { fields: ["vendor", "amount", "invoiceDate"], action: "hold_for_review" },
        routing: { rule: "approver_not_equal_coder", nudgeAfterHours: 24 },
        audit: { exportable: true, sampleSize: 25 },
      },
    },
  },
];

/** Generic scenario used when a custom prompt matches no preset. */
export function genericDemoScenario(title: string, prompt: string): DemoScenario {
  const snippet = prompt.replace(/\s+/g, " ").trim().slice(0, 160);
  return {
    plan: "Parse the brief, extract measurable operational drivers, quantify automation value, verify against constraints, and stage a workflow.",
    roi: {
      monthlyVolume: 1200,
      minutesPerItem: 15,
      loadedHourlyCostEur: 55,
      automationRatePct: 60,
      avoidedMonthlyLossEur: 8000,
      assumptions: [
        "Volume and handling time estimated from the brief (1,200 items / month, 15 minutes each)",
        "Loaded cost EUR 55/h",
        "60% of work automatable with human oversight retained",
        "EUR 8k/month avoided rework and delay cost",
      ],
    },
    constraints: ["Human sign-off for irreversible actions", "Audit trail for every automated decision"],
    recommendations: [
      {
        title: "Automate the repetitive 60% of the workflow first",
        action: `Within 2 weeks, pilot automation on the highest-volume pattern described in the brief ("${snippet.slice(0, 80)}...") with a human review gate.`,
        priority: "High",
        expectedImpact: "Removes the bulk of manual handling time while keeping control of edge cases.",
      },
      {
        title: "Stand up a single exception queue with clear ownership",
        action: "By end of week, route all non-automatable items to named owners with a 24-hour response target.",
        priority: "High",
        expectedImpact: "Eliminates dropped items and gives leadership a live view of backlog.",
      },
      {
        title: "Instrument outcomes and review weekly",
        action: "Track hours saved, error rate and exception volume; review in a 30-minute weekly checkpoint.",
        priority: "Medium",
        expectedImpact: "Provides proof of ROI and early warning on automation drift.",
      },
    ],
    risks: [
      {
        risk: "Estimates are based on a short brief and may be off",
        mitigation: "Validate volumes with 2 weeks of real data before scaling.",
      },
      {
        risk: "Automation may handle edge cases incorrectly",
        mitigation: "Keep a human-in-the-loop approval gate and sample-audit automated decisions.",
      },
    ],
    executiveSummary: `For "${title}", the agent identified a repetitive, high-volume workflow where roughly 60% of manual effort can be automated while keeping a human approval gate for irreversible actions. The recommended plan pilots automation on the dominant pattern, centralises exceptions with named owners, and instruments outcomes for weekly review. Estimated impact is about 180 hours saved per month and meaningful annual cost avoidance.`,
    voiceBriefingScript: `Here is your operations brief for ${title}. The agent found a high-volume workflow where about sixty percent of manual effort can be automated safely. I recommend piloting automation on the dominant pattern, routing exceptions to named owners, and reviewing results weekly. Estimated savings are around one hundred eighty hours per month. The follow-up workflow is staged in n8n for your approval.`,
    workflowName: "ops-automation-pilot",
    payloadSummary: `Kick off automation pilot for "${title}" with human approval gate.`,
    payload: {
      trigger: "custom_scenario",
      scenario: title,
      briefExcerpt: snippet,
      pilot: { scope: "highest-volume pattern", humanGate: true },
    },
  };
}

/** Route a free-form prompt (or explicit scenario title) to the best preset demo. */
export function pickDemoScenario(
  prompt: string,
  scenarioTitle?: string,
): { title: string; demo: DemoScenario } {
  const byTitle = scenarioTitle ? PRESETS.find((p) => p.title === scenarioTitle) : undefined;
  if (byTitle) return { title: byTitle.title, demo: byTitle.demo };

  const text = prompt.toLowerCase();
  let best: { preset: Preset; score: number } | null = null;
  for (const preset of PRESETS) {
    const score = preset.keywords.reduce((acc, k) => acc + (text.includes(k) ? 1 : 0), 0);
    if (score >= 2 && (!best || score > best.score)) best = { preset, score };
  }
  if (best) return { title: best.preset.title, demo: best.preset.demo };

  const title =
    scenarioTitle?.trim() ||
    prompt.replace(/\s+/g, " ").trim().slice(0, 60) ||
    "Custom Operations Brief";
  return { title, demo: genericDemoScenario(title, prompt) };
}
