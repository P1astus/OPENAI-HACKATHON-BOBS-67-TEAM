import { approveTicket } from "@/lib/flow";
import { handle, parseBody, type IdContext } from "@/lib/http";
import { approveBody } from "@/lib/schemas";

export const maxDuration = 30;

export const POST = handle(async (request: Request, { params }: IdContext) => {
  const { approved } = await parseBody(request, approveBody);
  return approveTicket((await params).id, approved);
});
