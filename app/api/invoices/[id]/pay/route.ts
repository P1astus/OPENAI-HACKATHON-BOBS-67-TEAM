import { payInvoice } from "@/lib/flow";
import { handle, type IdContext } from "@/lib/http";

export const POST = handle(async (_request: Request, { params }: IdContext) => payInvoice((await params).id));
