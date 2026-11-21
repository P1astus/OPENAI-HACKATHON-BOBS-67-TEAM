import { randomUUID } from "node:crypto";
import type {
  Company, CompanyRating, Invoice, Ticket, Trade, Triage,
} from "../types";
import { startCompanyCall, voiceConfigured } from "./agent/voice";
import { triageClaim } from "./agent/triage";
import { badRequest, conflict, notFound, requireState } from "./errors";
import { manualCandidate, matchCompanies, optionsFor, rankOptions } from "./matching";
import { notify } from "./notify";
import { applyBlacklist, companyRating } from "./rating";
import { getState, getTicketState, mutate, type State, type VoiceAttempt } from "./store";
import { event, isUnscheduledMatch, markCompanyUnavailable, markManualAssignment, sendToHuman, usesCalendar } from "./ticket-state";
import { addDays, nowIso, roundMoney, workdaySlots } from "./time";

export const OWNER_APPROVAL_ABOVE_EUR = 300;
const SLOT_LEAD_MS = 2 * 60 * 60 * 1000; // partners: first slot at least 2 h from now
const SLOTS_OFFERED = 3;

// ---------- lookups ----------
function byId<T extends { id: string }>(items: T[], id: string, kind: string): T {
  const item = items.find((x) => x.id === id);
  if (!item) throw notFound(`${kind} ${id} not found`);
  return item;
}
export const findTicket = (s: State, id: string) => byId(s.tickets, id, "Ticket");
const findCompany = (s: State, id: string) => byId(s.companies, id, "Company");
const findUnit = (s: State, id: string) => byId(s.units, id, "Unit");
const findInvoice = (s: State, id: string) => byId(s.invoices, id, "Invoice");
const propertyOf = (s: State, t: Ticket) => byId(s.properties, findUnit(s, t.unit_id).property_id, "Property");
const ownerOf = (s: State, t: Ticket) => byId(s.people, findUnit(s, t.unit_id).owner_id, "Owner");

/** Candidate list for the admin panel when nothing auto-matched: every active company for the trade, radius ignored. */
function suggestionsFor(s: State, t: Ticket, trade: Trade | null) {
  return rankOptions(optionsFor(propertyOf(s, t), s.companies, trade));
}

// ---------- views ----------
export const ticketsNewestFirst = (tickets: Ticket[]) => [...tickets].sort((a, b) => b.created_at.localeCompare(a.created_at));
export const invoiceView = (i: Invoice, now = Date.now()) => ({ ...i, overdue: i.status === "not_paid" && now > Date.parse(i.due_at) });
export const companyView = (c: Company) => ({ ...c, rating: companyRating(c) });

export function filterTickets(s: State, f: { tenant_id?: string; owner_id?: string; company_id?: string; status?: string }) {
  const ownerByUnit = new Map(s.units.map((u) => [u.id, u.owner_id]));
  return ticketsNewestFirst(s.tickets.filter((t) =>
    (!f.tenant_id || t.tenant_id === f.tenant_id)
    && (!f.owner_id || ownerByUnit.get(t.unit_id) === f.owner_id)
    && (!f.company_id || t.company_id === f.company_id)
    && (!f.status || t.status === f.status)));
}

export function filterInvoices(s: State, f: { owner_id?: string; tenant_id?: string; company_id?: string }) {
  const ownerByUnit = new Map(s.units.map((u) => [u.id, u.owner_id]));
  const tenantByTicket = new Map(s.tickets.map((t) => [t.id, t.tenant_id]));
  const now = Date.now();
  return s.invoices
    .filter((i) =>
      (!f.owner_id || ownerByUnit.get(i.unit_id) === f.owner_id)
      && (!f.tenant_id || (i.payer === "tenant" && tenantByTicket.get(i.ticket_id) === f.tenant_id))
      && (!f.company_id || i.company_id === f.company_id))
    .sort((a, b) => b.issued_at.localeCompare(a.issued_at))
    .map((i) => invoiceView(i, now));
}

