import type { TicketEvent } from "@/types";
import { formatDateTime } from "./format";

const actors = {
  agent: { label: "Agent", dot: "bg-primary" },
  tenant: { label: "Tenant", dot: "bg-muted-foreground" },
  company: { label: "Company", dot: "bg-success" },
  owner: { label: "Owner", dot: "bg-warning" },
  admin: { label: "Admin", dot: "bg-[#817691] dark:bg-[#aa9cb7]" },
} satisfies Record<TicketEvent["actor"], { label: string; dot: string }>;

export function Timeline({ events }: { events: TicketEvent[] }) {
  const orderedEvents = [...events].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  return (
    <ol className="shadow-soft rounded-[14px] bg-card p-4 text-card-foreground">
      {orderedEvents.map(({ at, actor, type, message }, index) => (
        <li
          key={`${at}-${actor}-${type}-${index}`}
          className="relative ps-5 pb-4 before:absolute before:inset-s-[3px] before:top-2 before:-bottom-2 before:border-s before:border-muted-foreground/25 last:pb-0 last:before:hidden"
        >
          <span aria-hidden="true" className={`absolute inset-s-0 top-2 size-2 rounded-full ${actors[actor].dot}`} />
          <p className="text-sm font-medium">{message}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            <time dateTime={at}>{formatDateTime(at)}</time> · {actors[actor].label}
          </p>
        </li>
      ))}
    </ol>
  );
}
