import {
  ApiError,
  type Bootstrap,
  type CompanyView,
  type CreateTicketInput,
  type InvoiceFilter,
  type InvoiceView,
  type TicketFilter,
} from "./api-client";
import type { Company, CompanyRating, Invoice, MatchCandidate, Property, Ticket, TicketEvent, Trade, Triage } from "../types";

const DAY = 24 * 60 * 60 * 1000;
const seedTime = Date.now();
const nowIso = () => new Date().toISOString();
const daysFrom = (time: number, days: number) => new Date(time + days * DAY).toISOString();
const roundMoney = (amount: number) => Math.round((amount + Number.EPSILON) * 100) / 100;

const berlinDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit",
});
const berlinOffset = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Berlin", timeZoneName: "longOffset",
});

function calendarSlots(time: number, firstDay: number): string[] {
  const date = berlinDate.formatToParts(time);
  const year = Number(date.find(({ type }) => type === "year")?.value);
  const month = Number(date.find(({ type }) => type === "month")?.value);
  const day = Number(date.find(({ type }) => type === "day")?.value);

  return [firstDay, firstDay + 1].flatMap((offset) => [9, 11, 14].map((hour) => {
    const utc = new Date(Date.UTC(year, month - 1, day + offset, hour));
    const localOffset = berlinOffset.formatToParts(utc).find(({ type }) => type === "timeZoneName")?.value;
    const localTime = utc.toISOString().replace("Z", localOffset?.slice(3) || "Z");
    return new Date(localTime).toISOString();
  }));
}

function reviewScore(rating: number): number {
  if (rating <= 5) return (rating - 5) / 4;
  if (rating <= 7) return (rating - 5) * 0.25;
  return 0.5 + (rating - 7) / 6;
}

function companyRating(company: Company): CompanyRating {
  const ratings = company.reviews.map(({ rating }) => rating);
  const review_count = ratings.length;
  const good_count = ratings.filter((rating) => rating > 5).length;
  const bad_count = ratings.filter((rating) => rating < 5).length;
  const above6_count = ratings.filter((rating) => rating > 6).length;
  const score = review_count < 5
    ? null
    : ratings.reduce((sum, rating) => sum + reviewScore(rating), 0) / review_count;
  let label: CompanyRating["label"] = "new";
  if (score !== null) {
    label = score > 0.4 ? "good" : score < -0.3 ? "bad" : "neutral";
  }
  return {
    score, label, review_count, good_count, bad_count, above6_count,
    potential_partner: !company.is_partner && above6_count >= 3 && good_count >= bad_count && label === "good",
  };
}

function invoiceView(invoice: Invoice, now: number): InvoiceView {
  return { ...invoice, overdue: invoice.status === "not_paid" && now > Date.parse(invoice.due_at) };
}

// Typical labor hours used for the demo's fixed-price estimates.
const typicalHours: Record<Trade, number> = {
  heating: 2, plumbing: 1.5, electrical: 1.5, locksmith: 1, appliances: 1.5,
  windows_doors: 2, pest_control: 1, roofing: 2, general: 1.5,
};

function estimate(company: Company, trade: Trade | null): number {
  return roundMoney(company.callout_fee_eur + company.hourly_rate_eur * typicalHours[trade ?? "general"]);
}

function distanceKm(property: Property, company: Company): number {
  const radians = Math.PI / 180;
  const dLat = (company.lat - property.lat) * radians;
  const dLng = (company.lng - property.lng) * radians;
  const haversine = Math.sin(dLat / 2) ** 2
    + Math.cos(property.lat * radians) * Math.cos(company.lat * radians) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(haversine));
}

