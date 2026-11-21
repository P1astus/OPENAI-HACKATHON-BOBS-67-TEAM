import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Ticket, Triage } from "@/types";

// Stub only the model part of triage; safety rules and the code decision stay real.
const modelTriage = vi.hoisted(() => ({ value: null as null | Omit<Triage, "needs_human" | "reason"> }));
vi.mock("@/lib/agent/triage", async (orig) => {
  const real = await orig<typeof import("@/lib/agent/triage")>();
  return {
    ...real,
    triageClaim: async (...args: Parameters<typeof real.triageClaim>) => {
      if (real.emergencyHit(args[0]) || !modelTriage.value) return real.triageClaim(...args);
      return { triage: real.decide(modelTriage.value), latency_ms: 1 };
    },
  };
});

vi.mock("next/server", async (orig) => ({
  ...await orig<typeof import("next/server")>(),
  connection: async () => {},
}));

const flow = await import("@/lib/flow");
const { builtinSeed } = await import("@/lib/seed");
const { voiceConfigured } = await import("@/lib/agent/voice");
const store = await import("@/lib/store");
const { GET: listTickets } = await import("@/app/api/tickets/route");
const { GET: getTicket } = await import("@/app/api/tickets/[id]/route");
const { GET: getBootstrap } = await import("@/app/api/bootstrap/route");

const heating = { trade: "heating", urgency: "urgent", confidence: 0.93, summary: "All radiators cold.", source: "model" } as const;
const locksmith = { trade: "locksmith", urgency: "urgent", confidence: 0.95, summary: "Front door lock broken.", source: "model" } as const;

beforeEach(async () => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.KV_REST_API_URL;
  delete process.env.ELEVENLABS_AGENT_ID;
  delete process.env.N8N_WEBHOOK_URL;
  modelTriage.value = null;
  await store.reset();
});

afterEach(() => vi.unstubAllEnvs());

describe("clarifying a repair", () => {
  const note = "The heating radiator in the hallway is ice cold and makes no sound";

  it("re-triages the seeded unclear ticket and matches a heating partner", async () => {
    modelTriage.value = heating;
    const ticket = await flow.clarifyTicket("t_unclear", ` ${note} `, "owner");
    expect(ticket).toMatchObject({ status: "matched", company_id: "c_warmhaus", triage: { trade: "heating" } });
    expect(ticket.proposed_slots).toHaveLength(3);
    expect(ticket.events).toContainEqual(expect.objectContaining({ type: "clarified", actor: "owner", message: note }));
    expect(ticket.events).toContainEqual(expect.objectContaining({ type: "triaged", message: expect.stringContaining(heating.summary) }));
  });

  it("rejects clarification in the wrong state", async () => {
    await expect(flow.clarifyTicket("t_boiler", note, "admin")).rejects.toMatchObject({ status: 409 });
  });

  it("matches from the note when the model is unavailable", async () => {
    const ticket = await flow.clarifyTicket("t_unclear", note, "admin");
    expect(ticket).toMatchObject({
      status: "matched", company_id: "c_warmhaus", triage: { trade: "heating", source: "rules", needs_human: false },
    });
  });

  it("keeps the owner's rejection when the clarified trade is unchanged", async () => {
    await flow.approveTicket("t_boiler", false);
    modelTriage.value = heating;
    const ticket = await flow.clarifyTicket("t_boiler", note, "owner");
    const reason = "The owner declined the estimate. Assign a company manually.";
    expect(ticket).toMatchObject({
      status: "needs_human", owner_approval: "rejected", proposed_slots: [],
      triage: { trade: "heating", needs_human: true, reason },
    });
    expect(ticket.events.slice(-3).map(({ type }) => type)).toEqual(["clarified", "triaged", "needs_human"]);
  });

  it("keeps a low-confidence ticket open with every active company eligible for manual assignment", async () => {
    modelTriage.value = { ...heating, confidence: 0.5 };
    const ticket = await flow.clarifyTicket("t_unclear", note, "owner");
    const { companies } = await store.getState();
    expect(ticket).toMatchObject({ status: "needs_human", triage: { trade: "heating", needs_human: true, reason: expect.any(String) } });
    expect(ticket.candidates.map(({ company_id }) => company_id).sort()).toEqual(
      companies.filter(({ status }) => status === "active").map(({ id }) => id).sort(),
    );
  });

  it("uses the post-save voice path when clarification matches a non-partner", async () => {
    modelTriage.value = locksmith;
    const ticket = await flow.clarifyTicket("t_unclear", "The key broke in the front door lock.", "admin");
    expect(ticket).toMatchObject({ status: "matched", partner_type: "non_partner" });
    expect(ticket.events.map(({ type }) => type)).toContain("calling_company");
    expect(ticket.proposed_slots.length).toBeGreaterThan(0);
  });

  it("honors emergency keywords and preserves manual assignment on later clarification", async () => {
    modelTriage.value = heating;
    const ticket = await flow.clarifyTicket("t_unclear", "There are sparks and the radiator is cold.", "owner");
    expect(ticket).toMatchObject({ status: "emergency", company_id: null, triage: { urgency: "emergency", source: "rules" } });
    const updated = await flow.clarifyTicket(ticket.id, note, "admin");
    expect(updated).toMatchObject({
      status: "emergency", company_id: null, proposed_slots: [],
      triage: { trade: "heating", urgency: "emergency", needs_human: true },
    });
    expect(updated.candidates.map(({ company_id }) => company_id)).toContain("c_warmhaus");
  });
});