// ---------- matching + scheduling ----------
type PendingCall = VoiceAttempt | null;

/** Assign a company, then owner approval or slots. Returns a pending voice call for companies that book by phone. */
function assignCompany(s: State, t: Ticket, company: Company, cost: number, actor: "agent" | "admin" | "owner"): PendingCall {
  t.company_id = company.id;
  t.partner_type = company.is_partner ? "partner" : "non_partner";
  t.est_cost_eur = cost;
  t.proposed_slots = [];
  t.status = "matched";
  const kind = company.is_partner ? "partner" : "non-partner";
  event(t, actor, "matched", `Matched with ${company.name} (${kind}), estimate €${cost.toFixed(2)}.`);

  if (cost > OWNER_APPROVAL_ABOVE_EUR) {
    t.owner_approval = "pending";
    t.status = "awaiting_owner";
    event(t, "agent", "owner_approval_requested", `Estimate €${cost.toFixed(2)} is over €${OWNER_APPROVAL_ABOVE_EUR}: asked the owner to approve.`);
    return null;
  }
  t.owner_approval = "not_needed";
  return proposeSlots(s, t, company);
}

function proposeSlots(s: State, t: Ticket, company: Company): PendingCall {
  // Calendar partners: times come from their calendar. Everyone else (phone-booking partners and
  // non-partners) is called by the voice agent, which posts the agreed times back.
  if (!usesCalendar(company)) {
    const history = s.voiceCalls[t.id] ??= { companies: [] };
    const acceptsLegacyResult = !history.companies.includes(company.id);
    if (acceptsLegacyResult) history.companies.push(company.id);
    const attempt: VoiceAttempt = {
      ticket_id: t.id, company_id: company.id, generation: s.generation,
      attempt_id: randomUUID(), acceptsLegacyResult,
    };
    history.latest = attempt;
    event(t, "agent", "calling_company", `Calling ${company.name} to agree on a time.`);
    return attempt;
  }
  proposeCalendarSlots(s, t, company);
  return null;
}

function bookedTimes(s: State, companyId: string) {
  return new Set(s.tickets.filter((t) => t.company_id === companyId && t.appointment_at)
    .map((t) => Date.parse(t.appointment_at!)));
}

function proposeCalendarSlots(s: State, t: Ticket, company: Company) {
  const taken = bookedTimes(s, company.id);
  const earliest = Date.now() + SLOT_LEAD_MS;
  t.proposed_slots = company.calendar_slots
    .filter((slot) => Date.parse(slot) > earliest && !taken.has(Date.parse(slot)))
    .sort((a, b) => Date.parse(a) - Date.parse(b))
    .slice(0, SLOTS_OFFERED);
  if (t.proposed_slots.length) {
    event(t, "agent", "slots_proposed", `${t.proposed_slots.length} free times from ${company.name}'s calendar offered to the tenant.`);
  } else {
    sendToHuman(t, "needs_human", `No free times left in ${company.name}'s calendar.`);
  }
}

function staleResult(action: string, ticketId: string) {
  console.info(JSON.stringify({ at: action, ticket: ticketId, ignored: "stale result" }));
}

function requireGeneration(s: State, generation: number, id: string) {
  if (s.generation === generation) return;
  staleResult("ticket.reset", id);
  throw conflict("The demo was reset. Please try again.");
}

function waitingTicket(s: State, call: VoiceAttempt) {
  const t = s.tickets.find(({ id }) => id === call.ticket_id);
  if (s.generation === call.generation && s.voiceCalls[call.ticket_id]?.latest?.attempt_id === call.attempt_id
    && t && t.company_id === call.company_id && isUnscheduledMatch(t)) return t;
  staleResult("voice.start", call.ticket_id);
}