function rankCompanies(options: { company: Company; distance_km: number; est_cost_eur: number }[]): MatchCandidate[] {
  const costs = options.map(({ est_cost_eur }) => est_cost_eur);
  const distances = options.map(({ distance_km }) => distance_km);
  const minCost = Math.min(...costs);
  const maxCost = Math.max(...costs);
  const minDistance = Math.min(...distances);
  const maxDistance = Math.max(...distances);

  return options.map(({ company, distance_km, est_cost_eur }) => {
    const parts = {
      reviews: ((companyRating(company).score ?? 0) + 1) / 2,
      price: minCost === maxCost ? 1 : (maxCost - est_cost_eur) / (maxCost - minCost),
      distance: minDistance === maxDistance ? 1 : (maxDistance - distance_km) / (maxDistance - minDistance),
    };
    return {
      company_id: company.id,
      match: 0.5 * parts.reviews + 0.3 * parts.price + 0.2 * parts.distance,
      parts, distance_km, est_cost_eur,
    };
  }).sort((a, b) => b.match - a.match);
}

function companyOptions(property: Property, trade: Trade | null) {
  return state.companies
    .filter((company) => company.status === "active" && (trade === null || company.trades.includes(trade)))
    .map((company) => ({ company, distance_km: distanceKm(property, company), est_cost_eur: estimate(company, trade) }));
}

function matchingCompanies(property: Property, trade: Trade): MatchCandidate[] {
  const eligible = companyOptions(property, trade)
    .filter(({ company, distance_km }) => distance_km <= company.service_radius_km);
  const partners = eligible.filter(({ company }) => company.is_partner);
  return rankCompanies(partners.length ? partners : eligible);
}

const bootstrap: Bootstrap = {
  properties: [
    { id: "prop_muster", address: "Musterstraße 12", postcode: "52062", city: "Aachen", lat: 50.7753, lng: 6.0839, building_year: 1962, heating: "Gas central heating" },
  ],
  units: [
    { id: "unit_2l", property_id: "prop_muster", label: "2nd floor left", floor: 2, size_sqm: 74, owner_id: "p_maria", tenant_id: "p_lena", access_notes: "Key with caretaker, Mr. Weber" },
    { id: "unit_1r", property_id: "prop_muster", label: "1st floor right", floor: 1, size_sqm: 62, owner_id: "p_maria", tenant_id: "p_jonas", access_notes: "Ring Weber at the main entrance" },
    { id: "unit_3l", property_id: "prop_muster", label: "3rd floor left", floor: 3, size_sqm: 69, owner_id: "p_maria", tenant_id: null, access_notes: "Arrange access with the owner" },
  ],
  people: [
    { id: "p_lena", role: "tenant", name: "Lena Hoffmann", email: "lena.hoffmann@example.com", phone: "+49 151 0000 1201" },
    { id: "p_jonas", role: "tenant", name: "Jonas Weber", email: "jonas.weber@example.com", phone: "+49 152 0000 1202" },
    { id: "p_maria", role: "owner", name: "Maria Becker", email: "maria.becker@example.com", phone: "+49 157 0000 1203" },
  ],
};

function seedCompany(
  company: Omit<Company, "calendar_slots" | "reviews" | "phone" | "email">,
  ratings: number[],
  index: number,
): Company {
  return {
    ...company,
    phone: `+49 241 0000 13${index}`,
    email: `${company.id.slice(2)}@example.com`,
    calendar_slots: company.is_partner ? calendarSlots(seedTime, 1) : [],
    reviews: ratings.map((rating, reviewIndex) => ({
      ticket_id: `t_history_${company.id.slice(2)}_${reviewIndex + 1}`,
      rating, created_at: daysFrom(seedTime, -12 - reviewIndex * 8),
    })),
  };
}

