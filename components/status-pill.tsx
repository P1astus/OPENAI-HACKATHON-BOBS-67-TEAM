import type { TicketStatus } from "@/types";
import { Badge } from "@/components/ui/badge";

const tones = {
  grey: "bg-muted text-[#626269] dark:text-muted-foreground",
  blue: "bg-primary/12 text-[#0055ad] dark:text-[#91c5ff]",
  green: "bg-success/14 text-[#166534] dark:text-[#a0e6b0]",
  orange: "bg-warning/16 text-[#85400a] dark:text-[#ffd08b]",
  red: "bg-destructive/12 text-[#a51d18] dark:text-[#ffafa8]",
};

const statuses = {
  reported: { label: "Reported", tone: "grey" },
  needs_human: { label: "Needs a person", tone: "orange" },
  emergency: { label: "Emergency", tone: "red" },
  matched: { label: "Matched", tone: "grey" },
  awaiting_owner: { label: "Waiting for owner", tone: "orange" },
  scheduled: { label: "Scheduled", tone: "blue" },
  done: { label: "Done", tone: "green" },
  invoiced: { label: "Invoiced", tone: "grey" },
  paid: { label: "Paid", tone: "green" },
} satisfies Record<TicketStatus, { label: string; tone: keyof typeof tones }>;

export function StatusPill({ status }: { status: TicketStatus }) {
  const { label, tone } = statuses[status];

  return (
    <Badge variant="secondary" className={`h-auto rounded-full px-2.5 py-1 leading-tight ${tones[tone]}`}>
      {label}
    </Badge>
  );
}
