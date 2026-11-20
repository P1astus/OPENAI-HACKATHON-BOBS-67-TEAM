import { filterInvoices } from "@/lib/flow";
import { handle, parseQuery } from "@/lib/http";
import { invoiceQuery } from "@/lib/schemas";
import { getState } from "@/lib/store";

export const GET = handle(async (request: Request) => filterInvoices(await getState(), parseQuery(request, invoiceQuery)));