/** After the state is saved: start the call (outside the store lock), then record the outcome. */
async function runPendingCall(call: PendingCall): Promise<void> {
  if (!call) return;
  const s = await getState();
  const t = waitingTicket(s, call);
  if (!t) return;
  const company = findCompany(s, call.company_id);

  if (!voiceConfigured()) {
    // Demo fallback until the ElevenLabs agent is connected: clearly labelled in the timeline.
    const slots = workdaySlots(Date.now(), 1, 1);
    await mutate((st) => {
      if (!waitingTicket(st, call)) return;
      recordVoiceResult(st, {
        ticket_id: t.id, company_id: company.id, attempt_id: call.attempt_id,
        slots, summary: "Simulated call (voice agent not configured).",
      });
    });
    return;
  }

  const result = await startCompanyCall(t, company, propertyOf(s, t), call.attempt_id);
  await mutate((st) => {
    const ticket = waitingTicket(st, call);
    if (!ticket) return;
    if (result.status === "started") {
      event(ticket, "agent", "call_started", `AI voice agent is on the phone with ${company.name}.`);
    } else {
      sendToHuman(ticket, "needs_human", `Couldn't reach ${company.name} by phone.`);
    }
  });
}

async function ticketAfterCall(id: string, generation: number, call: PendingCall) {
  await runPendingCall(call);
  const state = await getState();
  requireGeneration(state, generation, id);
  return findTicket(state, id);
}

// ---------- routes ----------
export async function createTicket(input: { tenant_id: string; unit_id: string; claim: string }): Promise<Ticket> {
  // Validate references and gather context without holding the store.
  const before = await getState();
  const unit = findUnit(before, input.unit_id);
  const tenant = byId(before.people, input.tenant_id, "Tenant");
  if (tenant.role !== "tenant" || unit.tenant_id !== tenant.id) throw badRequest("This tenant doesn't live in this unit");
  const property = byId(before.properties, unit.property_id, "Property");

  const { triage } = await triageClaim(input.claim, { unit, property });

  const id = `t_${randomUUID()}`;
  const { result: call } = await mutate((s) => {
    requireGeneration(s, before.generation, id);
    const created_at = nowIso();
    const t: Ticket = {
      id, unit_id: unit.id, tenant_id: tenant.id, created_at, claim: input.claim.trim(),
      triage, candidates: [], company_id: null, partner_type: null, est_cost_eur: null,
      owner_approval: "not_needed", proposed_slots: [], appointment_at: null, consent: null,
      invoice_id: null, rating: null, status: "reported", events: [],
    };
    s.tickets.push(t);
    event(t, "tenant", "reported", "Repair request submitted.", created_at);
    event(t, "agent", "triaged", triageMessage(triage));

    return routeAfterTriage(s, t, triage);
  });

  return ticketAfterCall(id, before.generation, call);
}

function routeAfterTriage(s: State, t: Ticket, triage: Triage, clarified = false): PendingCall {
  const { trade } = triage;
  if (triage.needs_human || trade === null) {
    t.status = triage.urgency === "emergency" ? "emergency" : "needs_human";
    t.candidates = suggestionsFor(s, t, clarified && t.status === "needs_human" ? null : trade);
    event(t, "agent", t.status, triage.reason);
    return null;
  }

  const { candidates, pool } = matchCompanies(propertyOf(s, t), s.companies, trade);
  t.candidates = candidates;
  if (pool === "none") {
    t.candidates = suggestionsFor(s, t, trade);
    sendToHuman(t, "needs_human", `No active ${trade.replaceAll("_", " ")} company covers this address.`);
    return null;
  }
  if (pool === "non_partner") event(t, "agent", "no_partner", "No partner covers this job: searched local non-partner companies.");
  const top = candidates[0];
  return assignCompany(s, t, findCompany(s, top.company_id), top.est_cost_eur, "agent");
}

