import { connection } from "next/server";
import { findTicket } from "@/lib/flow";
import { handle, type IdContext } from "@/lib/http";
import { getState } from "@/lib/store";

export const GET = handle(async (_request: Request, { params }: IdContext) => {
  await connection();
  const { id } = await params;
  return findTicket(await getState(), id);
});
