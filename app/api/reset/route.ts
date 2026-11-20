import { handle } from "@/lib/http";
import { reset } from "@/lib/store";

export const POST = handle(async () => ({ ok: true, ...(await reset()) }));