const companies = [
  seedCompany({ id: "c_warmhaus", name: "WarmHaus Heizungstechnik", is_partner: true, trades: ["heating", "plumbing"],
    lat: 50.7791, lng: 6.0918, service_radius_km: 22, hourly_rate_eur: 92, callout_fee_eur: 44, booking: "calendar", status: "active" },
  [10, 9, 8, 10, 9, 9, 8, 10, 7, 8, 9], 1),
  seedCompany({ id: "c_elektro", name: "Elektro Schmitz", is_partner: true, trades: ["electrical", "appliances"],
    lat: 50.7713, lng: 6.101, service_radius_km: 18, hourly_rate_eur: 87, callout_fee_eur: 39, booking: "calendar", status: "active" },
  [9, 8, 8, 7, 9, 6], 2),
  seedCompany({ id: "c_aquafix", name: "AquaFix Sanitär", is_partner: true, trades: ["plumbing"],
    lat: 50.7728, lng: 6.0805, service_radius_km: 15, hourly_rate_eur: 76, callout_fee_eur: 35, booking: "calendar", status: "active" },
  [8, 10, 9, 8, 9, 8, 7], 3),
  seedCompany({ id: "c_thermoplus", name: "ThermoPlus Aachen", is_partner: false, trades: ["heating"],
    lat: 50.7996, lng: 6.1054, service_radius_km: 25, hourly_rate_eur: 103, callout_fee_eur: 52, booking: "phone", status: "active" },
  [9, 8, 8, 7, 6, 5], 4),
  seedCompany({ id: "c_rheinservice", name: "RheinService Haustechnik", is_partner: false, trades: ["heating", "plumbing", "appliances"],
    lat: 50.7574, lng: 6.1102, service_radius_km: 20, hourly_rate_eur: 100, callout_fee_eur: 58, booking: "website", status: "active" },
  [9, 7, 8], 5),
  seedCompany({ id: "c_schnellfix", name: "SchnellFix Haustechnik", is_partner: false, trades: ["heating", "plumbing"],
    lat: 50.7969, lng: 6.0724, service_radius_km: 20, hourly_rate_eur: 70, callout_fee_eur: 30, booking: "phone", status: "blacklisted" },
  [2, 3, 1, 4, 2, 3], 6),
  seedCompany({ id: "c_schluessel", name: "Schlüsseldienst am Markt", is_partner: false, trades: ["locksmith", "windows_doors"],
    lat: 50.7774, lng: 6.0834, service_radius_km: 13, hourly_rate_eur: 82, callout_fee_eur: 38, booking: "phone", status: "active" },
  [8, 7, 8, 6, 7], 7),
  seedCompany({ id: "c_hauswerk", name: "Hauswerk Aachen", is_partner: false, trades: ["general", "windows_doors", "plumbing", "electrical"],
    lat: 50.7659, lng: 6.0695, service_radius_km: 16, hourly_rate_eur: 69, callout_fee_eur: 40, booking: "phone", status: "active" },
  [6, 5, 7, 4, 5, 6], 8),
];

function addEvent(ticket: Ticket, actor: TicketEvent["actor"], type: string, message: string, at = nowIso()) {
  ticket.events.push({ at, actor, type, message });
}

function recordWalletPayment(ticket: Ticket, ownerName: string, at: string) {
  addEvent(ticket, "company", "invoiced", "Repair completed and invoice issued to the owner.", at);
  addEvent(ticket, "agent", "paid_from_wallet", `Paid from ${ownerName}'s centrix wallet`, at);
}

function reportedTicket(id: string, { unit_id, tenant_id, claim }: CreateTicketInput, at = nowIso()): Ticket {
  const ticket: Ticket = {
    id, unit_id, tenant_id, claim, created_at: at, triage: null, candidates: [],
    company_id: null, partner_type: null, est_cost_eur: null, owner_approval: "not_needed",
    proposed_slots: [], appointment_at: null, consent: null, invoice_id: null, rating: null,
    status: "reported", events: [],
  };
  addEvent(ticket, "tenant", "reported", "Repair request submitted.", at);
  return ticket;
}

