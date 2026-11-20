import type { Invoice } from "@/types";
import { Badge } from "@/components/ui/badge";

export function InvoicePill({ invoice, label }: { invoice: Pick<Invoice, "status">; label?: string }) {
  const base = "h-auto rounded-full px-2.5 py-1 leading-tight";
  const paid = invoice.status === "paid";
  const tone = paid
    ? "bg-success/14 text-[#166534] dark:text-[#a0e6b0]"
    : "bg-muted text-[#626269] dark:text-muted-foreground";

  return (
    <Badge variant="secondary" className={`${base} ${tone}`}>
      {label ?? (paid ? "Paid" : "Not paid")}
    </Badge>
  );
}
