"use client";

import { ChevronRight, ClipboardList } from "lucide-react";
import { useRef, useState } from "react";
import {
  EmptyState, ErrorBlock, formatDateTime, GroupedList, LoadingBlock, Money, PartnerPill, StatusPill,
} from "@/components/index";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { refreshAll, useBootstrap, useCompanies, useTickets } from "@/lib/hooks";
import type { TicketStatus } from "@/types";
import { FilterChips } from "./filter-chips";
import { TicketSheet } from "./ticket-sheet";

const filters = [
  { value: "all", label: "All" },
  { value: "human", label: "Needs a person" },
  { value: "owner", label: "Waiting for owner" },
  { value: "scheduled", label: "Scheduled" },
  { value: "invoices", label: "Invoiced/Paid" },
] as const;

type Filter = typeof filters[number]["value"];

const filteredStatuses: Record<Exclude<Filter, "all">, TicketStatus[]> = {
  human: ["needs_human", "emergency"],
  owner: ["awaiting_owner"],
  scheduled: ["scheduled"],
  invoices: ["invoiced", "paid"],
};

const columns = ["Created", "Unit", "Claim", "Trade", "Company", "Partner type", "Est. cost", "Status"];

export function TicketsPanel() {
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const filterRow = useRef<HTMLDivElement>(null);
  const tickets = useTickets();
  const bootstrap = useBootstrap();
  const companies = useCompanies();

  const error = tickets.error ?? bootstrap.error ?? companies.error;
  const units = new Map(bootstrap.data?.units.map((unit) => [unit.id, unit.label]));
  const names = new Map(companies.data?.map((company) => [company.id, company.name]));
  const shown = tickets.data?.filter(({ status }) => filter === "all" || filteredStatuses[filter].includes(status));

  function openTicket(id: string, button: HTMLButtonElement | null) {
    trigger.current = button;
    setSelectedId(id);
  }

  function restoreFocus() {
    if (trigger.current?.getClientRects().length) {
      trigger.current.focus();
    } else {
      filterRow.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
    }
  }

  return (
    <div className="space-y-4">
      <div ref={filterRow}>
        <FilterChips label="Ticket status" options={filters} value={filter} onChange={setFilter} />
      </div>
      {error ? (
        <ErrorBlock message={error.message} onRetry={() => void refreshAll()} />
      ) : !shown || !bootstrap.data || !companies.data ? (
        <LoadingBlock lines={5} />
      ) : shown.length === 0 ? (
        <EmptyState icon={<ClipboardList />} title={filter === "all" ? "No tickets yet" : "No tickets match this filter"} />
      ) : (
        <>
          <div className="shadow-soft hidden overflow-hidden rounded-[14px] bg-card lg:block">
            <Table aria-label="Repair tickets" className="table-fixed text-sm">
              <colgroup>
                <col className="w-[12%]" />
                <col className="w-[11%]" />
                <col className="w-[22%]" />
                <col className="w-[10%]" />
                <col className="w-[14%]" />
                <col className="w-[10%]" />
                <col className="w-[8%]" />
                <col className="w-[13%]" />
              </colgroup>
              <TableHeader className="bg-muted/35">
                <TableRow className="hover:bg-transparent">
                  {columns.map((column) => (
                    <TableHead key={column} scope="col" className="h-12 text-muted-foreground first:pl-5">{column}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((ticket) => (
                  <TableRow
                    key={ticket.id}
                    className="cursor-pointer focus-within:bg-muted/40"
                    onClick={(event) => openTicket(ticket.id, event.currentTarget.querySelector("button"))}
                  >
                    <TableCell className="py-3 pl-5 whitespace-normal text-muted-foreground">
                      <time dateTime={ticket.created_at}>{formatDateTime(ticket.created_at)}</time>
                    </TableCell>
                    <TableCell className="whitespace-normal wrap-anywhere">{units.get(ticket.unit_id) ?? ticket.unit_id}</TableCell>
                    <TableCell className="py-1">
                      <button
                        type="button"
                        aria-haspopup="dialog"
                        className="block min-h-11 w-full cursor-pointer truncate rounded-md text-left font-medium hover:text-primary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                      >
                        {ticket.claim}
                      </button>
                    </TableCell>
                    <TableCell className="whitespace-normal capitalize">{ticket.triage?.trade?.replaceAll("_", " ") ?? "–"}</TableCell>
                    <TableCell className="whitespace-normal wrap-anywhere">{ticket.company_id ? names.get(ticket.company_id) ?? ticket.company_id : "–"}</TableCell>
                    <TableCell>{ticket.partner_type ? <PartnerPill isPartner={ticket.partner_type === "partner"} /> : "–"}</TableCell>
                    <TableCell>{ticket.est_cost_eur === null ? "–" : <Money value={ticket.est_cost_eur} />}</TableCell>
                    <TableCell><StatusPill status={ticket.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="lg:hidden">
            <GroupedList>
              {shown.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  aria-haspopup="dialog"
                  className="flex min-h-11 w-full cursor-pointer items-center gap-3 px-4 py-3 text-start hover:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                  onClick={(event) => openTicket(ticket.id, event.currentTarget)}
                >
                  <span className="grid min-w-0 flex-1 gap-1.5">
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <time dateTime={ticket.created_at}>{formatDateTime(ticket.created_at)}</time>
                      <span className="wrap-anywhere">{units.get(ticket.unit_id) ?? ticket.unit_id}</span>
                    </span>
                    <span className="line-clamp-2 font-medium">{ticket.claim}</span>
                    <span className="text-sm wrap-anywhere text-muted-foreground">
                      <span className="capitalize">{ticket.triage?.trade?.replaceAll("_", " ") ?? "–"}</span>
                      {" · "}{ticket.company_id ? names.get(ticket.company_id) ?? ticket.company_id : "–"}
                    </span>
                    <span className="flex flex-wrap items-center gap-2">
                      <StatusPill status={ticket.status} />
                      {ticket.partner_type ? <PartnerPill isPartner={ticket.partner_type === "partner"} /> : "–"}
                      {ticket.est_cost_eur === null ? "–" : <Money value={ticket.est_cost_eur} />}
                    </span>
                  </span>
                  <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </GroupedList>
          </div>
        </>
      )}
      <TicketSheet id={selectedId} onClose={() => setSelectedId(null)} restoreFocus={restoreFocus} />
    </div>
  );
}
