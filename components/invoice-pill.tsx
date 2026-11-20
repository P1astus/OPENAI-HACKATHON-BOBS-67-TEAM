import type { Invoice } from "@/types";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "./format";

export function InvoicePill({ invoice }: { invoice: Invoice & { overdue: boolean } }) {
  const base = "h-auto rounded-full px-2.5 py-1 leading-tight";

  if (invoice.status === "paid") {
    return (
      <Badge variant="secondary" className={`${base} bg-success/14 text-[#166534] dark:text-[#a0e6b0]`}>
        Paid
      </Badge>
    );
  }

  const tone = invoice.overdue
    ? "bg-destructive/12 text-[#a51d18] dark:text-[#ffafa8]"
    : "bg-muted text-[#626269] dark:text-muted-foreground";

  return (
    <Badge variant="secondary" className={`${base} ${tone}`}>
      {invoice.overdue ? "Overdue" : "Not paid"} · due {formatDate(invoice.due_at)}
    </Badge>
  );
}
