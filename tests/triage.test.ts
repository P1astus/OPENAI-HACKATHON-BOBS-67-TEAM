import { describe, expect, it } from "vitest";
import { decide, emergencyHit, keywordTrade, triageClaim } from "@/lib/agent/triage";

describe("triage safety rules (no model)", () => {
  it.each([
    "I smell gas in the kitchen", "Starker Gasgeruch im Treppenhaus", "Wasserrohrbruch im Bad!",
    "There is water everywhere in the bathroom", "The ceiling is dripping from upstairs",
    "Smoke coming out of the socket", "Sparks when I plug in the kettle", "There's a burning smell from the fuse box",
    "There is no power in my entire apartment", "Every socket is dead", "Stromausfall in der ganzen Wohnung", "Kein Strom",
    "The whole flat has no electricity", "All outlets in my apartment have no power", "We have no power at all.",
  ])("emergency: %s", async (claim) => {
    expect(emergencyHit(claim)).not.toBeNull();
    const { triage } = await triageClaim(claim);
    expect(triage).toMatchObject({ urgency: "emergency", needs_human: true, source: "rules" });
  });

  it.each([
    "The heating is cold", "The smoke detector keeps beeping", "My kitchen tap drips",
    "No power in one socket", "One socket is dead", "Kein Strom an einer Steckdose", "Stromausfall an einer Steckdose",
    "No power in my apartment's kitchen socket",
  ])("not an emergency: %s", (claim) => {
    expect(emergencyHit(claim)).toBeNull();
  });
});

describe("keyword fallback", () => {
  it.each([
    ["The radiator is cold", "heating"], ["Der Wasserhahn tropft", "plumbing"], ["Locked out, key broke", "locksmith"],
    ["Steckdose geht nicht", "electrical"], ["Mice in the cellar", "pest_control"], ["My neighbour is loud", null],
  ])("%s → %s", (claim, trade) => {
    expect(keywordTrade(claim)).toBe(trade);
  });

  it("without an API key: keyword guess, confidence 0.4, always to a human", async () => {
    const old = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const { triage } = await triageClaim("The radiator in the bedroom is cold");
    process.env.OPENAI_API_KEY = old;
    expect(triage).toMatchObject({ trade: "heating", confidence: 0.4, source: "rules", needs_human: true });
    expect(triage.reason).toMatch(/AI triage unavailable/);
  });
});

describe("decide (needs_human is code, not prompt)", () => {
  const base = { trade: "heating" as const, urgency: "normal" as const, confidence: 0.9, summary: "x", source: "model" as const };
  it("confident + trade → automatic", () => expect(decide(base)).toMatchObject({ needs_human: false, reason: "" }));
  it("low confidence → human", () => expect(decide({ ...base, confidence: 0.69 }).needs_human).toBe(true));
  it("no trade → human", () => expect(decide({ ...base, trade: null }).needs_human).toBe(true));
  it("emergency → human", () => expect(decide({ ...base, urgency: "emergency" }).reason).toMatch(/emergency/i));
});