function seedTicket({
  id, unit_id, tenant_id, claim, createdDays, summary, trade, options, chosen, status, invoice, rating = null,
}: CreateTicketInput & {
  id: string; createdDays: number; summary: string; trade: Trade | null; options: [Company, number][];
  chosen?: Company; status: Ticket["status"]; invoice?: Invoice; rating?: number | null;
}): Ticket {
  const ticket = reportedTicket(id, { unit_id, tenant_id, claim }, daysFrom(seedTime, createdDays));
  const milestone = (minutes: number) => new Date(Date.parse(ticket.created_at) + minutes * 60_000).toISOString();
  ticket.triage = {
    trade, urgency: trade === "heating" ? "urgent" : "normal", confidence: trade ? 0.92 : 0.35,
    summary, needs_human: !trade, reason: trade ? "" : "The report needs more detail.", source: "rules",
  };
  addEvent(ticket, "agent", "triaged", summary, milestone(1));
  ticket.candidates = rankCompanies(options.map(([company, est_cost_eur]) => ({
    company, distance_km: distanceKm(bootstrap.properties[0], company), est_cost_eur,
  })));
  ticket.status = status;
  if (!chosen) {
    addEvent(ticket, "agent", "needs_human", "Sent to the property manager for review.", milestone(2));
    return ticket;
  }

  ticket.company_id = chosen.id;
  ticket.partner_type = chosen.is_partner ? "partner" : "non_partner";
  ticket.est_cost_eur = ticket.candidates.find(({ company_id }) => company_id === chosen.id)!.est_cost_eur;
  addEvent(ticket, "agent", "matched", `Matched with ${chosen.name}.`, milestone(2));
  if (status === "awaiting_owner") {
    ticket.owner_approval = "pending";
    addEvent(ticket, "agent", "owner_approval_requested", "Requested owner approval for the €420 estimate.", milestone(3));
    return ticket;
  }

  ticket.proposed_slots = invoice
    ? calendarSlots(Date.parse(invoice.issued_at), -1).slice(0, 3)
    : calendarSlots(seedTime, 1).slice(0, 3);
  ticket.appointment_at = ticket.proposed_slots[0];
  ticket.consent = { data_shared: ["name", "phone", "address", "access_notes"], given_at: milestone(20), channel: "portal" };
  addEvent(ticket, "agent", "slots_proposed", "Three appointment times were offered.", milestone(3));
  addEvent(ticket, "tenant", "booked", "Appointment booked and contact sharing approved.", ticket.consent.given_at);

  if (invoice) {
    ticket.invoice_id = invoice.id;
    addEvent(ticket, "company", "accepted", "The company confirmed the job.", milestone(60));
    const unit = bootstrap.units.find(({ id }) => id === unit_id)!;
    const owner = bootstrap.people.find(({ id }) => id === unit.owner_id)!;
    recordWalletPayment(ticket, owner.name, invoice.issued_at);
    if (invoice.forwarded_at) addEvent(ticket, "owner", "forwarded_to_tenant", "Invoice forwarded to the tenant and the wallet refunded.", invoice.forwarded_at);
  }
  if (rating !== null) {
    ticket.rating = rating;
    addEvent(ticket, "tenant", "rated", `The tenant rated the repair ${rating}/10.`, daysFrom(seedTime, -42));
  }
  return ticket;
}

const [warmhaus, elektro, aquafix, thermoplus, rheinservice, , schluessel, hauswerk] = companies;
warmhaus.reviews.push({ ticket_id: "t_radiator", rating: 9, created_at: daysFrom(seedTime, -42) });
const invoices: Invoice[] = [
  {
    id: "inv_heater", ticket_id: "t_heater", company_id: warmhaus.id, unit_id: "unit_2l", property_id: "prop_muster",
    amount_eur: 228, issued_at: daysFrom(seedTime, -3), due_at: daysFrom(seedTime, 11),
    payer: "owner", forwarded_at: null, status: "paid", paid_at: daysFrom(seedTime, -3),
  },
  {
    id: "inv_radiator", ticket_id: "t_radiator", company_id: warmhaus.id, unit_id: "unit_1r", property_id: "prop_muster",
    amount_eur: 184.5, issued_at: daysFrom(seedTime, -48), due_at: daysFrom(seedTime, -34),
    payer: "owner", forwarded_at: null, status: "paid", paid_at: daysFrom(seedTime, -48),
  },
  {
    id: "inv_drain", ticket_id: "t_drain", company_id: aquafix.id, unit_id: "unit_2l", property_id: "prop_muster",
    amount_eur: 148, issued_at: daysFrom(seedTime, -6), due_at: daysFrom(seedTime, 8),
    payer: "tenant", forwarded_at: daysFrom(seedTime, -4), status: "not_paid", paid_at: null,
  },
];

