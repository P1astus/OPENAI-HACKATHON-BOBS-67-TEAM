"use client";

import { ChevronRight, LoaderCircle, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { TenantContactCard } from "@/components/contact-card";
import {
  EmptyState, ErrorBlock, GroupedList, GroupedRow, LoadingBlock, Money,
  PartnerPill, RatingMeter, StatusPill, TicketCard, Timeline, formatDateTime,
} from "@/components/index";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { approveTicket, assignTicket, type CompanyView } from "@/lib/api-client";
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
            {(data.status === "needs_human" || data.status === "emergency") && (
              <CompanyChoices ticket={data} companies={companies.data}
                tenantName={tenant?.name.trim().split(/\s+/)[0] || "The tenant"} />
            )}
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

function CompanyChoices({ ticket, companies, tenantName }: {
  ticket: Ticket;
  companies: CompanyView[];
  tenantName: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const headingId = useId();
  const listId = useId();
  const promptId = useId();
  const candidates = showAll ? ticket.candidates : ticket.candidates.slice(0, 4);

  async function assign(company: CompanyView) {
    setPendingId(company.id);
    try {
      await assignTicket(ticket.id, company.id);
      await refreshAll();
      setConfirmId(null);
      toast.success(`${company.name} assigned. ${tenantName} will get times to pick.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t assign the company.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <div className="space-y-1">
        <h3 id={headingId} className="section-label font-medium">Problem cleared up? Choose a company</h3>
        <p className="text-sm text-muted-foreground">Pick who should fix it. We&apos;ll offer the tenant times right away.</p>
      </div>
      {candidates.length === 0 ? (
        <EmptyState title="No suggested companies. reltix will assign one." />
      ) : (
        <ol id={listId} className="space-y-2">
          {candidates.map((candidate, index) => {
            const company = companies.find(({ id }) => id === candidate.company_id);
            const name = company?.name ?? candidate.company_id;
            const best = index === 0;
            const confirming = confirmId === candidate.company_id;
            const assigning = pendingId === candidate.company_id;

            return (
              <li key={candidate.company_id} className="shadow-soft flex flex-wrap items-center gap-3 rounded-[14px] border bg-card p-3 text-card-foreground">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="font-semibold wrap-anywhere">{name}</p>
                    {company && <PartnerPill isPartner={company.is_partner} />}
                    {best && <Badge variant="secondary" className="bg-primary/10">Best match</Badge>}
                  </div>
                  {company && <RatingMeter rating={company.rating} size="sm" />}
                  <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-muted-foreground tabular-nums">
                    <span>{candidate.distance_km.toFixed(1)} km</span>
                    <span><Money value={candidate.est_cost_eur} className="font-medium text-card-foreground" /> estimated</span>
                  </p>
                </div>
                <div className={confirming ? "flex w-full flex-wrap items-center gap-2 border-t pt-3" : "shrink-0"}>
                  {confirming && (
                    <p id={promptId} className="w-full text-sm wrap-anywhere">
                      Assign {name}? The tenant gets times to choose from.
                    </p>
                  )}
                  <Button type="button" variant={best ? "default" : "secondary"}
                    className={best ? "min-h-11 px-4 dark:text-black dark:hover:bg-primary" : "min-h-11 px-4"}
                    ref={confirming ? confirmButton : undefined}
                    aria-label={`${assigning ? "Assigning" : "Assign"} ${name}`}
                    aria-describedby={confirming ? promptId : undefined}
                    disabled={pendingId !== null || company?.status !== "active"}
                    onClick={() => {
                      if (!company) return;
                      if (confirming) void assign(company);
                      else setConfirmId(company.id);
                    }}>
                    {assigning && <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />}
                    {assigning ? "Assigning…" : "Assign"}
                  </Button>
                  {confirming && (
                    <Button type="button" variant="ghost" className="min-h-11 px-4" disabled={pendingId !== null}
                      onClick={() => {
                        confirmButton.current?.focus();
                        setConfirmId(null);
                      }}>
                      Cancel
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {ticket.candidates.length > 4 && !showAll && (
        <Button type="button" variant="secondary" className="min-h-11 px-4" aria-controls={listId}
          disabled={pendingId !== null} onClick={() => setShowAll(true)}>
          Show all ({ticket.candidates.length})
        </Button>
      )}
    </section>
  );
}
