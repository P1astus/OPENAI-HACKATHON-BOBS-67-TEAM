import type { Person, Property, Unit } from "../types";
import type { State } from "./seed";

const contactFields = ["name", "phone", "email"] as const;
type ContactField = (typeof contactFields)[number];
export type PartnerPerson = Pick<Person, "id" | "role"> & Partial<Pick<Person, ContactField>>;
export type Bootstrap<P = Person> = { properties: Property[]; units: Unit[]; people: P[] };

export function bootstrapView(state: Pick<State, "properties" | "units" | "people" | "tickets">): Bootstrap;
export function bootstrapView(state: Pick<State, "properties" | "units" | "people" | "tickets">, companyId: string | undefined): Bootstrap<PartnerPerson>;
export function bootstrapView({ properties, units, people, tickets }: Pick<State, "properties" | "units" | "people" | "tickets">, companyId?: string) {
  if (companyId === undefined) return { properties, units, people };

  const unitIds = new Set<string>();
  const sharedAccess = new Set<string>();
  const tenantScopes = new Map<string, Set<string>>();
  for (const ticket of tickets) {
    if (ticket.company_id !== companyId) continue;
    unitIds.add(ticket.unit_id);
    if (!ticket.consent) continue;
    const scopes = tenantScopes.get(ticket.tenant_id) ?? new Set<string>();
    for (const field of ticket.consent.data_shared) scopes.add(field);
    tenantScopes.set(ticket.tenant_id, scopes);
    if (ticket.consent.data_shared.includes("access_notes")) sharedAccess.add(ticket.unit_id);
  }

  const companyUnits = units.filter(({ id }) => unitIds.has(id))
    .map((unit) => ({ ...unit, access_notes: sharedAccess.has(unit.id) ? unit.access_notes : "" }));
  const propertyIds = new Set(companyUnits.map(({ property_id }) => property_id));
  const companyPeople = people.flatMap((person) => {
    const scopes = tenantScopes.get(person.id);
    if (person.role !== "tenant" || !scopes) return [];
    const shared: PartnerPerson = { id: person.id, role: person.role };
    for (const field of contactFields) {
      if (scopes.has(field)) shared[field] = person[field];
    }
    return [shared];
  });
  return { properties: properties.filter(({ id }) => propertyIds.has(id)), units: companyUnits, people: companyPeople };
}