export async function clarifyTicket(id: string, note: string, actor: "owner" | "admin"): Promise<Ticket> {
  const before = await getTicketState();
  const previous = findTicket(before, id);
  requireState(previous.status === "needs_human" || previous.status === "emergency", "This ticket isn't waiting for clarification");
  const clarification = note.trim();
  const { triage } = await triageClaim(`${previous.claim}\nClarification from the ${actor}: ${clarification}`, {
    unit: findUnit(before, previous.unit_id), property: propertyOf(before, previous),
  }, clarification);

  const { result: call } = await mutate((s) => {
    requireGeneration(s, before.generation, id);
    const t = findTicket(s, id);
    requireState(t.status === previous.status && t.events.length === previous.events.length,
      "This ticket changed while it was being clarified. Try again.");
    if (t.status === "emergency" && triage.urgency !== "emergency") {
      triage.urgency = "emergency";
      triage.needs_human = true;
      triage.reason = "A person must assign a company to this emergency.";
    }
    const declinedSameTrade = triage.urgency !== "emergency"
      && t.owner_approval === "rejected" && triage.trade === t.triage?.trade;
    t.triage = triage;
    event(t, actor, "clarified", clarification);
    event(t, "agent", "triaged", triageMessage(triage));
    if (declinedSameTrade) {
      triage.reason = "";
      sendToHuman(t, "needs_human", "The owner declined the estimate. Assign a company manually.");
      return null;
    }
    return routeAfterTriage(s, t, triage, true);
  });
  return ticketAfterCall(id, before.generation, call);
}

function triageMessage(t: Triage): string {
  const what = t.trade ? t.trade.replaceAll("_", " ") : "unclear trade";
  const how = t.source === "model" ? `AI triage, confidence ${Math.round(t.confidence * 100)}%` : "safety rules";
  return `${t.summary} (${what}, ${t.urgency}; ${how}).`;
}

export async function assignTicket(id: string, company_id: string, actor: "owner" | "admin" = "admin"): Promise<Ticket> {
  const { state, result: call } = await mutate((s) => {
    const t = findTicket(s, id);
    requireState(t.status === "needs_human" || t.status === "emergency" || isUnscheduledMatch(t), "This ticket isn't waiting for a company");
    const company = findCompany(s, company_id);
    requireState(company.status === "active", `${company.name} is removed and can't get jobs`);
    let candidate = t.candidates.find((c) => c.company_id === company.id);
    if (!candidate) {
      candidate = manualCandidate(propertyOf(s, t), s.companies, t.candidates, company, t.triage?.trade ?? null);
      t.candidates.push(candidate);
    }
    markManualAssignment(t, actor);
    return assignCompany(s, t, company, candidate.est_cost_eur, actor);
  });
  return ticketAfterCall(id, state.generation, call);
}

export async function approveTicket(id: string, approved: boolean): Promise<Ticket> {
  const { state, result: call } = await mutate((s) => {
    const t = findTicket(s, id);
    requireState(t.status === "awaiting_owner" && t.owner_approval === "pending", "This ticket isn't waiting for owner approval");
    const company = findCompany(s, t.company_id!);
    if (company.status !== "active") {
      markCompanyUnavailable(t, company);
      return null;
    }
    if (!approved) {
      t.owner_approval = "rejected";
      event(t, "owner", "rejected", "The owner declined the estimate.");
      sendToHuman(t, "needs_human", "Owner declined the estimate: the property manager decides next steps.");
      return null;
    }
    t.owner_approval = "approved";
    t.status = "matched";
    event(t, "owner", "approved", `The owner approved the €${t.est_cost_eur?.toFixed(2)} estimate.`);
    return proposeSlots(s, t, company);
  });
  return ticketAfterCall(id, state.generation, call);
}

