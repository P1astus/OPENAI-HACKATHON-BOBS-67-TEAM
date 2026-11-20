"use client";

import { CalendarDays, ChevronRight, ClipboardList, House, UserRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  ContactCard,
  EmptyState,
  ErrorBlock,
  formatSlot,
  GroupedList,
  GroupedRow,
  InvoicePill,
  LoadingBlock,
  Money,
  PageHeader,
  PartnerPill,
  RatingMeter,
  StatusPill,
  TicketCard,
  Timeline,
} from "@/components/index";
import { Button } from "@/components/ui/button";
import type { Company, CompanyRating, Consent, Invoice, Person, Property, Ticket, TicketStatus, Unit } from "@/types";

const property: Property = {
  id: "property-aachen",
  address: "Musterstraße 12",
  postcode: "52062",
  city: "Aachen",
  lat: 50.7753,
  lng: 6.0839,
  building_year: 1988,
  heating: "Gas central heating",
};

const tenant: Person = {
  id: "p_lena",
  role: "tenant",
  name: "Lena Hoffmann",
  phone: "+49 241 555 0101",
  email: "lena.hoffmann@example.com",
};

const owner: Person = {
  id: "p_maria",
  role: "owner",
  name: "Maria Becker",
  phone: "+49 241 555 0102",
  email: "maria.becker@example.com",
};

const unit: Unit = {
  id: "unit-12-2l",
  property_id: property.id,
  label: "2nd floor left",
  floor: 2,
  size_sqm: 68,
  owner_id: owner.id,
  tenant_id: tenant.id,
  access_notes: "Ring Hoffmann at the main entrance.",
};

const appointment = "2026-11-21T08:00:00Z";

const company: Company = {
  id: "c_warmhaus",
  name: "WarmHaus Heizungstechnik",
  is_partner: true,
  trades: ["heating"],
  lat: 50.7794,
  lng: 6.0951,
  service_radius_km: 25,
  hourly_rate_eur: 85,
  callout_fee_eur: 45,
  phone: "+49 241 555 0103",
  email: "service@warmhaus.example",
  booking: "calendar",
  calendar_slots: ["2026-11-23T13:00:00Z"],
  reviews: [],
  status: "active",
};

const consent: Consent = {
  data_shared: ["name", "phone", "email", "address", "access_notes"],
  given_at: "2026-11-21T07:30:00Z",
  channel: "portal",
};

const ticket: Ticket = {
  id: "ticket-heater",
  unit_id: unit.id,
  tenant_id: tenant.id,
  created_at: "2026-11-20T09:12:00Z",
  claim: "The radiators are cold even though the thermostat is on.",
  triage: {
    trade: "heating",
    urgency: "urgent",
    confidence: 0.96,
    summary: "Radiators stay cold when the thermostat calls for heat.",
    needs_human: false,
    reason: "",
    source: "model",
  },
  candidates: [{
    company_id: company.id,
    match: 0.91,
    parts: { reviews: 0.9, price: 0.9, distance: 0.95 },
    distance_km: 1.1,
    est_cost_eur: 325,
  }],
  company_id: company.id,
  partner_type: "partner",
  est_cost_eur: 325,
  owner_approval: "approved",
  proposed_slots: [appointment, ...company.calendar_slots],
  appointment_at: appointment,
  consent,
  invoice_id: null,
  rating: null,
  status: "scheduled",
  events: [
    { at: "2026-11-20T09:12:00Z", actor: "tenant", type: "reported", message: "Lena Hoffmann reported a heating problem." },
    { at: "2026-11-20T09:14:00Z", actor: "agent", type: "matched", message: "Matched WarmHaus Heizungstechnik to the repair." },
    { at: "2026-11-20T09:20:00Z", actor: "admin", type: "reviewed", message: "The property manager reviewed the repair estimate." },
    { at: "2026-11-20T09:47:00Z", actor: "owner", type: "approved", message: "Maria Becker approved the estimate." },
    { at: "2026-11-21T07:35:00Z", actor: "company", type: "booked", message: "WarmHaus confirmed the 09:00 appointment." },
  ],
};

const invoice: Invoice & { overdue: boolean } = {
  id: "invoice-heater",
  ticket_id: ticket.id,
  company_id: company.id,
  unit_id: unit.id,
  property_id: property.id,
  amount_eur: 317.5,
  issued_at: "2026-11-21T12:00:00Z",
  due_at: "2026-12-05T12:00:00Z",
  payer: "owner",
  forwarded_at: null,
  status: "not_paid",
  paid_at: null,
  overdue: false,
};

const statuses = [
  "reported", "needs_human", "emergency", "matched", "awaiting_owner",
  "scheduled", "done", "invoiced", "paid",
] satisfies TicketStatus[];

const ratings: CompanyRating[] = [
  { label: "good", score: 0.7, review_count: 12, good_count: 12, bad_count: 0, above6_count: 12, potential_partner: true },
  { label: "neutral", score: 0, review_count: 8, good_count: 4, bad_count: 4, above6_count: 2, potential_partner: false },
  { label: "bad", score: -0.55, review_count: 5, good_count: 0, bad_count: 5, above6_count: 0, potential_partner: false },
  { label: "new", score: null, review_count: 3, good_count: 2, bad_count: 0, above6_count: 2, potential_partner: false },
];

