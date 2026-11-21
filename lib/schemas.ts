import { z } from "zod";
import type {
  Company, Invoice, Person, Property, Ticket, Trade, Triage, Unit,
} from "../types";

// ---------- shared pieces ----------
export const TRADES = [
  "heating", "plumbing", "electrical", "locksmith", "appliances",
  "windows_doors", "pest_control", "roofing", "general",
] as const satisfies readonly Trade[];

export const tradeSchema = z.enum(TRADES);
const iso = z.iso.datetime({ offset: true });
const id = (prefix: string) => z.string().startsWith(prefix, `must start with "${prefix}"`);
const money = z.number().nonnegative().finite();

// ---------- request bodies (docs/contract.md, "API routes") ----------
export const createTicketBody = z.object({
  tenant_id: id("p_"),
  unit_id: id("unit_"),
  claim: z.string().trim().min(3, "Describe the problem in a few words").max(2000, "Keep the description under 2000 characters"),
});

export const assignBody = z.object({
  company_id: id("c_"),
  actor: z.enum(["owner", "admin"]).default("admin"),
});
export const clarifyBody = z.object({
  note: z.string().trim().min(5, "Describe what you found in at least 5 characters").max(1000, "Keep the note to 1000 characters"),
  actor: z.enum(["owner", "admin"]),
});

export const searchWebBody = z.object({
  trade: tradeSchema,
  postcode: z.string().trim().min(1).max(20),
  city: z.string().trim().min(1).max(100),
});

export const approveBody = z.object({ approved: z.boolean() });

export const CONSENT_FIELDS = ["name", "phone", "email", "address", "access_notes"] as const;
export const bookBody = z.object({
  slot: iso,
  consent: z.object({ data_shared: z.array(z.enum(CONSENT_FIELDS)).max(CONSENT_FIELDS.length) }),
});

export const completeBody = z.object({
  amount_eur: z.number().min(0.01).max(100_000).multipleOf(0.01, "Enter an amount with at most two decimal places"),
});

export const rateBody = z.object({
  rating: z.number().int("Rating must be a whole number").min(1).max(10),
});

export const voiceResultBody = z.object({
  ticket_id: id("t_"),
  company_id: id("c_"),
  attempt_id: z.uuid().optional(),
  slots: z.array(iso).max(10),
  summary: z.string().max(1000).default(""),
});

export const ticketQuery = z.object({
  tenant_id: z.string().optional(),
  owner_id: z.string().optional(),
  company_id: z.string().optional(),
  status: z.enum([
    "reported", "needs_human", "emergency", "matched", "awaiting_owner",
    "scheduled", "done", "invoiced", "paid",
  ]).optional(),
});

export const invoiceQuery = z.object({
  owner_id: z.string().optional(),
  tenant_id: z.string().optional(),
  company_id: z.string().optional(),
});

// ---------- seed file shapes (data/*.json) ----------
export const propertySchema = z.object({
  id: id("prop_"), address: z.string().min(1), postcode: z.string().min(1), city: z.string().min(1),
  lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180),
  building_year: z.number().int(), heating: z.string(),
}) satisfies z.ZodType<Property>;

export const unitSchema = z.object({
  id: id("unit_"), property_id: id("prop_"), label: z.string().min(1), floor: z.number().int(),
  size_sqm: z.number().positive(), owner_id: id("p_"), tenant_id: id("p_").nullable(), access_notes: z.string(),
}) satisfies z.ZodType<Unit>;

export const personSchema = z.object({
  id: id("p_"), role: z.enum(["tenant", "owner"]), name: z.string().min(1),
  email: z.string().min(3), phone: z.string().min(3),
}) satisfies z.ZodType<Person>;

export const reviewSchema = z.object({
  ticket_id: z.string().min(1), rating: z.number().int().min(1).max(10), created_at: iso,
});

export const companySchema = z.object({
  id: id("c_"), name: z.string().min(1), is_partner: z.boolean(), trades: z.array(tradeSchema).min(1),
  lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), service_radius_km: z.number().positive(),
  hourly_rate_eur: money, callout_fee_eur: money, phone: z.string().min(3), email: z.string().min(3),
  booking: z.enum(["calendar", "website", "phone"]), calendar_slots: z.array(iso),
  reviews: z.array(reviewSchema), status: z.enum(["active", "blacklisted"]),
}) satisfies z.ZodType<Company>;

export const triageSchema = z.object({
  trade: tradeSchema.nullable(), urgency: z.enum(["emergency", "urgent", "normal"]),
  confidence: z.number().min(0).max(1), summary: z.string(), needs_human: z.boolean(),
  reason: z.string(), source: z.enum(["model", "rules"]),
}) satisfies z.ZodType<Triage>;

export const ticketSchema = z.object({
  id: id("t_"), unit_id: id("unit_"), tenant_id: id("p_"), created_at: iso, claim: z.string(),
  triage: triageSchema.nullable(),
  candidates: z.array(z.object({
    company_id: id("c_"), match: z.number().min(0).max(1),
    parts: z.object({ reviews: z.number(), price: z.number(), distance: z.number() }),
    distance_km: z.number().nonnegative(), est_cost_eur: money,
  })),
  company_id: id("c_").nullable(), partner_type: z.enum(["partner", "non_partner"]).nullable(),
  est_cost_eur: money.nullable(),
  owner_approval: z.enum(["not_needed", "pending", "approved", "rejected"]),
  proposed_slots: z.array(iso), appointment_at: iso.nullable(),
  consent: z.object({
    data_shared: z.array(z.string()), given_at: iso, channel: z.enum(["portal", "voice", "email"]),
  }).nullable(),
  invoice_id: id("inv_").nullable(), rating: z.number().int().min(1).max(10).nullable(),
  status: ticketQuery.shape.status.unwrap(),
  events: z.array(z.object({
    at: iso, actor: z.enum(["tenant", "owner", "company", "agent", "admin"]),
    type: z.string().min(1), message: z.string(),
  })),
}) satisfies z.ZodType<Ticket>;

export const invoiceSchema = z.object({
  id: id("inv_"), ticket_id: id("t_"), company_id: id("c_"), unit_id: id("unit_"), property_id: id("prop_"),
  amount_eur: money, issued_at: iso, due_at: iso, payer: z.enum(["owner", "tenant"]),
  forwarded_at: iso.nullable(), status: z.enum(["not_paid", "paid"]), paid_at: iso.nullable(),
}) satisfies z.ZodType<Invoice>;

export const seedSchemas = {
  properties: z.array(propertySchema),
  units: z.array(unitSchema),
  people: z.array(personSchema),
  companies: z.array(companySchema),
  tickets: z.array(ticketSchema),
  invoices: z.array(invoiceSchema),
};

/** Turn a zod error into one readable line: "claim: Describe the problem…; rating: …". */
export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => (issue.path.length ? `${issue.path.join(".")}: ` : "") + issue.message)
    .join("; ");
}
