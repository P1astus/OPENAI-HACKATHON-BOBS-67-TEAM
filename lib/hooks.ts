"use client";

import { useSearchParams } from "next/navigation";
import useSWR, { mutate } from "swr";
import {
  getBootstrap,
  getCompanies,
  getCompanyBalance,
  getInvoices,
  getTicket,
  getTickets,
  type ApiError,
  type Balance,
  type Bootstrap,
  type CompanyView,
  type InvoiceFilter,
  type InvoiceView,
  type TicketFilter,
} from "./api-client";
import type { Ticket } from "../types";

const polling = { refreshInterval: 2000 };

export function useBootstrap() {
  return useSWR<Bootstrap, ApiError>("/api/bootstrap", () => getBootstrap(), polling);
}

export function useTickets(filter: TicketFilter = {}) {
  return useSWR<Ticket[], ApiError, readonly [string, TicketFilter]>(
    ["/api/tickets", filter],
    ([, query]) => getTickets(query),
    polling,
  );
}

export function useTicket(id?: string | null) {
  return useSWR<Ticket, ApiError, readonly [string, string] | null>(
    id ? ["/api/tickets/detail", id] : null,
    ([, ticketId]) => getTicket(ticketId),
    polling,
  );
}

export function useInvoices(filter: InvoiceFilter = {}) {
  return useSWR<InvoiceView[], ApiError, readonly [string, InvoiceFilter]>(
    ["/api/invoices", filter],
    ([, query]) => getInvoices(query),
    polling,
  );
}

export function useCompanies() {
  return useSWR<CompanyView[], ApiError>("/api/companies", () => getCompanies(), polling);
}

export function useCompanyBalance(id?: string | null) {
  return useSWR<Balance, ApiError, readonly [string, string] | null>(
    id ? ["/api/companies/balance", id] : null,
    ([, companyId]) => getCompanyBalance(companyId),
    polling,
  );
}

export function refreshAll() {
  return mutate(() => true);
}

export function useViewer(defaultId: string): string {
  return useSearchParams()?.get("as") || defaultId;
}
