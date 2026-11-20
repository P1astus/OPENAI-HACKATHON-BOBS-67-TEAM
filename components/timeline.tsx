import type { TicketEvent } from "@/types";
import { formatDateTime } from "./format";

const actors = {
  agent: "Agent",
  tenant: "Tenant",
  company: "Company",
  owner: "Owner",
  admin: "Property manager",
} satisfies Record<TicketEvent["actor"], string>;

const tones = {
  neutral: "bg-muted-foreground",
  progress: "bg-primary",
  attention: "bg-warning",
  emergency: "bg-destructive",
  success: "bg-success",
};

const types: Partial<Record<string, readonly [string, keyof typeof tones]>> = {
  reported: ["Reported", "neutral"],
  clarified: ["Problem clarified", "progress"],
  triaged: ["Triaged", "progress"],
  needs_human: ["Manager review", "attention"],
  emergency: ["Emergency", "emergency"],
  no_partner: ["No partner available", "attention"],
  matched: ["Company matched", "progress"],
  owner_approval_requested: ["Owner approval requested", "attention"],
  approved: ["Estimate approved", "success"],
  rejected: ["Estimate declined", "attention"],
  calling_company: ["Calling company", "progress"],
  call_started: ["Call started", "progress"],
  company_contacted: ["Calling company", "progress"],
  slots_proposed: ["Times offered", "progress"],
  booked: ["Appointment booked", "success"],
  accepted: ["Job accepted", "success"],
  invoiced: ["Invoice issued", "neutral"],
  paid_from_wallet: ["Paid from wallet", "success"],
  forwarded_to_tenant: ["Charged to tenant", "progress"],
  invoice_paid: ["Invoice paid", "success"],
  rated: ["Repair rated", "success"],
  company_removed: ["Company removed", "emergency"],
  potential_partner: ["Potential partner", "success"],
};

export function Timeline({ events }: { events: TicketEvent[] }) {
  const orderedEvents = [...events].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  return (
    <ol className="shadow-soft rounded-[14px] bg-card px-4 py-5 text-card-foreground sm:px-5">
      {orderedEvents.map(({ at, actor, type, message }, index) => {
        const [label, tone] = types[type] ?? ["Update", "neutral"];
        return (
          <li
            key={`${at}-${actor}-${type}-${index}`}
            className="relative ps-5 pb-5 before:absolute before:inset-s-[4px] before:top-2.5 before:-bottom-2.5 before:border-s before:border-muted-foreground/25 last:pb-0 last:before:hidden"
          >
            <span aria-hidden="true" className={`absolute inset-s-0 top-1.5 size-2.5 rounded-full ${tones[tone]}`} />
            <p className="text-sm font-semibold leading-5">{label}</p>
            <p className="mt-0.5 text-sm leading-relaxed wrap-anywhere">{message}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              <time dateTime={at}>{formatDateTime(at)}</time> · {actors[actor]}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