const tickets = [
  seedTicket({
    id: "t_tap", unit_id: "unit_2l", tenant_id: "p_lena", claim: "The kitchen tap keeps dripping, even when I close it firmly.",
    createdDays: -1, summary: "Kitchen tap leaks when shut.", trade: "plumbing", status: "scheduled",
    options: [[aquafix, 149], [warmhaus, 182], [rheinservice, 208]], chosen: aquafix,
  }),
  seedTicket({
    id: "t_boiler", unit_id: "unit_1r", tenant_id: "p_jonas", claim: "The heating cuts out and the service display shows a pump fault.",
    createdDays: -2, summary: "Heating circulation pump needs inspection and possible replacement.", trade: "heating", status: "awaiting_owner",
    options: [[warmhaus, 420], [thermoplus, 451], [rheinservice, 484]], chosen: warmhaus,
  }),
  seedTicket({
    id: "t_unclear", unit_id: "unit_2l", tenant_id: "p_lena", claim: "Something in the hallway seems wrong. I can't tell where it comes from.",
    createdDays: -3, summary: "Unclear problem in the hallway.", trade: null, status: "needs_human",
    options: [[hauswerk, 143.5], [elektro, 169.5], [schluessel, 202]],
  }),
  seedTicket({
    id: "t_heater", unit_id: "unit_2l", tenant_id: "p_lena", claim: "The heating is on but every radiator in my flat is cold.",
    createdDays: -7, summary: "Restore heating to cold radiators throughout the flat.", trade: "heating", status: "paid",
    options: [[warmhaus, 228], [thermoplus, 258], [rheinservice, 276]], chosen: warmhaus, invoice: invoices[0],
  }),
  seedTicket({
    id: "t_radiator", unit_id: "unit_1r", tenant_id: "p_jonas", claim: "The bedroom radiator valve is stuck closed.",
    createdDays: -52, summary: "Repair the stuck bedroom radiator valve.", trade: "heating", status: "paid",
    options: [[warmhaus, 184.5], [thermoplus, 225], [rheinservice, 254]], chosen: warmhaus, invoice: invoices[1], rating: 9,
  }),
  seedTicket({
    id: "t_drain", unit_id: "unit_2l", tenant_id: "p_lena", claim: "The bathroom sink backs up whenever I run water.",
    createdDays: -27, summary: "Clear the blocked bathroom sink drain.", trade: "plumbing", status: "invoiced",
    options: [[aquafix, 149], [warmhaus, 182], [rheinservice, 208]], chosen: aquafix, invoice: invoices[2],
  }),
];

// The seeded tap appointment already occupies AquaFix's first slot.
aquafix.calendar_slots = aquafix.calendar_slots.filter((slot) => slot !== tickets[0].appointment_at);

const seed = { ...bootstrap, companies, tickets, invoices };
let state = structuredClone(seed);
let nextTicket = 1;

function byId<T extends { id: string }>(items: T[], id: string, kind: string): T {
  const item = items.find((entry) => entry.id === id);
  if (!item) throw new ApiError(`${kind} not found`, 404);
  return item;
}

const findTicket = (id: string) => byId(state.tickets, id, "Ticket");
const findInvoice = (id: string) => byId(state.invoices, id, "Invoice");
const findCompany = (id: string) => byId(state.companies, id, "Company");
const findUnit = (id: string) => byId(state.units, id, "Unit");

function requireState(condition: boolean, message: string) {
  if (!condition) throw new ApiError(message, 409);
}

const tradeKeywords: [Trade, RegExp][] = [
  ["heating", /heat|heizung|radiator|warm|boiler|heizkörper/i],
  ["plumbing", /tap\b|faucet|leak|drain|toilet|klo|abfluss|wasserhahn|rohr/i],
  ["electrical", /electric|socket|sockets|outlet|fuse|strom|steckdose|sicherung/i],
  ["locksmith", /lock|locked|schloss|schlüssel/i],
  ["appliances", /washing machine|dishwasher|fridge|waschmaschine|geschirrspüler|kühlschrank/i],
  ["windows_doors", /window|door|fenster|tür/i],
  ["pest_control", /pest|mice|rats|wasps|mäuse|ratten|wespen/i],
  ["roofing", /roof|dach/i],
  ["general", /shelf|handyman|regal|handwerker/i],
];

