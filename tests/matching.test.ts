import { describe, expect, it } from "vitest";
import { estimateCost, haversineKm, matchCompanies } from "@/lib/matching";
import type { Company, Property } from "@/types";

const property: Property = { id: "prop_x", address: "A 1", postcode: "52062", city: "Aachen", lat: 50.7753, lng: 6.0839, building_year: 1960, heating: "gas" };

let n = 0;
const company = (over: Partial<Company> & { ratings?: number[] } = {}): Company => {
  const { ratings = [], ...rest } = over;
  n += 1;
  return {
    id: `c_${n}`, name: `Co ${n}`, is_partner: false, trades: ["heating"], lat: 50.78, lng: 6.09, service_radius_km: 20,
    hourly_rate_eur: 80, callout_fee_eur: 40, phone: "+49", email: "x@y.z", booking: "phone", calendar_slots: [],
    reviews: ratings.map((rating, i) => ({ ticket_id: `t_${i}`, rating, created_at: "2026-11-01T00:00:00Z" })),
    status: "active", ...rest,
  };
};

describe("matching (system-design section 6)", () => {
  it("haversine is about right (Aachen → Maastricht ≈ 30 km)", () => {
    expect(haversineKm({ lat: 50.7753, lng: 6.0839 }, { lat: 50.8514, lng: 5.691 })).toBeGreaterThan(28);
    expect(haversineKm({ lat: 50.7753, lng: 6.0839 }, { lat: 50.8514, lng: 5.691 })).toBeLessThan(31);
  });

  it("estimate = callout + hourly × typical hours", () => {
    expect(estimateCost({ callout_fee_eur: 44, hourly_rate_eur: 92 }, "heating")).toBe(228);
  });

  it("partners first: a qualifying partner beats a better non-partner", () => {
    const partner = company({ is_partner: true, hourly_rate_eur: 120, ratings: [6, 6, 6, 6, 6] });
    const great = company({ hourly_rate_eur: 50, ratings: [10, 10, 10, 10, 10] });
    const r = matchCompanies(property, [great, partner], "heating");
    expect(r.pool).toBe("partner");
    expect(r.candidates.map((c) => c.company_id)).toEqual([partner.id]);
  });

  it("falls back to non-partners when no partner qualifies", () => {
    const farPartner = company({ is_partner: true, lat: 52.52, lng: 13.4 }); // Berlin
    const local = company();
    const r = matchCompanies(property, [farPartner, local], "heating");
    expect(r.pool).toBe("non_partner");
    expect(r.candidates.map((c) => c.company_id)).toEqual([local.id]);
  });

  it("excludes out-of-radius, blacklisted and wrong-trade companies", () => {
    const out = company({ lat: 51.2, lng: 6.8, service_radius_km: 10 });
    const banned = company({ status: "blacklisted" });
    const plumber = company({ trades: ["plumbing"] });
    const ok = company();
    const r = matchCompanies(property, [out, banned, plumber, ok], "heating");
    expect(r.candidates.map((c) => c.company_id)).toEqual([ok.id]);
  });

  it("no candidates → pool none", () => {
    expect(matchCompanies(property, [company({ trades: ["roofing"] })], "heating")).toEqual({ candidates: [], pool: "none" });
  });

  it("one candidate gets price = distance = 1; new company reviews = 0.5", () => {
    const [c] = matchCompanies(property, [company()], "heating").candidates;
    expect(c.parts).toEqual({ reviews: 0.5, price: 1, distance: 1 });
    expect(c.match).toBe(0.75);
  });

  it("weights 0.5 reviews / 0.3 price / 0.2 distance, best first", () => {
    const cheapNear = company({ hourly_rate_eur: 60, lat: 50.776, lng: 6.084, ratings: [5, 5, 5, 5, 5] }); // score 0
    const dearFar = company({ hourly_rate_eur: 100, lat: 50.8, lng: 6.12, ratings: [10, 10, 10, 10, 10] }); // score 1
    const r = matchCompanies(property, [cheapNear, dearFar], "heating").candidates;
    const near = r.find((c) => c.company_id === cheapNear.id)!;
    const far = r.find((c) => c.company_id === dearFar.id)!;
    expect(near.parts).toEqual({ reviews: 0.5, price: 1, distance: 1 });
    expect(far.parts).toEqual({ reviews: 1, price: 0, distance: 0 });
    expect(near.match).toBe(0.75);
    expect(far.match).toBe(0.5);
    expect(r[0].company_id).toBe(cheapNear.id);
  });
});
