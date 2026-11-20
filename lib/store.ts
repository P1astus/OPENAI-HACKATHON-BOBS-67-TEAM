import { Redis } from "@upstash/redis";
import { loadSeed, type State } from "./seed";

export type { State } from "./seed";

/**
 * Whole-app state in one place.
 * - UPSTASH_REDIS_REST_URL set: one Redis key holding the full state as JSON (needed on Vercel,
 *   where serverless instances don't share memory).
 * - Otherwise: a module-level copy in memory (local dev).
 * Read-modify-write per request; fine at demo scale.
 */
const KEY = "centrix:state";
const REDIS_TIMEOUT_MS = 5_000;

let redis: Redis | null | undefined;
function client(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  redis = url && token
    ? new Redis({ url, token, automaticDeserialization: true, signal: () => AbortSignal.timeout(REDIS_TIMEOUT_MS) })
    : null;
  return redis;
}

export const storeKind = () => (client() ? "redis" : "memory");

let memory: State | null = null;

export async function getState(): Promise<State> {
  const r = client();
  if (!r) {
    memory ??= (await loadSeed()).state;
    return structuredClone(memory);
  }
  const stored = await r.get<State>(KEY);
  if (stored) return stored;
  const { state } = await loadSeed();
  await r.set(KEY, state);
  return state;
}

async function save(state: State): Promise<void> {
  const r = client();
  if (r) await r.set(KEY, state);
  else memory = structuredClone(state);
}

/** Load, apply `fn`, save, return the new state. If `fn` throws, nothing is saved. */
export async function mutate<T>(fn: (s: State) => T | Promise<T>): Promise<{ state: State; result: T }> {
  const state = await getState();
  const result = await fn(state);
  await save(state);
  return { state, result };
}

/** Copy the seed back in. */
export async function reset(): Promise<{ source: "data" | "builtin" }> {
  const { state, source } = await loadSeed();
  await save(state);
  return { source };
}