export async function bookSlot(id: string, slot: string, data_shared: string[]): Promise<Ticket> {
  const { result } = await mutate((s) => {
    const t = findTicket(s, id);
    const company = t.company_id ? findCompany(s, t.company_id) : null;
    if (!t.appointment_at && company && company.status !== "active") {
      return conflict(markCompanyUnavailable(t, company));
    }
    const time = Date.parse(slot);
    const taken = t.company_id !== null && s.tickets.some((other) =>
      other.id !== t.id && other.company_id === t.company_id && other.appointment_at
      && Date.parse(other.appointment_at) === time);
    requireState(!taken, "That time was just taken. Please pick another.");
    requireState(company !== null && t.status === "matched" && (t.owner_approval === "not_needed" || t.owner_approval === "approved"), "This ticket can't be booked right now");
    const offered = t.proposed_slots.some((p) => Date.parse(p) === time);
    requireState(offered && time > Date.now(), "This time is no longer available, pick another one");

    const at = nowIso();
    t.appointment_at = new Date(time).toISOString();
    t.consent = { data_shared: [...new Set(data_shared)], given_at: at, channel: "portal" };
    t.status = "scheduled";
    company.calendar_slots = company.calendar_slots.filter((x) => Date.parse(x) !== time);
    for (const other of s.tickets) {
      if (other.status !== "matched" || other.appointment_at || other.company_id !== company.id
        || !other.proposed_slots.some((x) => Date.parse(x) === time)) continue;
      other.proposed_slots = other.proposed_slots.filter((x) => Date.parse(x) !== time);
      if (usesCalendar(company)) proposeCalendarSlots(s, other, company);
    }
    const shared = t.consent.data_shared.length ? t.consent.data_shared.join(", ").replaceAll("_", " ") : "nothing";
    event(t, "tenant", "booked", `Appointment booked. Tenant agreed to share: ${shared}.`, at);
    return { t, company };
  });
  if (result instanceof Error) throw result;
  void notify({ ticket_id: id, event: "booked", to: result.company.email, message: `New job booked for ${result.t.appointment_at}.` });
  return result.t;
}

export async function acceptTicket(id: string): Promise<Ticket> {
  const { result } = await mutate((s) => {
    const t = findTicket(s, id);
    requireState(t.status === "scheduled" && !t.events.some((e) => e.type === "accepted"), "This job can't be accepted");
    event(t, "company", "accepted", `${findCompany(s, t.company_id!).name} confirmed the job.`);
    return t;
  });
  return result;
}

export async function completeTicket(id: string, amount_eur: number): Promise<{ ticket: Ticket; invoice: Invoice }> {
  const { result } = await mutate((s) => {
    const t = findTicket(s, id);
    requireState(t.status === "scheduled", "Only a scheduled job can be completed");
    if (t.est_cost_eur !== null) {
      requireState(amount_eur <= OWNER_APPROVAL_ABOVE_EUR || amount_eur <= t.est_cost_eur * 1.25,
        `The amount is well above the approved estimate (€${t.est_cost_eur.toFixed(2)}). Ask the owner before invoicing.`);
    }
    const unit = findUnit(s, t.unit_id);
    const owner = ownerOf(s, t);
    const at = nowIso();
    const invoice: Invoice = {
      id: `inv_${t.id.slice(2)}`, ticket_id: t.id, company_id: t.company_id!, unit_id: unit.id,
      property_id: unit.property_id, amount_eur: roundMoney(amount_eur), issued_at: at, due_at: addDays(at, 14),
      payer: "owner", forwarded_at: null, status: "paid", paid_at: at,
    };
    s.invoices.push(invoice);
    t.invoice_id = invoice.id;
    t.status = "paid";
    event(t, "company", "invoiced", `Repair done. Invoice for €${invoice.amount_eur.toFixed(2)} linked to ${unit.label}.`, at);
    event(t, "agent", "paid_from_wallet", `Paid from ${owner.name}'s centrix wallet.`, at);
    return { ticket: t, invoice, owner };
  });
  void notify({ ticket_id: id, event: "invoiced", to: result.owner.email, message: `Repair finished, €${result.invoice.amount_eur.toFixed(2)} paid from your wallet.` });
  return { ticket: result.ticket, invoice: result.invoice };
}