const heading = "section-label mb-2 px-4 font-medium";
const card = "shadow-soft rounded-[14px] bg-card p-4 text-card-foreground sm:p-5";
const action = "min-h-11 min-w-11 px-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export default function ComponentShowcase() {
  const [showAccess, setShowAccess] = useState(false);
  const [retrySucceeded, setRetrySucceeded] = useState(false);
  const slot = formatSlot(appointment);

  return (
    <div>
      <PageHeader
        title="Component showcase"
        subtitle={`Heater repair · ${property.address}, ${property.postcode} ${property.city}`}
        right={<PartnerPill isPartner={company.is_partner} />}
      />
      <main className="motion-safe:fade-in mx-auto grid w-full max-w-5xl gap-6 px-4 pb-12 sm:px-6 lg:grid-cols-2">
        <div className="min-w-0 space-y-6">
          <section aria-labelledby="repair">
            <h2 id="repair" className={heading}>Repair request</h2>
            <TicketCard
              ticket={ticket}
              company={company}
              unit={unit}
              actions={
                <Button asChild variant="secondary" className={action}>
                  <Link href="#history">View timeline <ChevronRight aria-hidden="true" /></Link>
                </Button>
              }
            />
          </section>

          <GroupedList title="Appointment" footer="Appointment times are shown in Europe/Berlin.">
            <GroupedRow icon={<CalendarDays size={18} />} title={slot.day} value={slot.time} />
            <GroupedRow icon={<UserRound size={18} />} title="Tenant" subtitle={tenant.name} href="#contact" chevron />
            <GroupedRow icon={<UserRound size={18} />} title="Owner" value={owner.name} />
            <GroupedRow
              icon={<House size={18} />}
              title={showAccess ? "Hide access notes" : "Show access notes"}
              onClick={() => setShowAccess(!showAccess)}
            />
            {showAccess && <GroupedRow title="Access notes">{unit.access_notes}</GroupedRow>}
          </GroupedList>

          <section id="contact" aria-labelledby="contact-title" className="scroll-mt-20">
            <h2 id="contact-title" className={heading}>Tenant contact</h2>
            <div className="space-y-3">
              <ContactCard {...tenant} consent={null} />
              <ContactCard {...tenant} consent={consent} />
            </div>
          </section>

          <section id="history" aria-labelledby="history-title" className="scroll-mt-20">
            <h2 id="history-title" className={heading}>Repair timeline</h2>
            <Timeline events={ticket.events} />
          </section>
        </div>

        <div className="min-w-0 space-y-6">
          <section aria-labelledby="statuses">
            <h2 id="statuses" className={heading}>Ticket statuses</h2>
            <div className={`${card} flex flex-wrap gap-2`}>
              {statuses.map((status) => <StatusPill key={status} status={status} />)}
            </div>
          </section>

          <section aria-labelledby="invoices">
            <h2 id="invoices" className={heading}>Invoice states</h2>
            <div className={`${card} space-y-3`}>
              <p className="font-semibold">Heater repair invoice <Money value={invoice.amount_eur} className="ms-2 tabular-nums" /></p>
              <div className="flex flex-wrap gap-2">
                <InvoicePill invoice={invoice} />
                <InvoicePill invoice={{ ...invoice, overdue: true }} />
                <InvoicePill invoice={{ ...invoice, status: "paid", paid_at: "2026-11-26T10:00:00Z" }} />
              </div>
            </div>
          </section>

          <section aria-labelledby="ratings">
            <h2 id="ratings" className={heading}>Company ratings</h2>
            <GroupedList>
              {ratings.map((rating, index) => (
                <div key={rating.label} className="px-4 py-3 sm:px-5">
                  <RatingMeter rating={rating} size={index === 0 ? "lg" : "sm"} />
                </div>
              ))}
            </GroupedList>
          </section>

          <section aria-labelledby="partners">
            <h2 id="partners" className={heading}>Partner statuses</h2>
            <div className={`${card} flex flex-wrap gap-2`}>
              <PartnerPill isPartner />
              <PartnerPill isPartner={false} />
            </div>
          </section>

          <section aria-labelledby="feedback">
            <h2 id="feedback" className={heading}>Loading, error and empty states</h2>
            <div className="space-y-3">
              <LoadingBlock lines={3} />
              {retrySucceeded ? (
                <p className={`${card} text-sm`} role="status">Repair history restored.</p>
              ) : (
                <ErrorBlock message="Couldn’t load repair history." onRetry={() => setRetrySucceeded(true)} />
              )}
              <EmptyState
                icon={<ClipboardList aria-hidden="true" className="size-5" />}
                title="No other repairs"
                description="New repair requests for this unit will appear here."
                action={<Button asChild variant="secondary" className={action}><Link href="/">Back to home</Link></Button>}
              />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
