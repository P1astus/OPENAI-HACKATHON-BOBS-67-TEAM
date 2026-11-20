import { forwardInvoice } from "@/lib/flow";
import { handle, type IdContext } from "@/lib/http";

export const POST = handle(async (_request: Request, { params }: IdContext) => forwardInvoice((await params).id));
