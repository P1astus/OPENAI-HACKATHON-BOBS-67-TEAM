import { acceptTicket } from "@/lib/flow";
import { handle, type IdContext } from "@/lib/http";

export const POST = handle(async (_request: Request, { params }: IdContext) => acceptTicket((await params).id));
