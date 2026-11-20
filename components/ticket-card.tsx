import { CalendarDays } from "lucide-react";
import type { ReactNode } from "react";
import type { Company, Ticket, Unit } from "@/types";
import { formatDateTime } from "./format";
import { Money } from "./money";
import { PartnerPill } from "./partner-pill";
import { StatusPill } from "./status-pill";

export function TicketCard({
  ticket,
  company,
  unit,
  actions,
}: {
  ticket: Ticket;
  company?: Company | null;
  unit?: Unit | null;
  actions?: ReactNode;
}) {
  return (
    <article className="shadow-soft space-y-3 rounded-[14px] bg-card p-4 text-card-foreground sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-sm font-medium wrap-anywhere text-muted-foreground">{unit?.label ?? ticket.unit_id}</p>
        <StatusPill status={ticket.status} />
      </div>
      <p className="text-base font-semibold wrap-anywhere">{ticket.triage?.summary ?? ticket.claim}</p>
      {company && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span>{company.name}</span>
          <PartnerPill isPartner={company.is_partner} />
        </div>
      )}
      {ticket.est_cost_eur !== null && (
        <p className="text-sm text-muted-foreground">
          Estimated cost <Money value={ticket.est_cost_eur} className="font-semibold text-card-foreground tabular-nums" />
        </p>
      )}
      {ticket.appointment_at && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays aria-hidden="true" className="size-4 shrink-0" />
          <span className="sr-only">Appointment </span>
          <time dateTime={ticket.appointment_at}>{formatDateTime(ticket.appointment_at)}</time>
        </p>
      )}
      {actions != null && <div className="flex flex-wrap items-center gap-2 pt-1">{actions}</div>}
    </article>
  );
}
