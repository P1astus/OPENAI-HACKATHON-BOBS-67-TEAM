"use client";

import { ReceiptText } from "lucide-react";
import { useState } from "react";
import { EmptyState, ErrorBlock, InvoicePill, LoadingBlock, Money, formatDate } from "@/components/index";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { refreshAll, useBootstrap, useCompanies, useInvoices } from "@/lib/hooks";
import type { Invoice } from "@/types";
import { FilterChips } from "./filter-chips";

const payers = [
  { value: "owner", label: "Owner wallet" },
  { value: "tenant", label: "Tenant" },
] as const;

export function InvoicesPanel() {
  const [payer, setPayer] = useState<Invoice["payer"] | null>(null);
  const invoices = useInvoices();
  const bootstrap = useBootstrap();
  const companies = useCompanies();
  const error = invoices.error ?? bootstrap.error ?? companies.error;
  const units = new Map(bootstrap.data?.units.map((unit) => [unit.id, unit.label]));
  const addresses = new Map(bootstrap.data?.properties.map((property) => [property.id, property.address]));
  const names = new Map(companies.data?.map((company) => [company.id, company.name]));
  const shown = invoices.data
    ?.filter((invoice) => payer === null || invoice.payer === payer)
    .sort((a, b) => Date.parse(b.issued_at) - Date.parse(a.issued_at));

  return (
    <div className="space-y-5">
      <FilterChips
        label="Invoice payer"
        options={payers}
        value={payer}
        onChange={(selected) => setPayer(payer === selected ? null : selected)}
      />
      {error ? (
        <ErrorBlock message={error.message} onRetry={() => void refreshAll()} />
      ) : !shown || !bootstrap.data || !companies.data ? (
        <LoadingBlock />
      ) : shown.length === 0 ? (
        <EmptyState icon={<ReceiptText />} title={payer ? "No invoices match this filter" : "No invoices yet"} />
      ) : (
        <div className="shadow-soft overflow-hidden rounded-[14px] bg-card">
          <Table aria-label="Repair invoices">
            <TableHeader className="bg-muted/45 [&_th]:px-3 [&_th:first-child]:pl-5">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Property address</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Payer</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="[&_td]:px-3 [&_td]:py-3 [&_td:first-child]:pl-5">
              {shown.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell><time dateTime={invoice.issued_at}>{formatDate(invoice.issued_at)}</time></TableCell>
                  <TableCell className="font-medium">{addresses.get(invoice.property_id) ?? invoice.property_id}</TableCell>
                  <TableCell>{units.get(invoice.unit_id) ?? invoice.unit_id}</TableCell>
                  <TableCell>{names.get(invoice.company_id) ?? invoice.company_id}</TableCell>
                  <TableCell className="font-medium tabular-nums"><Money value={invoice.amount_eur} /></TableCell>
                  <TableCell>{invoice.payer === "owner" ? "Owner wallet" : "Tenant"}</TableCell>
                  <TableCell><InvoicePill invoice={invoice} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