describe("demo 1: heater → partner → book → done → wallet → forward → pay → rate", () => {
  it("runs end to end", async () => {
    modelTriage.value = heating;
    const t = await flow.createTicket({ tenant_id: "p_lena", unit_id: "unit_2l", claim: "Every radiator in my flat is cold" });
    expect(t.status).toBe("matched");
    expect(t.company_id).toBe("c_warmhaus");
    expect(t.partner_type).toBe("partner");
    expect(t.est_cost_eur).toBe(228);
    expect(t.proposed_slots).toHaveLength(3);
    expect(t.candidates.every((c) => c.company_id.startsWith("c_"))).toBe(true);

    const booked = await flow.bookSlot(t.id, t.proposed_slots[0], ["name", "phone", "address"]);
    expect(booked.status).toBe("scheduled");
    expect(booked.consent?.data_shared).toEqual(["name", "phone", "address"]);
    await expect(flow.bookSlot(t.id, t.proposed_slots[1], [])).rejects.toMatchObject({ status: 409 });

    await flow.acceptTicket(t.id);
    const { ticket: done, invoice } = await flow.completeTicket(t.id, 231.4);
    expect(done.status).toBe("paid");
    expect(invoice).toMatchObject({ payer: "owner", status: "paid", amount_eur: 231.4 });
    expect(done.events.map((e) => e.type)).toEqual(expect.arrayContaining(["invoiced", "paid_from_wallet"]));

    const fwd = await flow.forwardInvoice(invoice.id);
    expect(fwd).toMatchObject({ payer: "tenant", status: "not_paid", paid_at: null });
    const tenantInvoices = flow.filterInvoices(await store.getState(), { tenant_id: "p_lena" });
    expect(tenantInvoices.some((i) => i.id === invoice.id && i.overdue === false)).toBe(true);
    const paid = await flow.payInvoice(invoice.id);
    expect(paid.status).toBe("paid");
    await expect(flow.payInvoice(invoice.id)).rejects.toMatchObject({ status: 409 });

    const { company_rating } = await flow.rateTicket(t.id, 9);
    expect(company_rating.label).toBe("good");
    await expect(flow.rateTicket(t.id, 9)).rejects.toMatchObject({ status: 409 });
  });
});

it("completes WarmHaus's past seeded appointment and pays it from the owner's wallet", async () => {
  const now = Date.parse("2026-11-23T15:00:00Z"); // Monday in Berlin
  const seed = builtinSeed(now);
  const job = seed.tickets.find(({ id }) => id === "t_knock");
  expect(job).toMatchObject({ status: "scheduled", company_id: "c_warmhaus", appointment_at: "2026-11-20T09:00:00.000Z" });
  expect(Date.parse(job!.appointment_at!)).toBeLessThan(now);
  expect(seed.companies.find(({ id }) => id === "c_warmhaus")?.calendar_slots).not.toContain(job!.appointment_at);
  await store.mutate((state) => Object.assign(state, seed));

  const { ticket, invoice } = await flow.completeTicket("t_knock", 95);
  expect(ticket).toMatchObject({ status: "paid", invoice_id: invoice.id });
  expect(invoice).toMatchObject({ payer: "owner", status: "paid", amount_eur: 95 });
  expect(ticket.events.map(({ type }) => type)).toContain("paid_from_wallet");
});

