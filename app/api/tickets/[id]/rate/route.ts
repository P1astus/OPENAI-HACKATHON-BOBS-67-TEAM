import { rateTicket } from "@/lib/flow";
import { handle, parseBody, type IdContext } from "@/lib/http";
import { rateBody } from "@/lib/schemas";

export const POST = handle(async (request: Request, { params }: IdContext) => {
  const { rating } = await parseBody(request, rateBody);
  return rateTicket((await params).id, rating);
});
