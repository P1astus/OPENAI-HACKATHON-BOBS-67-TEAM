/**
 * npm run check:data — validates data/*.json (shapes + references).
 * With no data files yet, validates the built-in seed instead so the check is still meaningful.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { SEED_FILES, builtinSeed, type State } from "../lib/seed";
import { seedSchemas } from "../lib/schemas";

const dir = path.join(process.cwd(), "data");
const errors: string[] = [];
const present = SEED_FILES.filter((f) => existsSync(path.join(dir, `${f}.json`)));

let state: State;
if (present.length === 0) {
  console.log("No data/*.json files yet: checking the built-in seed (lib/seed.ts).");
  state = builtinSeed();
} else {
  const missing = SEED_FILES.filter((f) => !present.includes(f));
  if (missing.length) errors.push(`Missing files: ${missing.map((f) => `data/${f}.json`).join(", ")}. The app uses data/ only when all six exist.`);
  const loaded: Partial<State> = {};
  for (const name of present) {
    const file = `data/${name}.json`;
    let raw: unknown;
    try { raw = JSON.parse(readFileSync(path.join(dir, `${name}.json`), "utf8")); }
    catch (e) { errors.push(`${file}: not valid JSON (${(e as Error).message})`); continue; }
    const parsed = seedSchemas[name].safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) errors.push(`${file} [${issue.path.join(".")}]: ${issue.message}`);
      continue;
    }
    (loaded as Record<string, unknown>)[name] = parsed.data;
  }
  state = { properties: [], units: [], people: [], companies: [], tickets: [], invoices: [], ...loaded };
}

// ---------- references ----------
const ids = (xs: { id: string }[]) => new Set(xs.map((x) => x.id));
const P = ids(state.properties), U = ids(state.units), C = ids(state.companies), T = ids(state.tickets), I = ids(state.invoices);
const people = new Map(state.people.map((p) => [p.id, p]));
const check = (ok: boolean, msg: string) => { if (!ok) errors.push(msg); };

for (const [name, list] of Object.entries(state) as [string, { id: string }[]][]) {
  const seen = new Set<string>();
  for (const x of list) { check(!seen.has(x.id), `${name}: duplicate id ${x.id}`); seen.add(x.id); }
}
for (const u of state.units) {
  check(P.has(u.property_id), `units ${u.id}: property_id ${u.property_id} doesn't exist`);
  check(people.get(u.owner_id)?.role === "owner", `units ${u.id}: owner_id ${u.owner_id} isn't an owner in people`);
  check(u.tenant_id === null || people.get(u.tenant_id)?.role === "tenant", `units ${u.id}: tenant_id ${u.tenant_id} isn't a tenant in people`);
}
for (const c of state.companies) {
  check(!c.is_partner || c.booking === "calendar", `companies ${c.id}: partners must have booking "calendar"`);
  check(c.is_partner || c.calendar_slots.length === 0, `companies ${c.id}: only partners have calendar_slots`);
}
const unitById = new Map(state.units.map((u) => [u.id, u]));
for (const t of state.tickets) {
  const u = unitById.get(t.unit_id);
  check(Boolean(u), `tickets ${t.id}: unit_id ${t.unit_id} doesn't exist`);
  check(people.get(t.tenant_id)?.role === "tenant", `tickets ${t.id}: tenant_id ${t.tenant_id} isn't a tenant`);
  check(t.company_id === null || C.has(t.company_id), `tickets ${t.id}: company_id ${t.company_id} doesn't exist`);
  check(t.invoice_id === null || I.has(t.invoice_id), `tickets ${t.id}: invoice_id ${t.invoice_id} doesn't exist`);
  for (const c of t.candidates) check(C.has(c.company_id), `tickets ${t.id}: candidate ${c.company_id} doesn't exist`);
  check(["scheduled", "done", "invoiced", "paid"].includes(t.status) ? t.appointment_at !== null && t.consent !== null : true,
    `tickets ${t.id}: status ${t.status} needs appointment_at and consent`);
}
for (const i of state.invoices) {
  check(T.has(i.ticket_id), `invoices ${i.id}: ticket_id ${i.ticket_id} doesn't exist`);
  check(C.has(i.company_id), `invoices ${i.id}: company_id ${i.company_id} doesn't exist`);
  check(U.has(i.unit_id), `invoices ${i.id}: unit_id ${i.unit_id} doesn't exist`);
  check(P.has(i.property_id), `invoices ${i.id}: property_id ${i.property_id} doesn't exist`);
  check(unitById.get(i.unit_id)?.property_id === i.property_id, `invoices ${i.id}: unit ${i.unit_id} isn't in property ${i.property_id}`);
  check(i.status === "paid" ? i.paid_at !== null : i.paid_at === null, `invoices ${i.id}: paid_at must be set exactly when status is "paid"`);
}

const counts = SEED_FILES.map((f) => `${state[f].length} ${f}`).join(", ");
if (errors.length) {
  console.error(`✗ ${errors.length} problem(s):\n` + errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log(`✓ Data OK: ${counts}.`);