it("rejects a large invoice above the estimate without recording payment", async () => {
  const approved = await flow.approveTicket("t_boiler", true);
  await flow.bookSlot(approved.id, approved.proposed_slots[0], []);
  await expect(flow.completeTicket(approved.id, 525.01)).rejects.toMatchObject({
    status: 409,
    message: "The amount is well above the approved estimate (€420.00). Ask the owner before invoicing.",
  });
  const state = await store.getState();
  expect(flow.findTicket(state, approved.id)).toMatchObject({ status: "scheduled", invoice_id: null });
  expect(state.invoices.some(({ ticket_id }) => ticket_id === approved.id)).toBe(false);
  const { invoice } = await flow.completeTicket(approved.id, 525);
  expect(invoice).toMatchObject({ amount_eur: 525, status: "paid" });
});

it.each(["2026-11-21T15:00:00Z", "2026-11-23T00:00:00Z", "2026-03-31T01:00:00Z"])(
  "seeds historical appointments on weekdays before the invoice (%s)", (now) => {
    const { tickets, invoices } = builtinSeed(Date.parse(now));
    const weekday = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", weekday: "short" });
    for (const invoice of invoices) {
      const appointment = tickets.find(({ id }) => id === invoice.ticket_id)!.appointment_at!;
      expect(Date.parse(appointment)).toBeLessThan(Date.parse(invoice.issued_at));
      expect(["Sat", "Sun"]).not.toContain(weekday.format(Date.parse(appointment)));
    }
  },
);

describe("demo 2: non-partner locksmith → (simulated) call → 5th review → potential partner", () => {
  it("promotes the company", async () => {
    modelTriage.value = locksmith;
    const t = await flow.createTicket({ tenant_id: "p_lena", unit_id: "unit_2l", claim: "The front door lock is broken" });
    expect(t.company_id).toBe("c_schluessel");
    expect(t.partner_type).toBe("non_partner");
    expect(t.status).toBe("matched");
    expect(t.proposed_slots.length).toBeGreaterThan(0); // simulated call without ElevenLabs
    expect(t.events.map((e) => e.type)).toContain("calling_company");

    await flow.bookSlot(t.id, t.proposed_slots[0], ["name", "phone"]);
    await flow.completeTicket(t.id, 120);
    const { company_rating, ticket } = await flow.rateTicket(t.id, 9);
    expect(company_rating).toMatchObject({ label: "good", potential_partner: true, review_count: 5 });
    expect(ticket.events.map((e) => e.type)).toContain("potential_partner");
  });
});

describe("phone-booking partner", () => {
  async function waitForPhone(at: number, startedAt = at) {
    await store.mutate((state) => {
      const ticket = flow.findTicket(state, "t_unclear");
      ticket.status = "matched";
      ticket.company_id = "c_hauswerk";
      ticket.events.push(
        { type: "calling_company", actor: "agent", at: new Date(at).toISOString(), message: "Calling Hauswerk." },
        { type: "call_started", actor: "agent", at: new Date(startedAt).toISOString(), message: "On the phone." },
      );
    });
  }

  it("is called by the voice agent instead of offering calendar slots", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "test-key");
    vi.stubEnv("ELEVENLABS_AGENT_ID", "test-agent");
    vi.stubEnv("ELEVENLABS_PHONE_NUMBER_ID", "test-number");
    vi.stubEnv("VOICE_WEBHOOK_SECRET", undefined);
    expect(voiceConfigured()).toBe(false);
    const fetch = vi.spyOn(globalThis, "fetch");
    modelTriage.value = { trade: "windows_doors", urgency: "normal", confidence: 0.92, summary: "Balcony door does not close.", source: "model" };
    try {
      const t = await flow.createTicket({ tenant_id: "p_lena", unit_id: "unit_2l", claim: "The balcony door doesn't close properly anymore." });
      expect(t).toMatchObject({ company_id: "c_hauswerk", partner_type: "partner", status: "matched" });
      expect(t.events).toContainEqual(expect.objectContaining({ type: "calling_company" }));
      expect(t.events).toContainEqual(expect.objectContaining({ type: "slots_proposed", message: expect.stringContaining("Simulated call") }));
      expect(t.proposed_slots.length).toBeGreaterThan(0);
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      fetch.mockRestore();
    }
  });

  it.each(["detail", "list"])("recovers a four-minute-old call on the %s GET and persists it once", async (kind) => {
    await waitForPhone(Date.now() - 241_000);
    const read = async (): Promise<Ticket> => {
      const request = new Request("http://localhost/api/tickets/t_unclear");
      if (kind === "detail") return (await getTicket(request, { params: Promise.resolve({ id: "t_unclear" }) })).json();
      const tickets: Ticket[] = await (await listTickets(request)).json();
      return tickets.find(({ id }) => id === "t_unclear")!;
    };
    const ticket = await read();
    expect(ticket.status).toBe("needs_human");
    expect(ticket.events.at(-1)).toMatchObject({
      type: "needs_human", message: "No times agreed by phone. A property manager takes over.",
    });
    expect(await read()).toEqual(ticket);
    expect(flow.findTicket(await store.getState(), ticket.id)).toEqual(ticket);
  });

  it("keeps a recent call start eligible for manual reassignment", async () => {
    await waitForPhone(Date.now() - 241_000, Date.now() - 5_000);
    expect(flow.findTicket(await store.getTicketState(), "t_unclear").status).toBe("matched");
    const assigned = await flow.assignTicket("t_unclear", "c_warmhaus");
    expect(assigned).toMatchObject({ status: "matched", company_id: "c_warmhaus" });
    expect(assigned.proposed_slots).toHaveLength(3);
  });

  it("recovers a stale call in a mutation and rejects a late result", async () => {
    await waitForPhone(Date.now() - 241_000);
    await expect(store.mutate((s) => flow.recordVoiceResult(s, {
      ticket_id: "t_unclear", company_id: "c_hauswerk", slots: [], summary: "",
    }))).rejects.toMatchObject({ status: 409 });
    expect(flow.findTicket(await store.getState(), "t_unclear").status).toBe("needs_human");
  });
});

