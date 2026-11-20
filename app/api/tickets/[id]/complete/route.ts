import { completeTicket } from "@/lib/flow";
import { handle, parseBody, type IdContext } from "@/lib/http";
import { completeBody } from "@/lib/schemas";

export const POST = handle(async (request: Request, { params }: IdContext) => {
  const { amount_eur } = await parseBody(request, completeBody);
  return completeTicket((await params).id, amount_eur);
});
