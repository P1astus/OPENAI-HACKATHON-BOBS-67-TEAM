import { assignTicket } from "@/lib/flow";
import { handle, parseBody, type IdContext } from "@/lib/http";
import { assignBody } from "@/lib/schemas";

export const maxDuration = 30;

export const POST = handle(async (request: Request, { params }: IdContext) => {
  const { company_id } = await parseBody(request, assignBody);
  return assignTicket((await params).id, company_id);
});