describe("store concurrency and booking", () => {
  it("persists all concurrent in-memory mutations, including approval and rating", async () => {
    const writes = Array.from({ length: 8 }, (_, index) => store.mutate(async (state) => {
      await Promise.resolve();
      flow.findTicket(state, "t_tap").events.push({
        at: new Date().toISOString(), actor: "admin", type: "concurrent_test", message: String(index),
      });
    }));
    await Promise.all([...writes, flow.approveTicket("t_boiler", true), flow.rateTicket("t_heater", 9)]);
    const state = await store.getState();
    expect(flow.findTicket(state, "t_boiler").owner_approval).toBe("approved");
    expect(flow.findTicket(state, "t_heater").rating).toBe(9);
    expect(flow.findTicket(state, "t_tap").events.filter(({ type }) => type === "concurrent_test")).toHaveLength(writes.length);
  });

  async function twoOffers(calendarCount: number) {
    modelTriage.value = heating;
    await store.mutate((state) => {
      const company = state.companies.find(({ id }) => id === "c_warmhaus")!;
      company.calendar_slots = company.calendar_slots.slice(0, calendarCount);
    });
    const input = { tenant_id: "p_lena", unit_id: "unit_2l", claim: "Every radiator is cold" };
    return Promise.all([flow.createTicket(input), flow.createTicket(input)]);
  }

  it("rejects simultaneous booking of the same slot and refills the second offer", async () => {
    const [first, second] = await twoOffers(4);
    expect(first.proposed_slots).toEqual(second.proposed_slots);
    const [time, ...remaining] = first.proposed_slots;
    await expect(Promise.all([
      flow.bookSlot(first.id, time, []),
      flow.bookSlot(second.id, time.replace("Z", "+00:00"), []),
    ])).rejects.toMatchObject({ status: 409, message: "That time was just taken. Please pick another." });
    const state = await store.getState();
    expect(flow.findTicket(state, first.id)).toMatchObject({ status: "scheduled", appointment_at: time });
    const updated = flow.findTicket(state, second.id);
    expect(updated).toMatchObject({ status: "matched", appointment_at: null });
    const calendar = state.companies.find(({ id }) => id === first.company_id)!.calendar_slots;
    expect(updated.proposed_slots).toEqual([...remaining, calendar.at(-1)]);
    expect(updated.proposed_slots).not.toContain(time);
  });

  it("hands the remaining calendar ticket to a manager when the last slot is booked", async () => {
    const [first, second] = await twoOffers(1);
    await flow.bookSlot(first.id, first.proposed_slots[0], []);
    const updated = flow.findTicket(await store.getState(), second.id);
    expect(updated).toMatchObject({ status: "needs_human", proposed_slots: [] });
    expect(updated.events.at(-1)).toMatchObject({ message: "No free times left in WarmHaus Heizungstechnik's calendar." });
  });
});