function triageClaim(claim: string): Triage {
  const trade = tradeKeywords.find(([, keywords]) => keywords.test(claim))?.[0] ?? null;
  if (/\bgas\b|gasgeruch|flood|wasserrohrbruch|water everywhere|ceiling dripping|\bfire\b|smoke|sparks|burning smell|no power.*(?:flat|apartment)|stromausfall/i.test(claim)) {
    return {
      trade, urgency: "emergency", confidence: 1, summary: "Possible emergency reported.",
      needs_human: true, reason: "An emergency keyword requires manual handling.", source: "rules",
    };
  }
  return {
    trade, urgency: trade === "heating" ? "urgent" : "normal", confidence: trade ? 0.9 : 0.35,
    summary: trade ? `Reported ${trade.replaceAll("_", " ")} issue.` : "Repair details are unclear.",
    needs_human: trade === null, reason: trade ? "" : "The report needs more detail.", source: "rules",
  };
}

function proposeSlots(ticket: Ticket, company: Company) {
  if (company.is_partner) {
    ticket.proposed_slots = company.calendar_slots.filter((slot) => Date.parse(slot) > Date.now()).slice(0, 3);
    if (ticket.proposed_slots.length) {
      addEvent(ticket, "agent", "slots_proposed", "Available calendar times offered to the tenant.");
    }
    return;
  }

  addEvent(ticket, "agent", "company_contacted", `Contacting ${company.name} to agree on a time.`);
  const currentState = state;
  setTimeout(() => {
    if (state !== currentState || ticket.status !== "matched") return;
    const bookedSlots = state.tickets.filter(({ company_id }) => company_id === company.id)
      .map(({ appointment_at }) => appointment_at);
    ticket.proposed_slots = calendarSlots(Date.now(), 1).filter((slot) => !bookedSlots.includes(slot)).slice(0, 3);
    if (ticket.proposed_slots.length) {
      addEvent(ticket, "agent", "slots_proposed", `${company.name} offered appointment times by phone.`);
    }
  }, 1000);
}

function matchTicket(ticket: Ticket, company: Company, cost: number, actor: "admin" | "agent") {
  ticket.company_id = company.id;
  ticket.partner_type = company.is_partner ? "partner" : "non_partner";
  ticket.est_cost_eur = cost;
  ticket.status = "matched";
  addEvent(ticket, actor, "matched", `Matched with ${company.name}.`);

  if (cost > 300) {
    ticket.owner_approval = "pending";
    ticket.status = "awaiting_owner";
    addEvent(ticket, "agent", "owner_approval_requested", "The estimate requires owner approval.");
  } else {
    ticket.owner_approval = "not_needed";
    proposeSlots(ticket, company);
  }
}

export async function getBootstrap(): Promise<Bootstrap> {
  const { properties, units, people } = state;
  return structuredClone({ properties, units, people });
}

export async function getTickets(filter: TicketFilter = {}): Promise<Ticket[]> {
  const matches = state.tickets.filter((ticket) => (
    (filter.tenant_id === undefined || ticket.tenant_id === filter.tenant_id)
    && (filter.owner_id === undefined || findUnit(ticket.unit_id).owner_id === filter.owner_id)
    && (filter.company_id === undefined || ticket.company_id === filter.company_id)
    && (filter.status === undefined || ticket.status === filter.status)
  ));
  return structuredClone(matches.sort((a, b) => b.created_at.localeCompare(a.created_at)));
}

export async function getTicket(id: string): Promise<Ticket> {
  return structuredClone(findTicket(id));
}

