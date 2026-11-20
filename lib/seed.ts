import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Company, Invoice, Person, Property, Ticket, Trade, Unit } from "../types";
import { estimateCost, haversineKm, rankOptions } from "./matching";
import { seedSchemas, formatZodError } from "./schemas";
import { addDays, addMinutes, workdaySlots } from "./time";

export type State = {
  properties: Property[];
  units: Unit[];
  people: Person[];
  companies: Company[];
  tickets: Ticket[];
  invoices: Invoice[];
};

export const SEED_FILES = ["properties", "units", "people", "companies", "tickets", "invoices"] as const;

/**
 * Seed state. If all six `data/*.json` files exist (valoi2's data) they are used.
 * Otherwise the built-in demo seed below is used, so the app runs before the data lands.
 * In both cases partner calendars are topped up with future working-day slots, because
 * fixed dates in JSON go stale between rehearsal and stage.
 */
export async function loadSeed(): Promise<{ state: State; source: "data" | "builtin" }> {
  const fromFiles = await readSeedFiles().catch(() => null);
  const state = fromFiles ?? builtinSeed();
  refreshCalendars(state);
  return { state, source: fromFiles ? "data" : "builtin" };
}

async function readSeedFiles(): Promise<State> {
  const dir = path.join(process.cwd(), "data");
  const entries = await Promise.all(SEED_FILES.map(async (name) => {
    const raw: unknown = JSON.parse(await readFile(path.join(dir, `${name}.json`), "utf8"));
    const parsed = seedSchemas[name].safeParse(raw);
    if (!parsed.success) throw new Error(`data/${name}.json: ${formatZodError(parsed.error)}`);
    return [name, parsed.data] as const;
  }));
  return Object.fromEntries(entries) as State;
}

/** Give every active partner at least 6 free future slots, skipping times already booked. */
function refreshCalendars(state: State, now = Date.now()) {
  const booked = new Set(state.tickets.map((t) => `${t.company_id}|${t.appointment_at}`));
  for (const company of state.companies) {
    if (!company.is_partner) continue;
    const future = company.calendar_slots.filter((s) => Date.parse(s) > now);
    if (future.length >= 6) continue;
    const fresh = workdaySlots(now, 1, 3).filter((s) => !booked.has(`${company.id}|${s}`));
    company.calendar_slots = [...new Set([...future, ...fresh])].sort();
  }
}

// ---------------------------------------------------------------------------
// Built-in demo seed: the same story as lib/mock.ts, with dates relative to now.
// ---------------------------------------------------------------------------