it("scopes partner bootstrap to its own tickets and consented fields", async () => {
  await store.mutate((state) => {
    const tap = flow.findTicket(state, "t_tap");
    const radiator = flow.findTicket(state, "t_radiator");
    tap.company_id = "c_hauswerk";
    tap.consent = null;
    radiator.company_id = "c_hauswerk";
    radiator.consent!.data_shared = ["name", "email"];
    const unrelatedProperty = { ...state.properties[0], id: "prop_other" };
    state.properties.push(unrelatedProperty);
    state.units.find(({ id }) => id === "unit_3l")!.property_id = unrelatedProperty.id;
  });

  const response = await getBootstrap(new Request("http://localhost/api/bootstrap?company_id=c_hauswerk"));
  expect(response.status).toBe(200);
  const scoped = await response.json();
  expect(scoped.properties.map(({ id }: { id: string }) => id)).toEqual(["prop_muster"]);
  expect(scoped.units.map(({ id, access_notes }: { id: string; access_notes: string }) => [id, access_notes]))
    .toEqual([["unit_2l", ""], ["unit_1r", ""]]);
  expect(scoped.people).toEqual([{ id: "p_jonas", role: "tenant", name: "Jonas Weber", email: "jonas.weber@example.com" }]);

  const warmhaus = await (await getBootstrap(new Request("http://localhost/api/bootstrap?company_id=c_warmhaus"))).json();
  expect(warmhaus.units[0].access_notes).toBe("Key with caretaker, Mr. Weber");
  expect(warmhaus.people).toContainEqual({ id: "p_lena", role: "tenant", name: "Lena Hoffmann", phone: "+49 151 0000 1201" });

  const all = await (await getBootstrap(new Request("http://localhost/api/bootstrap"))).json();
  expect(all.properties).toHaveLength(2);
  expect(all.units).toHaveLength(3);
  expect(all.people).toContainEqual(expect.objectContaining({ id: "p_maria", email: "maria.becker@example.com" }));
});

describe("guards", () => {
  it("gas → emergency, no booking", async () => {
    const t = await flow.createTicket({ tenant_id: "p_lena", unit_id: "unit_2l", claim: "I smell gas in the hallway" });
    expect(t.status).toBe("emergency");
    expect(t.company_id).toBeNull();
    expect(t.triage).toMatchObject({ source: "rules", needs_human: true });
  });

  it("low confidence → needs_human, admin assigns", async () => {
    modelTriage.value = { ...heating, confidence: 0.5 };
    const t = await flow.createTicket({ tenant_id: "p_lena", unit_id: "unit_2l", claim: "Something odd with the heating maybe" });
    expect(t.status).toBe("needs_human");
    expect(t.candidates.length).toBeGreaterThan(0);
    const assigned = await flow.assignTicket(t.id, "c_warmhaus");
    expect(assigned.status).toBe("matched");
    await expect(flow.assignTicket(t.id, "c_warmhaus")).rejects.toMatchObject({ status: 409 });
  });

  it("blacklisted company can't be assigned", async () => {
    await expect(flow.assignTicket("t_unclear", "c_schnellfix")).rejects.toMatchObject({ status: 409 });
  });

  it("over €300 → owner approval, then slots", async () => {
    const t = await flow.approveTicket("t_boiler", true);
    expect(t.status).toBe("matched");
    expect(t.owner_approval).toBe("approved");
    expect(t.proposed_slots.length).toBe(3);
  });

  it("owner rejects → property manager", async () => {
    const t = await flow.approveTicket("t_boiler", false);
    expect(t).toMatchObject({ status: "needs_human", owner_approval: "rejected" });
  });

  it("wrong tenant for unit → 400", async () => {
    await expect(flow.createTicket({ tenant_id: "p_jonas", unit_id: "unit_2l", claim: "Heating cold" })).rejects.toMatchObject({ status: 400 });
  });

  it("voice result only for the assigned company in matched state", async () => {
    const s = await store.getState();
    expect(() => flow.recordVoiceResult(s, { ticket_id: "t_tap", company_id: "c_aquafix", slots: [], summary: "" })).toThrow();
  });

  it("filters tickets by owner and status", async () => {
    const s = await store.getState();
    expect(flow.filterTickets(s, { owner_id: "p_maria" }).length).toBe(s.tickets.length);
    expect(flow.filterTickets(s, { status: "awaiting_owner" }).map((t) => t.id)).toEqual(["t_boiler"]);
  });
});