export async function rateTicket(id: string, rating: number): Promise<{ ticket: Ticket; company_rating: CompanyRating }> {
  const { result } = await mutate((s) => {
    const t = findTicket(s, id);
    requireState((t.status === "invoiced" || t.status === "paid") && t.rating === null && t.company_id !== null, "This repair can't be rated");
    const company = findCompany(s, t.company_id!);
    const before = companyRating(company);
    const at = nowIso();
    t.rating = rating;
    company.reviews.push({ ticket_id: t.id, rating, created_at: at });
    const removed = applyBlacklist(company);
    const company_rating = companyRating(company);
    const score = company_rating.score === null ? `new, ${company_rating.review_count}/5 reviews` : `score ${company_rating.score.toFixed(2)}, ${company_rating.label}`;
    event(t, "tenant", "rated", `The tenant rated the repair ${rating}/10. ${company.name}: ${score}.`, at);
    if (removed) {
      event(t, "agent", "company_removed", `${company.name} dropped below -0.3 and was removed.`, at);
      for (const other of s.tickets) {
        if (other.company_id === company.id) markCompanyUnavailable(other, company);
      }
    }
    if (company_rating.potential_partner && !before.potential_partner) {
      event(t, "agent", "potential_partner", `${company.name} is now a potential partner.`, at);
    }
    return { ticket: t, company_rating };
  });
  return result;
}

export async function forwardInvoice(id: string): Promise<Invoice> {
  const { result } = await mutate((s) => {
    const inv = findInvoice(s, id);
    requireState(inv.payer === "owner" && inv.status === "paid", "Only an owner invoice paid from the wallet can be forwarded");
    const t = findTicket(s, inv.ticket_id);
    const at = nowIso();
    inv.payer = "tenant";
    inv.forwarded_at = at;
    inv.status = "not_paid";
    inv.paid_at = null;
    t.status = "invoiced";
    event(t, "owner", "forwarded_to_tenant", `Invoice for €${inv.amount_eur.toFixed(2)} forwarded to the tenant and the wallet refunded.`, at);
    return inv;
  });
  return result;
}

export async function payInvoice(id: string): Promise<Invoice> {
  const { result } = await mutate((s) => {
    const inv = findInvoice(s, id);
    requireState(inv.payer === "tenant" && inv.status === "not_paid", "Only an unpaid tenant invoice can be paid");
    const t = findTicket(s, inv.ticket_id);
    const at = nowIso();
    inv.status = "paid";
    inv.paid_at = at;
    if (t.status === "invoiced") t.status = "paid";
    event(t, "tenant", "invoice_paid", `The tenant paid €${inv.amount_eur.toFixed(2)}.`, at);
    return inv;
  });
  return result;
}

export function recordVoiceResult(s: State, body: {
  ticket_id: string; company_id: string; attempt_id?: string; slots: string[]; summary: string;
}) {
  const t = s.tickets.find(({ id }) => id === body.ticket_id);
  const company = s.companies.find(({ id }) => id === body.company_id);
  const history = s.voiceCalls[body.ticket_id];
  const attempt = history?.latest;
  const lastEvent = t?.events.at(-1)?.type;
  const waiting = lastEvent === "calling_company" || lastEvent === "call_started";
  const matches = attempt
    ? attempt.generation === s.generation && attempt.company_id === body.company_id
      && (body.attempt_id === undefined ? attempt.acceptsLegacyResult : attempt.attempt_id === body.attempt_id)
    : s.generation === 0 && body.attempt_id === undefined;
  if (!t || !company || company.status !== "active" || usesCalendar(company) || t.company_id !== company.id
    || !isUnscheduledMatch(t) || !waiting || !matches) {
    staleResult("voice.result", body.ticket_id);
    throw conflict("This ticket isn't waiting for this call result.");
  }
  if (history) delete history.latest;
  const taken = bookedTimes(s, company.id);
  const slots = [...new Set(body.slots.map((x) => new Date(x).toISOString()))]
    .filter((x) => Date.parse(x) > Date.now() && !taken.has(Date.parse(x)))
    .sort();
  if (!slots.length) {
    sendToHuman(t, "needs_human", `${company.name} couldn't offer a time by phone.`);
    return t;
  }
  t.proposed_slots = slots.slice(0, SLOTS_OFFERED);
  const note = body.summary ? ` ${body.summary}` : "";
  event(t, "agent", "slots_proposed", `${company.name} offered ${t.proposed_slots.length} times by phone.${note}`);
  return t;
}
