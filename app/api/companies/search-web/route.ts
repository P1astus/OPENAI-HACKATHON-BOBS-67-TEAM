import { searchCompaniesOnWeb } from "@/lib/agent/search-web";
import { handle, parseBody } from "@/lib/http";
import { searchWebBody } from "@/lib/schemas";

export const maxDuration = 30;

export const POST = handle(async (request: Request) => searchCompaniesOnWeb(await parseBody(request, searchWebBody)));
