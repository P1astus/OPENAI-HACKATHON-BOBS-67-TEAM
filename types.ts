export type Trade =
  | "heating" | "plumbing" | "electrical" | "locksmith" | "appliances"
  | "windows_doors" | "pest_control" | "roofing" | "general";

export type Property = {
  id: string; address: string; postcode: string; city: string;
  lat: number; lng: number; building_year: number; heating: string;
};

export type Unit = {
  id: string; property_id: string; label: string;      // "2nd floor left"
  floor: number; size_sqm: number; owner_id: string; tenant_id: string | null;
  access_notes: string;                                  // "key with caretaker, Mr. Weber"
};

export type Person = {
  id: string; role: "tenant" | "owner"; name: string; email: string; phone: string;
};

export type Review = { ticket_id: string; rating: number; created_at: string };  // rating 1–10

export type Company = {
  id: string; name: string; is_partner: boolean; trades: Trade[];
  lat: number; lng: number; service_radius_km: number;
  hourly_rate_eur: number; callout_fee_eur: number;
  phone: string; email: string;
  booking: "calendar" | "website" | "phone";            // partners: always "calendar"
  calendar_slots: string[];                              // free slots (ISO), partners only
  reviews: Review[];
  status: "active" | "blacklisted";
};

export type RatingLabel = "new" | "good" | "neutral" | "bad";

export type CompanyRating = {
  score: number | null;      // -1..1, null while "new" (<5 reviews)
  label: RatingLabel;
  review_count: number;
  good_count: number;        // reviews > 5
  bad_count: number;         // reviews < 5
  above6_count: number;      // reviews > 6
  potential_partner: boolean;
};

export type TicketStatus =
  | "reported" | "needs_human" | "emergency" | "matched" | "awaiting_owner"
  | "scheduled" | "done" | "invoiced" | "paid";

export type Triage = {
  trade: Trade | null;
  urgency: "emergency" | "urgent" | "normal";
  confidence: number;        // 0..1
  summary: string;           // one line, for the company and the owner
  needs_human: boolean;
  reason: string;            // why it went to a human, or "" 
  source: "model" | "rules"; // "rules" = model failed or emergency keyword hit
};

export type Consent = {
  data_shared: string[];     // ["name", "phone", "address", "access_notes"]
  given_at: string;
  channel: "portal" | "voice" | "email";
};

export type TicketEvent = {
  at: string;
  actor: "tenant" | "owner" | "company" | "agent" | "admin";
  type: string;              // "reported", "triaged", "matched", "slots_proposed", "booked", ...
  message: string;           // shown in timelines
};

export type MatchCandidate = {
  company_id: string; match: number;                     // 0..1
  parts: { reviews: number; price: number; distance: number };
  distance_km: number; est_cost_eur: number;
};

export type Ticket = {
  id: string; unit_id: string; tenant_id: string; created_at: string;
  claim: string;                                         // tenant's own words
  triage: Triage | null;
  candidates: MatchCandidate[];                          // ranked, for the admin panel
  company_id: string | null;
  partner_type: "partner" | "non_partner" | null;
  est_cost_eur: number | null;
  owner_approval: "not_needed" | "pending" | "approved" | "rejected";
  proposed_slots: string[];
  appointment_at: string | null;
  consent: Consent | null;
  invoice_id: string | null;
  rating: number | null;                                 // tenant's 1–10 after the job
  status: TicketStatus;
  events: TicketEvent[];
};

export type Invoice = {
  id: string; ticket_id: string; company_id: string; unit_id: string; property_id: string;
  amount_eur: number;
  issued_at: string; due_at: string;                     // due = issued + 14 days
  payer: "owner" | "tenant";
  forwarded_at: string | null;
  status: "not_paid" | "paid";
  paid_at: string | null;
};
// "Overdue" is not stored: status === "not_paid" && now > due_at. The API adds `overdue: boolean` on reads.
