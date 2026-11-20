"use client";

import { CalendarDays, CircleCheck, CircleAlert, Wallet } from "lucide-react";
import { useRef, useState } from "react";
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader } from "@/components/index";
import { Badge } from "@/components/ui/badge";
import { useBootstrap, useCompanies, useTickets, useViewer } from "@/lib/hooks";
import type { TicketStatus } from "@/types";
import { OwnerInvoices } from "./owner-invoices";
import { OwnerTicket, OwnerTicketSheet } from "./owner-ticket";

const columns: { key: string; title: string; statuses: TicketStatus[]; icon: typeof CircleAlert; empty: string; tone: string }[] = [
  { key: "urgent", title: "Urgent", statuses: ["emergency", "needs_human", "awaiting_owner"], icon: CircleAlert, empty: "Nothing urgent", tone: "text-muted-foreground" },
  { key: "upcoming", title: "Upcoming", statuses: ["reported", "matched", "scheduled"], icon: CalendarDays, empty: "No upcoming repairs", tone: "text-primary" },
  { key: "done", title: "Done", statuses: ["done", "invoiced", "paid"], icon: CircleCheck, empty: "No completed repairs", tone: "text-muted-foreground" },
];

export function OwnerDashboard() {
  const viewer = useViewer("p_maria");
  const bootstrap = useBootstrap();
  const tickets = useTickets({ owner_id: viewer });
  const companies = useCompanies();
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);
  const lastOpenedTicket = useRef<string | null>(null);
  const companyList = companies.data;
  const owner = bootstrap.data?.people.find(({ id, role }) => id === viewer && role === "owner");
  const units = bootstrap.data?.units.filter(({ owner_id }) => owner_id === viewer);
  const openTicket = tickets.data?.find(({ id }) => id === openTicketId);
  const groups = columns.map((column) => {
    const matches = tickets.data?.filter(({ status }) => column.statuses.includes(status));
    return { ...column, tickets: column.key === "done" ? matches?.slice(0, 10) : matches };
  });
  const urgent = groups[0].tickets;
  const upcoming = groups[1].tickets;
  const error = bootstrap.error ?? tickets.error ?? companies.error;

  return (
    <>
      <PageHeader
        title="Your properties"
        subtitle={owner && units ? `${owner.name} · ${units.length} ${units.length === 1 ? "unit" : "units"}` : undefined}
        right={urgent && upcoming && owner && !tickets.error && (
          <>
            <Badge variant="secondary" className="h-auto rounded-full px-2.5 py-1 tabular-nums">{urgent.length} urgent</Badge>
            <Badge variant="secondary" className="h-auto rounded-full px-2.5 py-1 tabular-nums">{upcoming.length} upcoming</Badge>
          </>
        )}
      />
      <main key={viewer} className="fade-in mx-auto w-full max-w-7xl space-y-9 px-4 pb-12 sm:px-6">
        {bootstrap.data && !owner && !bootstrap.error
          ? <EmptyState title="Owner unavailable" description="No owner matches this viewer." />
          : (
            <>
              <div className="space-y-4">
                {owner && (
                  <a href="#invoices-heading" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-card px-4 text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring">
                    <Wallet aria-hidden="true" className="size-4" /> Wallet payments
                  </a>
                )}
                <div className="grid items-start gap-6 lg:grid-cols-3 lg:gap-4">
                  {groups.map(({ key, title, empty, icon: Icon, tone, tickets: items }) => (
                    <section key={key} aria-labelledby={`heading-${key}`} className="min-w-0 space-y-3">
                      <h2 id={`heading-${key}`} className="section-label flex items-center gap-2 px-1 font-medium">
                        <Icon aria-hidden="true" className={`size-4 ${tone}`} />{title}
                        {items && !tickets.error && <Badge variant="secondary" className="rounded-full normal-case tabular-nums">{items.length}</Badge>}
                      </h2>
                      {error ? <ErrorBlock message={error.message} onRetry={() => void Promise.all([bootstrap.mutate(), tickets.mutate(), companies.mutate()])} />
                        : !items || !units || !companyList ? <LoadingBlock />
                        : !items.length ? <EmptyState title={empty} />
                        : items.map((ticket) => (
                            <OwnerTicket key={ticket.id} ticket={ticket}
                              company={companyList.find(({ id }) => id === ticket.company_id)}
                              unit={units.find(({ id }) => id === ticket.unit_id)}
                              onOpen={() => {
                                lastOpenedTicket.current = ticket.id;
                                setOpenTicketId(ticket.id);
                              }} />
                          ))}
                    </section>
                  ))}
                </div>
              </div>
              <OwnerInvoices ownerId={viewer} units={units} companies={companyList} people={bootstrap.data?.people}
                lookupError={bootstrap.error ?? companies.error}
                retryLookups={() => Promise.all([bootstrap.mutate(), companies.mutate()])} />
              <OwnerTicketSheet ticketId={openTicket?.id ?? null}
                unit={units?.find(({ id }) => id === openTicket?.unit_id)}
                onClose={() => setOpenTicketId(null)}
                restoreFocus={() => document.getElementById(`owner-repair-${lastOpenedTicket.current}`)?.focus()} />
            </>
          )}
      </main>
    </>
  );
}
