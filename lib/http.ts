import { unstable_rethrow } from "next/navigation";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { HttpError, badRequest } from "./errors";
import { formatZodError } from "./schemas";

export type IdContext = { params: Promise<{ id: string }> };

/** Wrap a handler: HttpError → its status, anything else → 500 with a generic message (details only in logs). */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<unknown>) {
  return async (...args: A): Promise<Response> => {
    try {
      return NextResponse.json(await fn(...args));
    } catch (error) {
      unstable_rethrow(error); // let Next's own control-flow signals (prerender bail-out) through
      if (error instanceof HttpError) return NextResponse.json({ error: error.message }, { status: error.status });
      console.error(JSON.stringify({ at: "api", error: error instanceof Error ? `${error.name}: ${error.message}` : String(error) }));
      return NextResponse.json({ error: "Something went wrong on our side. Try again." }, { status: 500 });
    }
  };
}

export async function parseBody<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S>> {
  let raw: unknown = {};
  const text = await request.text();
  if (text.trim()) {
    try { raw = JSON.parse(text); } catch { throw badRequest("The request body must be valid JSON"); }
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw badRequest(formatZodError(parsed.error));
  return parsed.data;
}

export function parseQuery<S extends z.ZodType>(request: Request, schema: S): z.infer<S> {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  for (const key of Object.keys(params)) if (params[key] === "") delete params[key];
  const parsed = schema.safeParse(params);
  if (!parsed.success) throw badRequest(formatZodError(parsed.error));
  return parsed.data;
}

/** Constant-time string comparison for the webhook secret. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
