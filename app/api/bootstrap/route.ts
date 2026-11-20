import { connection } from "next/server";
import { handle } from "@/lib/http";
import { getState } from "@/lib/store";

export const GET = handle(async () => {
  await connection();
  const { properties, units, people } = await getState();
  return { properties, units, people };
});
