"use client";

import { CalendarDays, ChevronDown, LoaderCircle } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import {
  ContactCard, EmptyState, formatDate, formatSlot, GroupedRow,
  InvoicePill, Money, StatusPill, Timeline,
} from "@/components/index";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { payInvoice, rateTicket, type CompanyView } from "@/lib/api-client";
import { refreshAll } from "@/lib/hooks";
import type { Invoice, Ticket } from "@/types";

export function Appointment({ ticket, company }: { ticket: Ticket & { appointment_at: string }; company?: CompanyView }) {
  const { day, time } = formatSlot(ticket.appointment_at);

  return (
    <article className="space-y-3 p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <CalendarDays className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground wrap-anywhere">{ticket.triage?.summary || ticket.claim}</p>
          <time dateTime={ticket.appointment_at} className="text-xl font-semibold tracking-tight">{day} · {time}</time>
        </div>
      </div>
      {company ? (
        <div className="rounded-[14px] border border-border">
          <ContactCard name={company.name} phone={company.phone} email={company.email} consent={ticket.consent} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Company contact details are unavailable.</p>
      )}
      <details className="group rounded-xl bg-background">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-xl px-3 text-sm font-medium focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
          Progress
          <ChevronDown className="size-4 text-muted-foreground group-open:rotate-180" aria-hidden="true" />
        </summary>
        {ticket.events.length > 0 ? <Timeline events={ticket.events} /> : <EmptyState title="No progress updates yet" />}
      </details>
    </article>
  );
}

export function isCallingCompany(ticket: Ticket) {
  if (ticket.status !== "matched" || ticket.proposed_slots.length > 0) return false;
  const latest = ticket.events.findLast(({ type }) =>
    type === "matched" || type === "calling_company" || type === "call_started" || type === "slots_proposed");
  return latest?.type === "calling_company" || latest?.type === "call_started";
}

export function RequestRow({ ticket, company, onPickTime }: {
  ticket: Ticket;
  company?: CompanyView;
  onPickTime: (trigger: HTMLButtonElement) => void;
}) {
  const bookable = ticket.status === "matched" && !ticket.appointment_at && ticket.proposed_slots.length > 0;
  const update = isCallingCompany(ticket)
    ? `Calling ${company?.name ?? "the company"} for times…`
    : ticket.owner_approval === "rejected" ? "Your landlord declined the estimate" : null;

  return (
    <div>
      <GroupedRow
        title={ticket.triage?.summary || ticket.claim}
        subtitle={update ?? <time dateTime={ticket.created_at}>{formatDate(ticket.created_at)}</time>}
        value={<StatusPill status={ticket.status} />}
        onClick={bookable ? undefined : (event) => onPickTime(event.currentTarget)}
        chevron={!bookable}
      />
      {bookable && (
        <div className="px-4 pb-3">
          <Button
            type="button"
            variant="secondary"
            className="min-h-11 rounded-full px-4"
            onClick={(event) => onPickTime(event.currentTarget)}
          >
            <CalendarDays aria-hidden="true" /> Pick a time
          </Button>
        </div>
      )}
    </div>
  );
}

export function FinishedRepair({ ticket, company }: { ticket: Ticket; company?: CompanyView }) {
  const [rating, setRating] = useState(5);
  const [busy, setBusy] = useState(false);
  const questionId = useId();
  const savedRating = ticket.rating;

  async function submitRating() {
    if (busy || savedRating !== null) return;
    setBusy(true);
    try {
      await rateTicket(ticket.id, rating);
      await refreshAll();
      toast.success("Thanks! Your rating helps other tenants.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article>
      <GroupedRow
        title={ticket.triage?.summary || ticket.claim}
        subtitle={company?.name}
        value={<StatusPill status={ticket.status} />}
      />
      {savedRating !== null ? (
        <p className="px-4 pb-3 text-sm font-medium">You rated {savedRating}/10</p>
      ) : (ticket.status === "invoiced" || ticket.status === "paid") && (
        <div className="mx-4 mb-4 space-y-2 rounded-xl bg-background p-4">
          <div className="flex items-center justify-between gap-3">
            <p id={questionId} className="text-sm font-medium">How happy are you with the repair?</p>
            <p className="shrink-0 text-2xl font-semibold tabular-nums">{rating}<span className="text-sm text-muted-foreground">/10</span></p>
          </div>
          <Slider
            ref={(element) => {
              element?.querySelector('[role="slider"]')?.setAttribute("aria-labelledby", questionId);
            }}
            className="min-h-11 [&_[data-slot=slider-thumb]]:size-5 [&_[data-slot=slider-thumb]]:after:-inset-3"
            min={1}
            max={10}
            step={1}
            value={[rating]}
            onValueChange={([value]) => setRating(value)}
            disabled={busy}
          />
          <Button type="button" variant="outline" onClick={submitRating} disabled={busy} className="min-h-11 w-full rounded-full">
            {busy && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
            {busy ? "Sending…" : "Send rating"}
          </Button>
        </div>
      )}
    </article>
  );
}

export function InvoiceRow({ invoice, company }: { invoice: Invoice; company?: CompanyView }) {
  const [busy, setBusy] = useState(false);

  async function pay() {
    if (busy || invoice.payer !== "tenant" || invoice.status !== "not_paid") return;
    setBusy(true);
    try {
      await payInvoice(invoice.id);
      await refreshAll();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="flex items-center justify-between gap-3 p-4">
      <div className="min-w-0 space-y-1.5">
        <p className="font-semibold"><Money value={invoice.amount_eur} /></p>
        <p className="text-sm text-muted-foreground wrap-anywhere">{company?.name ?? "Company unavailable"}</p>
        <InvoicePill invoice={invoice} />
      </div>
      {invoice.status === "not_paid" && (
        <Button type="button" onClick={pay} disabled={busy} className="min-h-11 min-w-11 rounded-full px-4">
          {busy && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
          {busy ? "Paying…" : "Pay"}
        </Button>
      )}
    </article>
  );
}
