import { connection } from "next/server";
import { companyView } from "@/lib/flow";
import { handle } from "@/lib/http";
import { getState } from "@/lib/store";

export const GET = handle(async () => {
  await connection();
  return (await getState()).companies.map(companyView);
});
