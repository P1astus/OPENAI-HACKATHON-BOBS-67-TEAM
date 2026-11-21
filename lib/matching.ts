import type { Company, MatchCandidate, Property, Trade } from "../types";
import { companyRating } from "./rating";
import { roundMoney } from "./time";

// docs/system-design.md section 6. Pure functions, no I/O.

/**
 * Assumed labour hours for a typical first visit per trade, used only for the cost estimate
 * (and therefore the €300 owner-approval threshold). Our own assumption, not market data.
 */
export const TYPICAL_HOURS: Record<Trade, number> = {
  heating: 2, plumbing: 1.5, electrical: 1.5, locksmith: 1, appliances: 1.5,
  windows_doors: 2, pest_control: 1, roofing: 3, general: 1.5,
};

export const WEIGHTS = { reviews: 0.5, price: 0.3, distance: 0.2 } as const;

export function estimateCost(company: Pick<Company, "callout_fee_eur" | "hourly_rate_eur">, trade: Trade | null): number {
  return roundMoney(company.callout_fee_eur + company.hourly_rate_eur * TYPICAL_HOURS[trade ?? "general"]);
}

/** Great-circle distance in km. */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

type Option = { company: Company; distance_km: number; est_cost_eur: number };

const round = (n: number, digits = 3) => Math.round(n * 10 ** digits) / 10 ** digits;

/** 1 for the best value (lowest), 0 for the worst; 1 for everyone when all are equal. */
function normaliseLowIsBest(value: number, min: number, max: number): number {
  return max === min ? 1 : (max - value) / (max - min);
}

/** Score and sort options (best first). Price and distance are min-max normalised over `options`. */
export function rankOptions(options: Option[]): MatchCandidate[] {
  if (!options.length) return [];
  const costs = options.map((o) => o.est_cost_eur);
  const dists = options.map((o) => o.distance_km);
  const [minC, maxC, minD, maxD] = [Math.min(...costs), Math.max(...costs), Math.min(...dists), Math.max(...dists)];

  return options
    .map(({ company, distance_km, est_cost_eur }) => {
      const score = companyRating(company).score;
      const parts = {
        reviews: round(score === null ? 0.5 : (score + 1) / 2),
        price: round(normaliseLowIsBest(est_cost_eur, minC, maxC)),
        distance: round(normaliseLowIsBest(distance_km, minD, maxD)),
      };
      const match = round(WEIGHTS.reviews * parts.reviews + WEIGHTS.price * parts.price + WEIGHTS.distance * parts.distance);
      return { company_id: company.id, match, parts, distance_km: round(distance_km, 1), est_cost_eur };
    })
    .sort((a, b) => b.match - a.match || a.est_cost_eur - b.est_cost_eur);
}

/** Every active company that does this trade, with distance and estimate (radius not applied). */
export function optionsFor(property: Property, companies: Company[], trade: Trade | null): Option[] {
  return companies
    .filter((c) => c.status === "active" && (trade === null || c.trades.includes(trade)))
    .map((company) => ({
      company,
      distance_km: haversineKm(property, company),
      est_cost_eur: estimateCost(company, trade),
    }));
}

/** Score a manually selected company against the active candidates, even with a different trade. */
export function manualCandidate(property: Property, companies: Company[], candidates: MatchCandidate[], company: Company, trade: Trade | null) {
  const alternatives = companies.filter((c) => candidates.some(({ company_id }) => company_id === c.id));
  const options = optionsFor(property, [...alternatives, company], null);
  for (const option of options) {
    option.est_cost_eur = candidates.find(({ company_id }) => company_id === option.company.id)?.est_cost_eur
      ?? estimateCost(option.company, trade);
  }
  return rankOptions(options).find(({ company_id }) => company_id === company.id)!;
}

export type MatchResult = { candidates: MatchCandidate[]; pool: "partner" | "non_partner" | "none" };

/**
 * Candidates: active, does the trade, property within the company's service radius.
 * Partners first: if any partner qualifies only partners are ranked, otherwise non-partners.
 */
export function matchCompanies(property: Property, companies: Company[], trade: Trade): MatchResult {
  const eligible = optionsFor(property, companies, trade).filter((o) => o.distance_km <= o.company.service_radius_km);
  const partners = eligible.filter((o) => o.company.is_partner);
  if (partners.length) return { candidates: rankOptions(partners), pool: "partner" };
  if (eligible.length) return { candidates: rankOptions(eligible), pool: "non_partner" };
  return { candidates: [], pool: "none" };
}
