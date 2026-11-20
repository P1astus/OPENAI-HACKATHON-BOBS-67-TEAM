"use client";

import { LoaderCircle, ReceiptText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState, ErrorBlock, InvoicePill, LoadingBlock, Money, formatDate } from "@/components/index";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { forwardInvoice, payInvoice, type InvoiceView } from "@/lib/api-client";
import { refreshAll, useInvoices } from "@/lib/hooks";
import type { Company, Unit } from "@/types";

type InvoiceAction = "pay" | "forward";

export function OwnerInvoices({ ownerId, units, companies, lookupError, retryLookups }: {
  ownerId: string;
  units?: Unit[];
  companies?: Company[];
  lookupError?: Error;
  retryLookups: () => Promise<unknown>;
}) {
  const invoices = useInvoices({ owner_id: ownerId });
  const [pending, setPending] = useState<Record<string, InvoiceAction | undefined>>({});
  const error = invoices.error ?? lookupError;

  async function act(id: string, action: InvoiceAction) {
    setPending((current) => ({ ...current, [id]: action }));
    try {
      await (action === "pay" ? payInvoice(id) : forwardInvoice(id));
      await refreshAll();
      toast.success(action === "pay" ? "Invoice paid" : "Invoice forwarded to the tenant");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setPending((current) => ({ ...current, [id]: undefined }));
    }
  }

  const rows = invoices.data?.map((invoice) => ({
    invoice,
    unit: units?.find(({ id }) => id === invoice.unit_id)?.label ?? "Unit unavailable",
    company: companies?.find(({ id }) => id === invoice.company_id)?.name ?? "Company unavailable",
  }));

  function renderActions(invoice: InvoiceView) {
    if (invoice.status === "paid") return null;
    const action = pending[invoice.id];
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button className="min-h-11 min-w-11" disabled={action !== undefined} onClick={() => void act(invoice.id, "pay")}>
          {action === "pay" && <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />}
          Pay
        </Button>
        {invoice.payer === "tenant" && invoice.forwarded_at
          ? <span className="text-sm text-muted-foreground">Forwarded to tenant on <time dateTime={invoice.forwarded_at}>{formatDate(invoice.forwarded_at)}</time></span>
          : invoice.payer === "owner" && (
              <Button variant="secondary" className="min-h-11 min-w-11" disabled={action !== undefined} onClick={() => void act(invoice.id, "forward")}>
                {action === "forward" && <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />}
                Forward to tenant
              </Button>
            )}
      </div>
    );
  }

  return (
    <section aria-labelledby="invoices-heading" className="space-y-3">
      <h2 id="invoices-heading" className="text-xl font-semibold tracking-tight">Invoices</h2>
      {error ? <ErrorBlock message={error.message} onRetry={() => void Promise.all([invoices.mutate(), retryLookups()])} />
        : !rows || !units || !companies ? <LoadingBlock />
        : !rows.length ? <EmptyState icon={<ReceiptText className="size-5" />} title="No invoices yet" description="Invoices will appear after repairs are completed." />
        : (
          <>
            <div className="shadow-soft hidden overflow-hidden rounded-[14px] bg-card lg:block">
              <Table aria-label="Repair invoices">
                <TableHeader className="bg-muted/45 [&_th]:px-3 [&_th:first-child]:pl-5">
                  <TableRow>
                    <TableHead>Unit</TableHead><TableHead>Company</TableHead><TableHead>Issued</TableHead>
                    <TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="[&_td]:px-3 [&_td]:py-3 [&_td:first-child]:pl-5">
                  {rows.map(({ invoice, unit, company }) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium whitespace-normal">{unit}</TableCell>
                      <TableCell className="whitespace-normal">{company}</TableCell>
                      <TableCell><time dateTime={invoice.issued_at}>{formatDate(invoice.issued_at)}</time></TableCell>
                      <TableCell className="font-semibold tabular-nums"><Money value={invoice.amount_eur} /></TableCell>
                      <TableCell><InvoicePill invoice={invoice} /></TableCell>
                      <TableCell className="whitespace-normal">{renderActions(invoice)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
              {rows.map(({ invoice, unit, company }) => (
                <article key={invoice.id} className="shadow-soft min-w-0 space-y-3 rounded-[14px] bg-card p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-semibold wrap-anywhere">{unit}</h3>
                    <Money value={invoice.amount_eur} className="font-semibold tabular-nums" />
                  </div>
                  <p className="text-sm wrap-anywhere text-muted-foreground">{company}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <time dateTime={invoice.issued_at} className="text-sm text-muted-foreground">Issued {formatDate(invoice.issued_at)}</time>
                    <InvoicePill invoice={invoice} />
                  </div>
                  {renderActions(invoice)}
                </article>
              ))}
            </div>
          </>
        )}
    </section>
  );
}
