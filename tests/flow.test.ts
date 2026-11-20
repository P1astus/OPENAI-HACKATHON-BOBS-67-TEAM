import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Triage } from "@/types";

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

const flow = await import("@/lib/flow");
const { builtinSeed } = await import("@/lib/seed");
const store = await import("@/lib/store");

const heating = { trade: "heating", urgency: "urgent", confidence: 0.93, summary: "All radiators cold.", source: "model" } as const;
const locksmith = { trade: "locksmith", urgency: "urgent", confidence: 0.95, summary: "Front door lock broken.", source: "model" } as const;

beforeEach(async () => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.ELEVENLABS_AGENT_ID;
  delete process.env.N8N_WEBHOOK_URL;
  modelTriage.value = null;
  await store.reset();
});

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
  it("is called by the voice agent instead of offering calendar slots", async () => {
    modelTriage.value = { trade: "windows_doors", urgency: "normal", confidence: 0.92, summary: "Balcony door does not close.", source: "model" };
    const t = await flow.createTicket({ tenant_id: "p_lena", unit_id: "unit_2l", claim: "The balcony door doesn't close properly anymore." });
    expect(t.company_id).toBe("c_hauswerk");
    expect(t.partner_type).toBe("partner");
    expect(t.events.map((e) => e.type)).toContain("calling_company");
    expect(t.proposed_slots.length).toBeGreaterThan(0); // simulated call without ElevenLabs
  });
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
