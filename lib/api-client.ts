import type { Company, CompanyRating, Invoice, Ticket, TicketStatus, Trade } from "../types";
import type { WebSearchResponse } from "./agent/search-web";
import type { Bootstrap, PartnerPerson } from "./bootstrap";

export type { WebSearchResponse, WebSearchResult } from "./agent/search-web";
export type { Bootstrap } from "./bootstrap";

export type InvoiceView = Invoice & { overdue: boolean };
export type CompanyView = Company & { rating: CompanyRating };

export type InvoiceFilter = { owner_id?: string; tenant_id?: string; company_id?: string };
export type TicketFilter = InvoiceFilter & { status?: TicketStatus };
export type CreateTicketInput = { tenant_id: string; unit_id: string; claim: string };

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

function withQuery(path: string, filter: InvoiceFilter | TicketFilter): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filter)) {
    if (value !== undefined) params.set(key, value);
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

type Mock = typeof import("./mock");

async function request<T>(
  path: string,
  runMock: (mock: Mock) => Promise<T>,
  { method = "GET", body, mockDelay = 300, timeoutMs = 15_000 }: {
    method?: "GET" | "POST"; body?: object; mockDelay?: number; timeoutMs?: number;
  } = {},
): Promise<T> {
  if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") {
    const mock = await import("./mock");
    await new Promise<void>((resolve) => setTimeout(resolve, mockDelay));
    return runMock(mock);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(path, {
      method,
      signal: controller.signal,
      ...(body === undefined ? {} : {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    });

    if (response.ok) return await response.json() as T;

    const payload: unknown = await response.json().catch(() => null);
    const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
      ? payload.error
      : `Something went wrong (${response.status})`;
    throw new ApiError(message, response.status);
  } catch (error) {
    if (controller.signal.aborted) throw new ApiError("The request timed out", 408);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function ticketPath(id: string) {
  return `/api/tickets/${encodeURIComponent(id)}`;
}

export function getBootstrap(): Promise<Bootstrap>;
export function getBootstrap(companyId: string | undefined): Promise<Bootstrap<PartnerPerson>>;
export async function getBootstrap(companyId?: string): Promise<Bootstrap<PartnerPerson>> {
  return request(withQuery("/api/bootstrap", { company_id: companyId }), (mock) => mock.getBootstrap(companyId));
}

export async function getTickets(filter: TicketFilter = {}): Promise<Ticket[]> {
  return request(withQuery("/api/tickets", filter), (mock) => mock.getTickets(filter));
}

export async function getTicket(id: string): Promise<Ticket> {
  return request(ticketPath(id), (mock) => mock.getTicket(id));
}

export async function createTicket(input: CreateTicketInput): Promise<Ticket> {
  return request("/api/tickets", (mock) => mock.createTicket(input), {
    method: "POST", body: input, mockDelay: 2500, timeoutMs: 35_000,
  });
}

export async function assignTicket(id: string, company_id: string, actor: "owner" | "admin" = "admin"): Promise<Ticket> {
  return request(`${ticketPath(id)}/assign`, (mock) => mock.assignTicket(id, company_id, actor), {
    method: "POST", body: { company_id, actor },
  });
}

export async function clarifyTicket(id: string, note: string, actor: "owner" | "admin"): Promise<Ticket> {
  return request(`${ticketPath(id)}/clarify`, (mock) => mock.clarifyTicket(id, note, actor), {
    method: "POST", body: { note, actor }, mockDelay: 1500, timeoutMs: 35_000,
  });
}

export async function searchCompaniesOnWeb(trade: Trade, postcode: string, city: string): Promise<WebSearchResponse> {
  return request("/api/companies/search-web", (mock) => mock.searchCompaniesOnWeb(trade, postcode, city), {
    method: "POST", body: { trade, postcode, city }, timeoutMs: 25_000,
  });
}

export async function approveTicket(id: string, approved: boolean): Promise<Ticket> {
  return request(`${ticketPath(id)}/approve`, (mock) => mock.approveTicket(id, approved), {
    method: "POST", body: { approved },
  });
}

export async function bookSlot(id: string, slot: string, data_shared: string[]): Promise<Ticket> {
  return request(`${ticketPath(id)}/book`, (mock) => mock.bookSlot(id, slot, data_shared), {
    method: "POST", body: { slot, consent: { data_shared } },
  });
}

export async function acceptTicket(id: string): Promise<Ticket> {
  return request(`${ticketPath(id)}/accept`, (mock) => mock.acceptTicket(id), { method: "POST" });
}

export async function completeTicket(id: string, amount_eur: number): Promise<{ ticket: Ticket; invoice: Invoice }> {
  return request(`${ticketPath(id)}/complete`, (mock) => mock.completeTicket(id, amount_eur), {
    method: "POST", body: { amount_eur },
  });
}

export async function rateTicket(id: string, rating: number): Promise<{ ticket: Ticket; company_rating: CompanyRating }> {
  return request(`${ticketPath(id)}/rate`, (mock) => mock.rateTicket(id, rating), {
    method: "POST", body: { rating },
  });
}

export async function getInvoices(filter: InvoiceFilter = {}): Promise<InvoiceView[]> {
  return request(withQuery("/api/invoices", filter), (mock) => mock.getInvoices(filter));
}

export async function forwardInvoice(id: string): Promise<Invoice> {
  return request(`/api/invoices/${encodeURIComponent(id)}/forward`, (mock) => mock.forwardInvoice(id), { method: "POST" });
}

export async function payInvoice(id: string): Promise<Invoice> {
  return request(`/api/invoices/${encodeURIComponent(id)}/pay`, (mock) => mock.payInvoice(id), { method: "POST" });
}

export async function getCompanies(): Promise<CompanyView[]> {
  return request("/api/companies", (mock) => mock.getCompanies());
}

export async function resetDemo(): Promise<{ ok: true }> {
  return request("/api/reset", (mock) => mock.resetMock(), { method: "POST" });
}
