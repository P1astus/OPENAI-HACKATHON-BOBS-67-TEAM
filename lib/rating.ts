import type { Company, CompanyRating } from "../types";

// docs/system-design.md section 7. Pure functions, no I/O.

export const MIN_REVIEWS = 5;
export const BAD_BELOW = -0.3;
export const GOOD_ABOVE = 0.4;

/** 1..10 review → -1..1. 5 is exactly 0; 7+ is already in the Good band. */
export function reviewScore(rating: number): number {
  if (rating <= 5) return (rating - 5) / 4;
  if (rating <= 7) return (rating - 5) * 0.25;
  return 0.5 + (rating - 7) / 6;
}

export function companyRating(company: Pick<Company, "reviews" | "is_partner">): CompanyRating {
  const ratings = company.reviews.map((r) => r.rating);
  const review_count = ratings.length;
  const good_count = ratings.filter((r) => r > 5).length;
  const bad_count = ratings.filter((r) => r < 5).length;
  const above6_count = ratings.filter((r) => r > 6).length;

  if (review_count < MIN_REVIEWS) {
    return { score: null, label: "new", review_count, good_count, bad_count, above6_count, potential_partner: false };
  }

  const mean = ratings.reduce((sum, r) => sum + reviewScore(r), 0) / review_count;
  const score = Number(mean.toFixed(6));
  const label = score < BAD_BELOW ? "bad" : score > GOOD_ABOVE ? "good" : "neutral";
  const potential_partner = !company.is_partner && above6_count >= 3 && bad_count <= good_count && label === "good";
  return { score, label, review_count, good_count, bad_count, above6_count, potential_partner };
}

/** A "bad" company (5+ reviews, score < -0.3) is removed. Mutates and returns whether it changed. */
export function applyBlacklist(company: Company): boolean {
  if (company.status === "active" && companyRating(company).label === "bad") {
    company.status = "blacklisted";
    return true;
  }
  return false;
}
