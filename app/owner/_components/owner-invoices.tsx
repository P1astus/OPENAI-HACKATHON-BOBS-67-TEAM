"use client";

import { LoaderCircle, ReceiptText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState, ErrorBlock, InvoicePill, LoadingBlock, Money, formatDate } from "@/components/index";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { forwardInvoice } from "@/lib/api-client";
import { refreshAll, useInvoices } from "@/lib/hooks";
import type { Company, Invoice, Person, Unit } from "@/types";

function WalletInvoicePill({ invoice }: { invoice: Invoice }) {
  const payment = invoice.status === "paid" ? "Paid" : "Not paid";
  const label = invoice.payer === "tenant"
    ? `Forwarded to tenant · ${payment}`
    : invoice.status === "paid" ? "Paid from wallet" : payment;
  return <InvoicePill invoice={invoice} label={label} />;
}

export function OwnerInvoices({ ownerId, units, companies, people, lookupError, retryLookups }: {
  ownerId: string;
  units?: Unit[];
  companies?: Company[];
  people?: Person[];
  lookupError?: Error;
  retryLookups: () => Promise<unknown>;
}) {
  const invoices = useInvoices({ owner_id: ownerId });
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const error = invoices.error ?? lookupError;

  async function chargeTenant(id: string) {
    setPendingId(id);
    try {
      await forwardInvoice(id);
      await refreshAll();
      setConfirmId(null);
      toast.success("Invoice forwarded to the tenant");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setPendingId(null);
    }
  }

  const rows = invoices.data?.map((invoice) => {
    const unit = units?.find(({ id }) => id === invoice.unit_id);
    return {
      invoice,
      unit: unit?.label ?? "Unit unavailable",
      company: companies?.find(({ id }) => id === invoice.company_id)?.name ?? "Company unavailable",
      tenant: people?.find(({ id }) => id === unit?.tenant_id)?.name,
      date: (invoice.payer === "owner" ? invoice.paid_at : null) ?? invoice.issued_at,
    };
  });

  function renderActions(invoice: Invoice, tenant?: string) {
    if (invoice.payer !== "owner" || invoice.status !== "paid") return null;
    if (confirmId !== invoice.id) {
      return (
        <Button variant="secondary" className="min-h-11" disabled={pendingId !== null} onClick={() => setConfirmId(invoice.id)}>
          Charge to tenant
        </Button>
      );
    }
    const pending = pendingId === invoice.id;
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">The amount goes back to your wallet and {tenant ?? "the tenant"} pays it.</p>
        <div className="flex flex-wrap gap-2">
          <Button className="min-h-11" disabled={pending} onClick={() => void chargeTenant(invoice.id)}>
            {pending && <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />}
            {pending ? "Charging…" : "Confirm charge"}
          </Button>
          <Button variant="ghost" className="min-h-11" disabled={pending} onClick={() => setConfirmId(null)}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <section aria-labelledby="invoices-heading" className="space-y-3">
      <div className="space-y-1">
        <h2 id="invoices-heading" tabIndex={-1} className="scroll-mt-20 text-xl font-semibold tracking-tight">Repairs paid from your wallet</h2>
        <p className="text-sm text-muted-foreground">centrix pays finished repairs from your wallet. Payment terms with the company are handled by reltix.</p>
      </div>
      {error ? <ErrorBlock message={error.message} onRetry={() => void Promise.all([invoices.mutate(), retryLookups()])} />
        : !rows || !units || !companies ? <LoadingBlock />
        : !rows.length ? <EmptyState icon={<ReceiptText className="size-5" />} title="No invoices yet" description="Invoices will appear after repairs are completed." />
        : (
          <>
            <div className="shadow-soft hidden overflow-hidden rounded-[14px] bg-card lg:block">
              <Table aria-label="Repair invoices">
                <TableHeader className="bg-muted/45 [&_th]:px-3 [&_th:first-child]:pl-5">
                  <TableRow>
                    <TableHead>Unit</TableHead><TableHead>Company</TableHead><TableHead>Job date</TableHead>
                    <TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="[&_td]:px-3 [&_td]:py-3 [&_td:first-child]:pl-5">
                  {rows.map(({ invoice, unit, company, tenant, date }) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium whitespace-normal">{unit}</TableCell>
                      <TableCell className="whitespace-normal">{company}</TableCell>
                      <TableCell><time dateTime={date}>{formatDate(date)}</time></TableCell>
                      <TableCell className="font-semibold tabular-nums"><Money value={invoice.amount_eur} /></TableCell>
                      <TableCell><WalletInvoicePill invoice={invoice} /></TableCell>
                      <TableCell className="whitespace-normal">{renderActions(invoice, tenant)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
              {rows.map(({ invoice, unit, company, tenant, date }) => (
                <article key={invoice.id} className="shadow-soft min-w-0 space-y-3 rounded-[14px] bg-card p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-semibold wrap-anywhere">{unit}</h3>
                    <Money value={invoice.amount_eur} className="font-semibold tabular-nums" />
                  </div>
                  <p className="text-sm wrap-anywhere text-muted-foreground">{company}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <time dateTime={date} className="text-sm text-muted-foreground">{formatDate(date)}</time>
                    <WalletInvoicePill invoice={invoice} />
                  </div>
                  {renderActions(invoice, tenant)}
                </article>
              ))}
            </div>
          </>
        )}
    </section>
  );
}
