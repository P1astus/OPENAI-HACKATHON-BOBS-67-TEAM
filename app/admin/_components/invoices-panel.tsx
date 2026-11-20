"use client";

import { ReceiptText } from "lucide-react";
import { useState } from "react";
import { EmptyState, ErrorBlock, GroupedList, InvoicePill, LoadingBlock, Money } from "@/components/index";
import type { InvoiceView } from "@/lib/api-client";
import { refreshAll, useBootstrap, useCompanies, useInvoices } from "@/lib/hooks";
import { FilterChips } from "./filter-chips";

const invoiceStatuses = [
  { value: "not_paid", label: "Not paid" },
  { value: "overdue", label: "Overdue" },
  { value: "paid", label: "Paid" },
] as const;

const payers = [
  { value: "owner", label: "Owner" },
  { value: "tenant", label: "Tenant" },
] as const;

const monthFormat = new Intl.DateTimeFormat("en", {
  month: "long", year: "numeric", timeZone: "Europe/Berlin",
});

function groupInvoices(invoices: InvoiceView[]) {
  const properties = new Map<string, Map<string, InvoiceView[]>>();
  const ordered = [...invoices].sort((a, b) => Date.parse(b.issued_at) - Date.parse(a.issued_at));
  for (const invoice of ordered) {
    const month = monthFormat.format(new Date(invoice.issued_at));
    const months = properties.get(invoice.property_id) ?? new Map<string, InvoiceView[]>();
    const rows = months.get(month) ?? [];
    rows.push(invoice);
    months.set(month, rows);
    properties.set(invoice.property_id, months);
  }
  return properties;
}

export function InvoicesPanel() {
  const [status, setStatus] = useState<typeof invoiceStatuses[number]["value"] | null>(null);
  const [payer, setPayer] = useState<InvoiceView["payer"] | null>(null);
  const invoices = useInvoices();
  const bootstrap = useBootstrap();
  const companies = useCompanies();
  const error = invoices.error ?? bootstrap.error ?? companies.error;
  const units = new Map(bootstrap.data?.units.map((unit) => [unit.id, unit.label]));
  const properties = new Map(bootstrap.data?.properties.map((property) => [property.id, property]));
  const names = new Map(companies.data?.map((company) => [company.id, company.name]));
  const shown = invoices.data?.filter((invoice) => {
    const matchesStatus = status === null || (status === "overdue" ? invoice.overdue : invoice.status === status);
    return matchesStatus && (payer === null || invoice.payer === payer);
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <FilterChips
          label="Invoice status"
          options={invoiceStatuses}
          value={status}
          onChange={(selected) => setStatus(status === selected ? null : selected)}
        />
        <FilterChips
          label="Invoice payer"
          options={payers}
          value={payer}
          onChange={(selected) => setPayer(payer === selected ? null : selected)}
        />
      </div>
      {error ? (
        <ErrorBlock message={error.message} onRetry={() => void refreshAll()} />
      ) : !shown || !bootstrap.data || !companies.data ? (
        <LoadingBlock />
      ) : shown.length === 0 ? (
        <EmptyState icon={<ReceiptText />} title={status || payer ? "No invoices match these filters" : "No invoices yet"} />
      ) : (
        <div className="space-y-7">
          {Array.from(groupInvoices(shown), ([propertyId, months]) => {
            const property = properties.get(propertyId);
            return (
              <section key={propertyId} className="space-y-4">
                <header className="px-1">
                  <h2 className="text-lg font-semibold tracking-tight wrap-anywhere">{property?.address ?? propertyId}</h2>
                  {property && <p className="text-sm text-muted-foreground">{property.postcode} {property.city}</p>}
                </header>
                {Array.from(months, ([month, rows]) => (
                  <section key={month}>
                    <h3 className="section-label mb-2 px-1 font-medium">{month}</h3>
                    <GroupedList>
                      {rows.map((invoice) => (
                        <div
                          key={invoice.id}
                          className="grid min-h-11 min-w-0 grid-cols-2 items-center gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-[1fr_1.5fr_0.75fr_auto_auto] sm:gap-x-5"
                        >
                          <span className="col-span-2 font-medium wrap-anywhere sm:col-span-1">{units.get(invoice.unit_id) ?? invoice.unit_id}</span>
                          <span className="col-span-2 wrap-anywhere text-muted-foreground sm:col-span-1">{names.get(invoice.company_id) ?? invoice.company_id}</span>
                          <Money className="font-medium tabular-nums" value={invoice.amount_eur} />
                          <span className="text-right capitalize text-muted-foreground sm:text-left">{invoice.payer}</span>
                          <div className="col-span-2 sm:col-span-1 sm:text-right"><InvoicePill invoice={invoice} /></div>
                        </div>
                      ))}
                      <div className="flex min-h-11 items-center justify-between gap-3 bg-muted/30 px-4 py-3 font-semibold">
                        <span>Subtotal</span>
                        <Money value={rows.reduce((subtotal, invoice) => subtotal + invoice.amount_eur, 0)} className="tabular-nums" />
                      </div>
                    </GroupedList>
                  </section>
                ))}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
