import { createTicket, filterTickets } from "@/lib/flow";
import { handle, parseBody, parseQuery } from "@/lib/http";
import { createTicketBody, ticketQuery } from "@/lib/schemas";
import { getState } from "@/lib/store";

export const maxDuration = 30;

export const GET = handle(async (request: Request) => {
  const filter = parseQuery(request, ticketQuery);
  return filterTickets(await getState(), filter);
});

export const POST = handle(async (request: Request) => createTicket(await parseBody(request, createTicketBody)));
