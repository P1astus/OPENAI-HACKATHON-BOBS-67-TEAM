import { clarifyTicket } from "@/lib/flow";
import { handle, parseBody, type IdContext } from "@/lib/http";
import { clarifyBody } from "@/lib/schemas";

export const maxDuration = 30;

export const POST = handle(async (request: Request, { params }: IdContext) => {
  const { note, actor } = await parseBody(request, clarifyBody);
  return clarifyTicket((await params).id, note, actor);
});
