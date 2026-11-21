import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Redis } from "@upstash/redis";
import { HttpError } from "./errors";
import { loadSeed, type State } from "./seed";
import { isUnscheduledMatch, lastCallEvent, sendToHuman, usesCalendar } from "./ticket-state";

export type { State } from "./seed";

/**
 * Whole-app state in one place.
 * - UPSTASH_REDIS_REST_URL set: one Redis key holding the full state as JSON (needed on Vercel,
 *   where serverless instances don't share memory).
 * - Otherwise: a module-level copy in memory (local dev).
 * Read-modify-write per request; fine at demo scale.
 */
const KEY = "centrix:state";
const LOCK_KEY = "centrix:lock";
const REDIS_TIMEOUT_MS = 5_000;
const LOCK_TTL_MS = 8_000;
const LOCK_WAIT_MS = 6_000;
const LOCK_RETRY_MS = 75;
const CALL_STALE_MS = 4 * 60_000;

function createClient(signal = () => AbortSignal.timeout(REDIS_TIMEOUT_MS)): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  try {
    return new Redis({ url, token, retry: { retries: 0 }, signal });
  } catch {
    throw unavailable();
  }
}

let redis: Redis | null | undefined;
const client = () => redis === undefined ? (redis = createClient()) : redis;
export const storeKind = () => (client() ? "redis" : "memory");

let memory: State | null = null;
let mutationQueue = Promise.resolve();

type WriteLock = { redis: Redis; token: string } | null;
const unavailable = () => new HttpError(503, "The repair store is busy. Please try again.");

async function runWithWriteLock<T>(fn: (lock: WriteLock) => Promise<T>): Promise<T> {
  if (!client()) return fn(null);
  const deadline = Date.now() + LOCK_WAIT_MS;
  let acquiring = true;
  const r = createClient(() => AbortSignal.timeout(acquiring
    ? Math.max(1, Math.min(REDIS_TIMEOUT_MS, deadline - Date.now()))
    : REDIS_TIMEOUT_MS));
  if (!r) throw unavailable();
  const token = randomUUID();
  const lock = { redis: r, token };
  try {
    while (Date.now() < deadline) {
      if (await r.set(LOCK_KEY, token, { nx: true, px: LOCK_TTL_MS })) {
        acquiring = false;
        return await fn(lock);
      }
      await delay(Math.max(0, Math.min(LOCK_RETRY_MS, deadline - Date.now())));
    }
    throw unavailable();
  } catch (error) {
    if (acquiring) throw unavailable();
    throw error;
  } finally {
    if (!acquiring) {
      // Compare and delete atomically so a slow writer cannot release a successor's lock.
      await r.eval("if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end",
        [LOCK_KEY], [token]).catch(() => {
        // The lease expires automatically if Redis cannot be reached.
      });
    }
  }
}

function withWriteLock<T>(fn: (lock: WriteLock) => Promise<T>): Promise<T> {
  const task = mutationQueue.then(() => runWithWriteLock(fn));
  mutationQueue = task.then(() => {}, () => {});
  return task;
}

function readMemory() {
  return memory && structuredClone(memory);
}

async function readLocked(lock: WriteLock): Promise<State | null> {
  if (!lock) return readMemory();
  // Read on the Redis primary so a writer in another instance sees the last committed state.
  return lock.redis.eval<[], State | null>("return redis.call('GET', KEYS[1])", [KEY], [])
    .catch(() => { throw unavailable(); });
}

async function save(state: State, lock: WriteLock): Promise<void> {
  if (!lock) {
    memory = structuredClone(state);
    return;
  }
  const saved = await lock.redis.eval(
    "if redis.call('GET', KEYS[1]) == ARGV[1] then redis.call('SET', KEYS[2], ARGV[2]); return 1 end",
    [LOCK_KEY, KEY], [lock.token, JSON.stringify(state)],
  ).catch(() => { throw unavailable(); });
  if (saved !== 1) throw unavailable();
  const reader = client();
  if (reader && lock.redis.readYourWritesSyncToken) {
    reader.readYourWritesSyncToken = lock.redis.readYourWritesSyncToken;
  }
}

async function loadLocked(lock: WriteLock): Promise<State> {
  const stored = await readLocked(lock);
  if (stored) return stored;
  const { state } = await loadSeed();
  await save(state, lock);
  return state;
}

export async function getState(): Promise<State> {
  const r = client();
  const stored = r ? await r.get<State>(KEY).catch(() => { throw unavailable(); }) : readMemory();
  return stored ?? withWriteLock(loadLocked);
}

function staleCalls(state: State, now = Date.now()) {
  return state.tickets.filter((ticket) => {
    if (!isUnscheduledMatch(ticket)) return false;
    const call = lastCallEvent(ticket);
    if (!call || !(Date.parse(call.at) < now - CALL_STALE_MS)) return false;
    const company = state.companies.find(({ id }) => id === ticket.company_id);
    return company && !usesCalendar(company);
  });
}

const expireCalls = (tickets: ReturnType<typeof staleCalls>) => {
  for (const ticket of tickets) {
    sendToHuman(ticket, "needs_human", "No times agreed by phone. A property manager takes over.");
  }
};

export async function getTicketState(): Promise<State> {
  const state = await getState();
  if (!staleCalls(state).length) return state;

  // The polling path only locks on a stale snapshot. Recheck under the lock before persisting.
  return withWriteLock(async (lock) => {
    const current = await loadLocked(lock);
    const expired = staleCalls(current);
    if (expired.length) {
      expireCalls(expired);
      await save(current, lock);
    }
    return current;
  });
}

/** Load, recover stale calls, then apply and save a mutation under the same lock. */
export async function mutate<T>(fn: (s: State) => T | Promise<T>): Promise<{ state: State; result: T }> {
  return withWriteLock(async (lock) => {
    const state = await loadLocked(lock);
    const expired = staleCalls(state);
    expireCalls(expired);
    const recovered = expired.length ? structuredClone(state) : null;
    let result: T;
    try {
      result = await fn(state);
    } catch (error) {
      if (recovered) await save(recovered, lock);
      throw error;
    }
    await save(state, lock);
    return { state, result };
  });
}

/** Copy the seed back in. */
export async function reset(): Promise<{ source: "data" | "builtin" }> {
  return withWriteLock(async (lock) => {
    const { state, source } = await loadSeed();
    await save(state, lock);
    return { source };
  });
}
