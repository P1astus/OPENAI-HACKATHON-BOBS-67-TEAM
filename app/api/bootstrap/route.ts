import { connection } from "next/server";
import { bootstrapView } from "@/lib/bootstrap";
import { handle } from "@/lib/http";
import { getState } from "@/lib/store";

export const GET = handle(async (request: Request) => {
  await connection();
  const companyId = new URL(request.url).searchParams.get("company_id") ?? undefined;
  return bootstrapView(await getState(), companyId);
});