export function builtinSeed(now = Date.now()): State {
  const at = (days: number) => addDays(now, days);

  const properties: Property[] = [
    { id: "prop_muster", address: "Musterstraße 12", postcode: "52062", city: "Aachen", lat: 50.7753, lng: 6.0839, building_year: 1962, heating: "Gas central heating" },
  ];
  const units: Unit[] = [
    { id: "unit_2l", property_id: "prop_muster", label: "2nd floor left", floor: 2, size_sqm: 74, owner_id: "p_maria", tenant_id: "p_lena", access_notes: "Key with caretaker, Mr. Weber" },
    { id: "unit_1r", property_id: "prop_muster", label: "1st floor right", floor: 1, size_sqm: 62, owner_id: "p_maria", tenant_id: "p_jonas", access_notes: "Ring Weber at the main entrance" },
    { id: "unit_3l", property_id: "prop_muster", label: "3rd floor left", floor: 3, size_sqm: 69, owner_id: "p_maria", tenant_id: null, access_notes: "Arrange access with the owner" },
  ];
  const people: Person[] = [
    { id: "p_lena", role: "tenant", name: "Lena Hoffmann", email: "lena.hoffmann@example.com", phone: "+49 151 0000 1201" },
    { id: "p_jonas", role: "tenant", name: "Jonas Weber", email: "jonas.weber@example.com", phone: "+49 152 0000 1202" },
    { id: "p_maria", role: "owner", name: "Maria Becker", email: "maria.becker@example.com", phone: "+49 157 0000 1203" },
  ];

  const company = (
    c: Omit<Company, "calendar_slots" | "reviews" | "phone" | "email">, ratings: number[], index: number,
  ): Company => ({
    ...c,
    phone: `+49 241 0000 13${index}`,
    email: `${c.id.slice(2)}@example.com`,
    calendar_slots: c.is_partner ? workdaySlots(now, 1, 3) : [],
    reviews: ratings.map((rating, i) => ({ ticket_id: `t_history_${c.id.slice(2)}_${i + 1}`, rating, created_at: at(-12 - i * 8) })),
  });

  const companies: Company[] = [
    company({ id: "c_warmhaus", name: "WarmHaus Heizungstechnik", is_partner: true, trades: ["heating", "plumbing"], lat: 50.7791, lng: 6.0918, service_radius_km: 22, hourly_rate_eur: 92, callout_fee_eur: 44, booking: "calendar", status: "active" }, [10, 9, 8, 10, 9, 9, 8, 10, 7, 8, 9], 1),
    company({ id: "c_elektro", name: "Elektro Schmitz", is_partner: true, trades: ["electrical", "appliances"], lat: 50.7713, lng: 6.101, service_radius_km: 18, hourly_rate_eur: 87, callout_fee_eur: 39, booking: "calendar", status: "active" }, [9, 8, 8, 7, 9, 6], 2),
    company({ id: "c_aquafix", name: "AquaFix Sanitär", is_partner: true, trades: ["plumbing"], lat: 50.7728, lng: 6.0805, service_radius_km: 15, hourly_rate_eur: 76, callout_fee_eur: 35, booking: "calendar", status: "active" }, [8, 10, 9, 8, 9, 8, 7], 3),
    company({ id: "c_thermoplus", name: "ThermoPlus Aachen", is_partner: false, trades: ["heating"], lat: 50.7996, lng: 6.1054, service_radius_km: 25, hourly_rate_eur: 103, callout_fee_eur: 52, booking: "phone", status: "active" }, [9, 8, 8, 7, 6, 5], 4),
    company({ id: "c_rheinservice", name: "RheinService Haustechnik", is_partner: false, trades: ["heating", "plumbing", "appliances"], lat: 50.7574, lng: 6.1102, service_radius_km: 20, hourly_rate_eur: 100, callout_fee_eur: 58, booking: "website", status: "active" }, [9, 7, 8], 5),
    company({ id: "c_schnellfix", name: "SchnellFix Haustechnik", is_partner: false, trades: ["heating", "plumbing"], lat: 50.7969, lng: 6.0724, service_radius_km: 20, hourly_rate_eur: 70, callout_fee_eur: 30, booking: "phone", status: "blacklisted" }, [2, 3, 1, 4, 2, 3], 6),
    // Demo 2: a non-partner locksmith with four good reviews. The fifth (from the tenant) makes it a potential partner.
    company({ id: "c_schluessel", name: "Schlüsseldienst am Markt", is_partner: false, trades: ["locksmith", "windows_doors"], lat: 50.7774, lng: 6.0834, service_radius_km: 13, hourly_rate_eur: 82, callout_fee_eur: 38, booking: "phone", status: "active" }, [8, 9, 8, 9], 7),
    company({ id: "c_hauswerk", name: "Hauswerk Aachen", is_partner: false, trades: ["general", "windows_doors", "plumbing", "electrical"], lat: 50.7659, lng: 6.0695, service_radius_km: 16, hourly_rate_eur: 69, callout_fee_eur: 40, booking: "phone", status: "active" }, [6, 5, 7, 4, 5, 6], 8),
  ];
  const byId = Object.fromEntries(companies.map((c) => [c.id, c]));
  const property = properties[0];

  const invoices: Invoice[] = [
    { id: "inv_heater", ticket_id: "t_heater", company_id: "c_warmhaus", unit_id: "unit_2l", property_id: "prop_muster", amount_eur: 228, issued_at: at(-3), due_at: at(11), payer: "owner", forwarded_at: null, status: "paid", paid_at: at(-3) },
    { id: "inv_radiator", ticket_id: "t_radiator", company_id: "c_warmhaus", unit_id: "unit_1r", property_id: "prop_muster", amount_eur: 184.5, issued_at: at(-48), due_at: at(-34), payer: "owner", forwarded_at: null, status: "paid", paid_at: at(-48) },
    { id: "inv_drain", ticket_id: "t_drain", company_id: "c_aquafix", unit_id: "unit_2l", property_id: "prop_muster", amount_eur: 148, issued_at: at(-6), due_at: at(8), payer: "tenant", forwarded_at: at(-4), status: "not_paid", paid_at: null },
  ];

  type SeedTicket = {
    id: string; unit_id: string; tenant_id: string; claim: string; createdDays: number; summary: string;
    trade: Trade | null; options: string[]; chosen?: string; status: Ticket["status"]; invoice?: Invoice; rating?: number;
  };

  const seedTicket = (s: SeedTicket): Ticket => {
    const created_at = at(s.createdDays);
    const m = (minutes: number) => addMinutes(created_at, minutes);
    const candidates = rankOptions(s.options.map((cid) => ({
      company: byId[cid], distance_km: haversineKm(property, byId[cid]), est_cost_eur: estimateCost(byId[cid], s.trade),
    })));
    const t: Ticket = {
      id: s.id, unit_id: s.unit_id, tenant_id: s.tenant_id, created_at, claim: s.claim,
      triage: {
        trade: s.trade, urgency: s.trade === "heating" ? "urgent" : "normal", confidence: s.trade ? 0.92 : 0.35,
        summary: s.summary, needs_human: !s.trade, reason: s.trade ? "" : "Not sure which trade this is (confidence 0.35).", source: "model",
      },
      candidates, company_id: null, partner_type: null, est_cost_eur: null, owner_approval: "not_needed",
      proposed_slots: [], appointment_at: null, consent: null, invoice_id: null, rating: null, status: s.status,
      events: [
        { at: created_at, actor: "tenant", type: "reported", message: "Repair request submitted." },
        { at: m(1), actor: "agent", type: "triaged", message: s.summary },
      ],
    };
    if (!s.chosen) {
      t.events.push({ at: m(2), actor: "agent", type: "needs_human", message: "Sent to the property manager for review." });
      return t;
    }
    const chosen = byId[s.chosen];
    t.company_id = chosen.id;
    t.partner_type = chosen.is_partner ? "partner" : "non_partner";
    t.est_cost_eur = candidates.find((c) => c.company_id === chosen.id)!.est_cost_eur;
    t.events.push({ at: m(2), actor: "agent", type: "matched", message: `Matched with ${chosen.name}.` });
    if (s.status === "awaiting_owner") {
      t.owner_approval = "pending";
      t.events.push({ at: m(3), actor: "agent", type: "owner_approval_requested", message: `Estimate €${t.est_cost_eur} is over €300: asked the owner to approve.` });
      return t;
    }
    t.proposed_slots = s.invoice ? workdaySlots(Date.parse(s.invoice.issued_at), -1, 1) : chosen.calendar_slots.slice(0, 3);
    t.appointment_at = t.proposed_slots[0];
    t.consent = { data_shared: ["name", "phone", "address", "access_notes"], given_at: m(20), channel: "portal" };
    t.events.push(
      { at: m(3), actor: "agent", type: "slots_proposed", message: "Three appointment times were offered." },
      { at: m(20), actor: "tenant", type: "booked", message: "Appointment booked and contact sharing approved." },
    );
    if (s.invoice) {
      t.invoice_id = s.invoice.id;
      t.events.push(
        { at: m(60), actor: "company", type: "accepted", message: "The company confirmed the job." },
        { at: s.invoice.issued_at, actor: "company", type: "invoiced", message: "Repair completed and invoice issued to the owner." },
        { at: s.invoice.issued_at, actor: "agent", type: "paid_from_wallet", message: "Paid from Maria Becker's centrix wallet." },
      );
      if (s.invoice.forwarded_at) {
        t.events.push({ at: s.invoice.forwarded_at, actor: "owner", type: "forwarded_to_tenant", message: "Invoice forwarded to the tenant and the wallet refunded." });
      }
    }
    if (s.rating) {
      t.rating = s.rating;
      t.events.push({ at: at(-42), actor: "tenant", type: "rated", message: `The tenant rated the repair ${s.rating}/10.` });
    }
    return t;
  };

  byId.c_warmhaus.reviews.push({ ticket_id: "t_radiator", rating: 9, created_at: at(-42) });

  const tickets: Ticket[] = [
    seedTicket({ id: "t_tap", unit_id: "unit_2l", tenant_id: "p_lena", claim: "The kitchen tap keeps dripping, even when I close it firmly.", createdDays: -1, summary: "Kitchen tap leaks when shut.", trade: "plumbing", status: "scheduled", options: ["c_aquafix", "c_warmhaus"], chosen: "c_aquafix" }),
    seedTicket({ id: "t_boiler", unit_id: "unit_1r", tenant_id: "p_jonas", claim: "The heating cuts out and the service display shows a pump fault.", createdDays: -2, summary: "Heating circulation pump needs inspection and possible replacement.", trade: "heating", status: "awaiting_owner", options: ["c_warmhaus"], chosen: "c_warmhaus" }),
    seedTicket({ id: "t_unclear", unit_id: "unit_2l", tenant_id: "p_lena", claim: "Something in the hallway seems wrong. I can't tell where it comes from.", createdDays: -3, summary: "Unclear problem in the hallway.", trade: null, status: "needs_human", options: ["c_hauswerk", "c_elektro", "c_schluessel"] }),
    seedTicket({ id: "t_heater", unit_id: "unit_2l", tenant_id: "p_lena", claim: "The heating is on but every radiator in my flat is cold.", createdDays: -7, summary: "Restore heating to cold radiators throughout the flat.", trade: "heating", status: "paid", options: ["c_warmhaus"], chosen: "c_warmhaus", invoice: invoices[0] }),
    seedTicket({ id: "t_radiator", unit_id: "unit_1r", tenant_id: "p_jonas", claim: "The bedroom radiator valve is stuck closed.", createdDays: -52, summary: "Repair the stuck bedroom radiator valve.", trade: "heating", status: "paid", options: ["c_warmhaus"], chosen: "c_warmhaus", invoice: invoices[1], rating: 9 }),
    seedTicket({ id: "t_drain", unit_id: "unit_2l", tenant_id: "p_lena", claim: "The bathroom sink backs up whenever I run water.", createdDays: -27, summary: "Clear the blocked bathroom sink drain.", trade: "plumbing", status: "invoiced", options: ["c_aquafix", "c_warmhaus"], chosen: "c_aquafix", invoice: invoices[2] }),
  ];

  // The boiler pump job is a bigger one than the typical-hours estimate, so it needs owner approval.
  const boiler = tickets[1];
  boiler.est_cost_eur = 420;
  boiler.candidates[0] = { ...boiler.candidates[0], est_cost_eur: 420 };
  boiler.events[boiler.events.length - 1].message = "Estimate €420 is over €300: asked the owner to approve.";

  // The tap appointment already occupies AquaFix's first slot.
  byId.c_aquafix.calendar_slots = byId.c_aquafix.calendar_slots.filter((s) => s !== tickets[0].appointment_at);

  return { properties, units, people, companies, tickets, invoices };
}
