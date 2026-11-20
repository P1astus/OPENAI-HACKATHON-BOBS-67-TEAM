"use client";

import { ChevronRight, LoaderCircle, X } from "lucide-react";
import { useState } from "react";
import { ClarifyRepair } from "@/components/clarify";
import { toast } from "sonner";
import { TenantContactCard } from "@/components/contact-card";
import {
  EmptyState, ErrorBlock, GroupedList, GroupedRow, LoadingBlock, Money,
  StatusPill, TicketCard, Timeline, formatDateTime,
} from "@/components/index";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { approveTicket } from "@/lib/api-client";
import { refreshAll, useBootstrap, useCompanies, useTicket } from "@/lib/hooks";
import type { Company, Ticket, Unit } from "@/types";

export function OwnerTicket({ ticket, company, unit, onOpen }: {
  ticket: Ticket;
  company?: Company;
  unit?: Unit;
  onOpen: () => void;
}) {
  const [pending, setPending] = useState<"approve" | "decline" | null>(null);
  const awaiting = ticket.status === "awaiting_owner" && ticket.owner_approval === "pending";
  const summary = ticket.triage?.summary ?? ticket.claim;

  async function decide(approved: boolean) {
    setPending(approved ? "approve" : "decline");
    try {
      await approveTicket(ticket.id, approved);
      await refreshAll();
      toast.success(approved ? "Repair approved" : "Estimate declined");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="relative isolate rounded-[14px] hover:ring-1 hover:ring-primary/25">
      <button id={`owner-repair-${ticket.id}`} type="button" aria-label={`View repair details: ${summary}`}
        aria-haspopup="dialog" onClick={onOpen}
        className="absolute inset-0 z-10 cursor-pointer rounded-[14px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" />
      <TicketCard ticket={ticket} company={company} unit={unit} actions={
        <div className="w-full space-y-2">
          {awaiting && (
            <>
              <p className="text-sm text-muted-foreground">Repairs over €300 need your approval.</p>
              <div className="relative z-20 flex flex-wrap gap-2">
                <Button className="min-h-11" disabled={pending !== null} onClick={() => void decide(true)}>
                  {pending === "approve" && <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />}
                  Approve{ticket.est_cost_eur !== null && <Money value={ticket.est_cost_eur} />}
                </Button>
                <Button variant="secondary" className="min-h-11" disabled={pending !== null} onClick={() => void decide(false)}>
                  {pending === "decline" && <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />}
                  Decline
                </Button>
              </div>
            </>
          )}
          {ticket.owner_approval === "rejected" && <p className="text-sm text-muted-foreground">Estimate declined</p>}
          <span aria-hidden="true" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary">
            View details <ChevronRight className="size-4" />
          </span>
        </div>
      } />
    </div>
  );
}

export function OwnerTicketSheet({ ticketId, unit, onClose, restoreFocus }: {
  ticketId: string | null;
  unit?: Unit;
  onClose: () => void;
  restoreFocus: () => void;
}) {
  return (
    <Sheet open={ticketId !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent showCloseButton={false} className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          restoreFocus();
        }}>
        <SheetHeader className="relative shrink-0 p-5 pr-16">
          <SheetTitle className="text-xl font-semibold">Repair details</SheetTitle>
          <SheetDescription>{unit?.label ?? "Property repair"}</SheetDescription>
          <SheetClose asChild>
            <Button type="button" variant="ghost" size="icon" className="absolute top-3 right-3 min-h-11 min-w-11">
              <X aria-hidden="true" /><span className="sr-only">Close</span>
            </Button>
          </SheetClose>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {ticketId && <TicketDetails key={ticketId} ticketId={ticketId} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function TicketDetails({ ticketId }: { ticketId: string }) {
  const ticket = useTicket(ticketId);
  const companies = useCompanies();
  const bootstrap = useBootstrap();
  const error = ticket.error ?? companies.error ?? bootstrap.error;
  const data = ticket.data;
  const company = companies.data?.find(({ id }) => id === data?.company_id);
  const unit = bootstrap.data?.units.find(({ id }) => id === data?.unit_id);
  const property = bootstrap.data?.properties.find(({ id }) => id === unit?.property_id);
  const tenant = bootstrap.data?.people.find(({ id }) => id === data?.tenant_id);
  const owner = bootstrap.data?.people.find(({ id }) => id === unit?.owner_id);

  return (
    <div className="space-y-5 px-5 pb-6">
      {error ? <ErrorBlock message={error.message} onRetry={() => void Promise.all([ticket.mutate(), companies.mutate(), bootstrap.mutate()])} />
        : !data || !companies.data || !bootstrap.data ? <LoadingBlock />
        : (
          <>
            {tenant && data.status !== "done" && data.status !== "invoiced" && data.status !== "paid" && (
              <TenantContactCard tenant={tenant} status={data.status} claim={data.claim}
                unitLabel={unit?.label ?? "your unit"} senderName={owner?.name ?? "Your landlord"} />
            )}
            <ClarifyRepair ticket={data} actor="owner" companies={companies.data} property={property}
              tenantName={tenant?.name.trim().split(/\s+/)[0] || "The tenant"} />
            <GroupedList>
              <GroupedRow title="Status" value={<span aria-live="polite"><StatusPill status={data.status} /></span>} />
              <GroupedRow title="Tenant’s report" subtitle={data.claim} />
              <GroupedRow title="Triage summary" subtitle={data.triage?.summary ?? "Triage pending"} />
              <GroupedRow title="Company" subtitle={company?.name ?? "Company not assigned"} />
              <GroupedRow title="Appointment" subtitle={data.appointment_at
                ? <time dateTime={data.appointment_at}>{formatDateTime(data.appointment_at)}</time>
                : "Not booked yet"} />
            </GroupedList>
            <section aria-labelledby="timeline-heading" className="space-y-2">
              <h3 id="timeline-heading" className="section-label font-medium">Timeline</h3>
              {data.events.length ? <Timeline events={data.events} /> : <EmptyState title="No activity yet" />}
            </section>
          </>
        )}
    </div>
  );
}
