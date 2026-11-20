import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Triage } from "@/types";

// Stub only the model part of triage; safety rules and the code decision stay real.
const modelTriage = vi.hoisted(() => ({ value: null as null | Omit<Triage, "needs_human" | "reason"> }));
vi.mock("@/lib/agent/triage", async (orig) => {
  const real = await orig<typeof import("@/lib/agent/triage")>();
  return {
    ...real,
    triageClaim: async (claim: string) => {
      if (real.emergencyHit(claim) || !modelTriage.value) return real.triageClaim(claim);
      return { triage: real.decide(modelTriage.value), latency_ms: 1 };
    },
  };
});

const flow = await import("@/lib/flow");
const store = await import("@/lib/store");

const heating = { trade: "heating", urgency: "urgent", confidence: 0.93, summary: "All radiators cold.", source: "model" } as const;
const locksmith = { trade: "locksmith", urgency: "urgent", confidence: 0.95, summary: "Front door lock broken.", source: "model" } as const;

beforeEach(async () => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.ELEVENLABS_AGENT_ID;
  delete process.env.N8N_WEBHOOK_URL;
  modelTriage.value = null;
  await store.reset();
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
