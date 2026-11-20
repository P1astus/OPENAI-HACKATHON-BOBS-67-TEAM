import { bookSlot } from "@/lib/flow";
import { handle, parseBody, type IdContext } from "@/lib/http";
import { bookBody } from "@/lib/schemas";

export const POST = handle(async (request: Request, { params }: IdContext) => {
  const { slot, consent } = await parseBody(request, bookBody);
  return bookSlot((await params).id, slot, consent.data_shared);
});
