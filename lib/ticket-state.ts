import type { Company, Ticket, TicketEvent } from "../types";
import { nowIso } from "./time";

export const usesCalendar = (company: Pick<Company, "is_partner" | "booking">) =>
  company.is_partner && company.booking === "calendar";

export const isUnscheduledMatch = (ticket: Ticket) =>
  ticket.status === "matched" && ticket.proposed_slots.length === 0 && !ticket.appointment_at;

export function event(t: Ticket, actor: TicketEvent["actor"], type: string, message: string, at = nowIso()) {
  t.events.push({ at, actor, type, message });
}

export function sendToHuman(t: Ticket, status: "needs_human" | "emergency", reason: string) {
  t.status = status;
  if (t.triage) {
    t.triage.needs_human = true;
    t.triage.reason = t.triage.reason ? `${t.triage.reason} ${reason}`.trim() : reason;
  }
  event(t, "agent", status, reason);
}

export function lastCallEvent(ticket: Ticket) {
  for (let i = ticket.events.length - 1; i >= 0; i--) {
    const entry = ticket.events[i];
    if (entry.type === "matched") break;
    if (entry.type === "calling_company" || entry.type === "call_started") return entry;
  }
}