export async function createTicket(input: CreateTicketInput): Promise<Ticket> {
  const unit = findUnit(input.unit_id);
  const tenant = byId(state.people, input.tenant_id, "Tenant");
  if (tenant.role !== "tenant" || unit.tenant_id !== tenant.id) {
    throw new ApiError("The tenant does not occupy this unit", 400);
  }
  if (!input.claim.trim()) throw new ApiError("Describe the repair issue", 400);

  const property = byId(state.properties, unit.property_id, "Property");
  const ticket = reportedTicket(`t_demo_${nextTicket++}`, input);
  ticket.triage = triageClaim(input.claim);
  addEvent(ticket, "agent", "triaged", ticket.triage.summary);
  const { trade, needs_human, urgency } = ticket.triage;
  if (!needs_human && urgency !== "emergency" && trade) {
    ticket.candidates = matchingCompanies(property, trade);
  }

  const top = ticket.candidates[0];
  if (top) {
    matchTicket(ticket, findCompany(top.company_id), top.est_cost_eur, "agent");
  } else {
    ticket.status = urgency === "emergency" ? "emergency" : "needs_human";
    ticket.candidates = rankCompanies(companyOptions(property, trade));
    ticket.triage.needs_human = true;
    ticket.triage.reason ||= "No active company covers this trade and location.";
    addEvent(ticket, "agent", ticket.status, ticket.triage.reason);
  }
  state.tickets.unshift(ticket);
  return structuredClone(ticket);
}

export async function assignTicket(id: string, company_id: string): Promise<Ticket> {
  const ticket = findTicket(id);
  const company = findCompany(company_id);
  requireState(ticket.status === "needs_human" || ticket.status === "emergency", "This ticket is not waiting for an assignment");
  requireState(company.status === "active", "This company is blacklisted");
  const candidate = ticket.candidates.find((option) => option.company_id === company_id);
  matchTicket(ticket, company, candidate?.est_cost_eur ?? estimate(company, ticket.triage?.trade ?? null), "admin");
  return structuredClone(ticket);
}

export async function approveTicket(id: string, approved: boolean): Promise<Ticket> {
  const ticket = findTicket(id);
  requireState(ticket.status === "awaiting_owner" && ticket.owner_approval === "pending", "This ticket is not waiting for owner approval");
  const company = findCompany(ticket.company_id!);
  ticket.owner_approval = approved ? "approved" : "rejected";
  addEvent(ticket, "owner", approved ? "approved" : "rejected", approved ? "The owner approved the estimate." : "The owner declined the estimate.");
  if (approved) {
    ticket.status = "matched";
    proposeSlots(ticket, company);
  }
  return structuredClone(ticket);
}

export async function bookSlot(id: string, slot: string, data_shared: string[]): Promise<Ticket> {
  const ticket = findTicket(id);
  requireState(ticket.status === "matched" && (ticket.owner_approval === "not_needed" || ticket.owner_approval === "approved"), "This ticket cannot be booked yet");
  const company = findCompany(ticket.company_id!);
  const available = ticket.proposed_slots.includes(slot) && Date.parse(slot) > Date.now()
    && (!company.is_partner || company.calendar_slots.includes(slot))
    && !state.tickets.some((other) => other.company_id === company.id && other.appointment_at === slot);
  requireState(available, "This appointment time is no longer available");

  const at = nowIso();
  ticket.consent = { data_shared: [...data_shared], given_at: at, channel: "portal" };
  ticket.appointment_at = slot;
  ticket.status = "scheduled";
  company.calendar_slots = company.calendar_slots.filter((time) => time !== slot);
  for (const other of state.tickets) {
    if (other.status === "matched" && other.company_id === company.id) {
      other.proposed_slots = other.proposed_slots.filter((time) => time !== slot);
    }
  }
  addEvent(ticket, "tenant", "booked", "Appointment booked and contact sharing approved.", at);
  return structuredClone(ticket);
}

export async function acceptTicket(id: string): Promise<Ticket> {
  const ticket = findTicket(id);
  requireState(ticket.status === "scheduled" && !ticket.events.some(({ type }) => type === "accepted"), "This job cannot be accepted");
  addEvent(ticket, "company", "accepted", "The company confirmed the job.");
  return structuredClone(ticket);
}

