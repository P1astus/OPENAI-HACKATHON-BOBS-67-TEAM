import { describe, expect, it } from "vitest";
import { applyBlacklist, companyRating, reviewScore } from "@/lib/rating";
import type { Company } from "@/types";

const company = (ratings: number[], is_partner = false): Company => ({
  id: "c_test", name: "Test", is_partner, trades: ["heating"], lat: 0, lng: 0, service_radius_km: 10,
  hourly_rate_eur: 80, callout_fee_eur: 40, phone: "+49", email: "x@y.z", booking: "phone", calendar_slots: [],
  reviews: ratings.map((rating, i) => ({ ticket_id: `t_${i}`, rating, created_at: "2026-11-01T00:00:00Z" })),
  status: "active",
});

describe("reviewScore", () => {
  it.each([
    [1, -1], [2, -0.75], [3, -0.5], [4, -0.25], [5, 0], [6, 0.25], [7, 0.5], [8, 0.67], [9, 0.83], [10, 1],
  ])("%i → %d", (rating, score) => {
    expect(Number(reviewScore(rating).toFixed(2))).toBe(score);
  });
});

describe("companyRating (system-design section 7 examples)", () => {
  it("9,9,9,9 → new, too few reviews", () => {
    const r = companyRating(company([9, 9, 9, 9]));
    expect(r).toMatchObject({ label: "new", score: null, potential_partner: false, review_count: 4 });
  });

  it("2,3 → new, too few to remove", () => {
    const c = company([2, 3]);
    expect(companyRating(c).label).toBe("new");
    expect(applyBlacklist(c)).toBe(false);
    expect(c.status).toBe("active");
  });

  it("8,9,7,8,9 → 0.70 good, potential partner", () => {
    const r = companyRating(company([8, 9, 7, 8, 9]));
    expect(r.score!.toFixed(2)).toBe("0.70");
    expect(r.label).toBe("good");
    expect(r.potential_partner).toBe(true);
  });

  it("partners are never potential partners", () => {
    expect(companyRating(company([8, 9, 7, 8, 9], true)).potential_partner).toBe(false);
  });

  it("7,7,7,1,1,1 → -0.25 neutral, not approached", () => {
    const r = companyRating(company([7, 7, 7, 1, 1, 1]));
    expect(r.score!.toFixed(2)).toBe("-0.25");
    expect(r.label).toBe("neutral");
    expect(r.above6_count).toBe(3);
    expect(r.bad_count).toBe(r.good_count);
    expect(r.potential_partner).toBe(false);
  });

  it("3,2,4,3,2 → -0.55 bad, removed", () => {
    const c = company([3, 2, 4, 3, 2]);
    const r = companyRating(c);
    expect(r.score!.toFixed(2)).toBe("-0.55");
    expect(r.label).toBe("bad");
    expect(applyBlacklist(c)).toBe(true);
    expect(c.status).toBe("blacklisted");
  });

  it("1,1,1,8,9 → -0.30 neutral, stays active", () => {
    const c = company([1, 1, 1, 8, 9]);
    expect(companyRating(c)).toMatchObject({ score: -0.3, label: "neutral" });
    expect(applyBlacklist(c)).toBe(false);
    expect(c.status).toBe("active");
  });

  it("the 5th review switches the rating on", () => {
    const c = company([8, 9, 8, 9]);
    expect(companyRating(c).label).toBe("new");
    c.reviews.push({ ticket_id: "t_5", rating: 9, created_at: "2026-11-02T00:00:00Z" });
    expect(companyRating(c)).toMatchObject({ label: "good", potential_partner: true, review_count: 5 });
  });

  it("counts good (>5), bad (<5), above6 (>6); 5 is neither", () => {
    expect(companyRating(company([5, 6, 7, 4, 10]))).toMatchObject({ good_count: 3, bad_count: 1, above6_count: 2 });
  });
});