export async function completeTicket(id: string, amount_eur: number): Promise<{ ticket: Ticket; invoice: Invoice }> {
  const ticket = findTicket(id);
  requireState(ticket.status === "scheduled", "This ticket is not scheduled");
  const amount = roundMoney(amount_eur);
  if (!Number.isFinite(amount) || amount <= 0) throw new ApiError("Enter a positive invoice amount", 400);
  const unit = findUnit(ticket.unit_id);
  const owner = byId(state.people, unit.owner_id, "Owner");
  const now = Date.now();
  const at = daysFrom(now, 0);
  const invoice: Invoice = {
    id: `inv_${ticket.id.slice(2)}`, ticket_id: id, company_id: ticket.company_id!, unit_id: unit.id,
    property_id: unit.property_id, amount_eur: amount, issued_at: at,
    due_at: daysFrom(now, 14), payer: "owner", forwarded_at: null, status: "paid", paid_at: at,
  };
  ticket.invoice_id = invoice.id;
  ticket.status = "paid";
  state.invoices.unshift(invoice);
  recordWalletPayment(ticket, owner.name, at);
  return structuredClone({ ticket, invoice });
}

export async function rateTicket(id: string, rating: number): Promise<{ ticket: Ticket; company_rating: CompanyRating }> {
  const ticket = findTicket(id);
  requireState((ticket.status === "invoiced" || ticket.status === "paid") && ticket.rating === null, "This ticket cannot be rated");
  if (!Number.isInteger(rating) || rating < 1 || rating > 10) throw new ApiError("Enter a rating from 1 to 10", 400);
  const company = findCompany(ticket.company_id!);
  const at = nowIso();
  ticket.rating = rating;
  company.reviews.push({ ticket_id: id, rating, created_at: at });
  const company_rating = companyRating(company);
  if (company_rating.score !== null && company_rating.score < -0.3) company.status = "blacklisted";
  addEvent(ticket, "tenant", "rated", `The tenant rated the repair ${rating}/10.`, at);
  return structuredClone({ ticket, company_rating });
}

export async function getInvoices(filter: InvoiceFilter = {}): Promise<InvoiceView[]> {
  const now = Date.now();
  return state.invoices.filter((invoice) => (
    (filter.owner_id === undefined || findUnit(invoice.unit_id).owner_id === filter.owner_id)
    && (filter.tenant_id === undefined || (invoice.payer === "tenant" && findTicket(invoice.ticket_id).tenant_id === filter.tenant_id))
    && (filter.company_id === undefined || invoice.company_id === filter.company_id)
  )).map((invoice) => invoiceView(invoice, now));
}

export async function forwardInvoice(id: string): Promise<Invoice> {
  const invoice = findInvoice(id);
  requireState(invoice.status === "paid" && invoice.payer === "owner", "This invoice cannot be forwarded");
  const ticket = findTicket(invoice.ticket_id);
  invoice.payer = "tenant";
  invoice.forwarded_at = nowIso();
  invoice.status = "not_paid";
  invoice.paid_at = null;
  ticket.status = "invoiced";
  addEvent(ticket, "owner", "forwarded_to_tenant", "Invoice forwarded to the tenant and the wallet refunded.", invoice.forwarded_at);
  return structuredClone(invoice);
}

export async function payInvoice(id: string): Promise<Invoice> {
  const invoice = findInvoice(id);
  const ticket = findTicket(invoice.ticket_id);
  requireState(invoice.payer === "tenant" && invoice.status === "not_paid" && ticket.status === "invoiced", "Only an unpaid tenant invoice can be paid");
  invoice.status = "paid";
  invoice.paid_at = nowIso();
  ticket.status = "paid";
  addEvent(ticket, invoice.payer, "invoice_paid", "Invoice paid.", invoice.paid_at);
  return structuredClone(invoice);
}

export async function getCompanies(): Promise<CompanyView[]> {
  return structuredClone(state.companies.map((company) => ({ ...company, rating: companyRating(company) })));
}

export async function resetMock(): Promise<{ ok: true }> {
  state = structuredClone(seed);
  nextTicket = 1;
  return { ok: true };
}
