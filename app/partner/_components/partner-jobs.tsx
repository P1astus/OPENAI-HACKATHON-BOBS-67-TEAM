"use client";

import { CalendarDays, Check, Clock3, LoaderCircle, MapPin, Wrench } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  ContactCard, EmptyState, ErrorBlock, GroupedList, LoadingBlock,
  Money, StatusPill, formatDate, formatDateTime,
} from "@/components/index";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { acceptTicket, completeTicket } from "@/lib/api-client";
import { refreshAll, useBootstrap, useInvoices, useTickets } from "@/lib/hooks";
import type { Person, Property, Ticket, Unit } from "@/types";

const activeStatuses: Ticket["status"][] = ["matched", "awaiting_owner", "scheduled"];
const doneStatuses: Ticket["status"][] = ["done", "invoiced", "paid"];

function JobCard({ ticket, unit, property, tenant }: {
  ticket: Ticket; unit?: Unit; property?: Property; tenant?: Person;
}) {
  const [accepting, setAccepting] = useState(false);
  const accepted = ticket.events.some(({ type }) => type === "accepted");
  const scheduled = ticket.status === "scheduled";
  const shared = ticket.consent?.data_shared ?? [];
  const hasAddress = shared.includes("address");
  const address = property && `${property.address}, ${property.postcode} ${property.city}`;

  async function accept() {
    setAccepting(true);
    try {
      await acceptTicket(ticket.id);
      await refreshAll();
      toast.success("Job accepted");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setAccepting(false);
    }
  }

  return (
    <article className="shadow-soft flex min-w-0 flex-col gap-4 rounded-[14px] bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Clock3 aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          {ticket.appointment_at
            ? <time dateTime={ticket.appointment_at}>{formatDateTime(ticket.appointment_at)}</time>
            : "Not booked yet"}
        </p>
        <StatusPill status={ticket.status} />
      </div>
      <div className="space-y-2">
        <h3 className="text-lg leading-snug font-semibold wrap-anywhere">{ticket.triage?.summary ?? ticket.claim}</h3>
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0 wrap-anywhere">
            <p className="font-medium text-foreground">{hasAddress ? unit?.label ?? "Unit unavailable" : property?.city ?? "Property location"}</p>
            <p>{hasAddress ? address ?? "Address unavailable" : "Full address shared after consent"}</p>
          </div>
        </div>
        <p className="text-sm wrap-anywhere text-muted-foreground">
          <span className="font-medium text-foreground">Access notes</span>{" · "}
          {shared.includes("access_notes") ? unit?.access_notes || "No access notes" : "Shared after the tenant confirms"}
        </p>
      </div>
      <div className="rounded-[14px] border">
        {tenant
          ? <TenantContact tenant={tenant} consent={ticket.consent} />
          : <p className="p-4 text-sm text-muted-foreground">Tenant contact unavailable</p>}
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-2 border-t pt-4">
        {accepted
          ? <span className="flex min-h-11 items-center gap-2 pr-2 text-sm text-muted-foreground"><Check aria-hidden="true" className="size-4" />Accepted</span>
          : <Button variant="secondary" className="min-h-11" disabled={!scheduled || accepting} onClick={accept}>
              {accepting && <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />}
              Accept
            </Button>}
        {scheduled
          ? <InvoiceDialog ticket={ticket} accepting={accepting} />
          : <span className="text-sm text-muted-foreground">
              {ticket.owner_approval === "rejected" ? "Estimate declined by the owner" : "Accept once the tenant books"}
            </span>}
      </div>
    </article>
  );
}

function TenantContact({ tenant, consent }: { tenant: Person; consent: Ticket["consent"] }) {
  const shared = consent?.data_shared ?? [];
  const phone = shared.includes("phone") ? tenant.phone : "";
  const email = shared.includes("email") ? tenant.email : "";

  return (
    <div className={`[&>div]:shadow-none ${phone ? "" : "[&_a[href^='tel:']]:hidden"} ${email ? "" : "[&_a[href^='mailto:']]:hidden"}`}>
      <ContactCard
        name={shared.includes("name") ? tenant.name : "Tenant"}
        phone={phone}
        email={email}
        consent={phone || email ? consent : null}
      />
    </div>
  );
}

function InvoiceDialog({ ticket, accepting }: { ticket: Ticket; accepting: boolean }) {
  const amountId = useId();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);

  function changeOpen(next: boolean) {
    if (sending) return;
    if (next) setAmount(ticket.est_cost_eur?.toFixed(2) ?? "");
    setOpen(next);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter a positive invoice amount");
      return;
    }

    setSending(true);
    try {
      await completeTicket(ticket.id, value);
      setOpen(false);
      await refreshAll();
      toast.success("Repair completed and paid from the owner’s wallet");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild><Button className="min-h-11" disabled={accepting || sending}>Mark done</Button></DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Mark repair done</DialogTitle>
          <DialogDescription>Enter the final amount to pay from the owner’s centrix wallet.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor={amountId} className="font-medium">Invoice amount (€)</label>
            <Input id={amountId} className="min-h-11" type="number" inputMode="decimal" min="0.01" step="0.01"
              required value={amount} onChange={(event) => setAmount(event.target.value)} disabled={sending} />
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="secondary" className="min-h-11" disabled={sending}>Cancel</Button></DialogClose>
            <Button type="submit" className="min-h-11" disabled={sending}>
              {sending && <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />}
              Send invoice
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function appointmentOrder(a: Ticket, b: Ticket) {
  const first = a.appointment_at ? Date.parse(a.appointment_at) : Infinity;
  const second = b.appointment_at ? Date.parse(b.appointment_at) : Infinity;
  return (first === second ? 0 : first - second) || Date.parse(a.created_at) - Date.parse(b.created_at);
}

export function PartnerJobs({ companyId }: { companyId: string }) {
  const tickets = useTickets({ company_id: companyId });
  const bootstrap = useBootstrap();
  const lookups = bootstrap.data;
  const error = tickets.error ?? bootstrap.error;
  const jobs = tickets.data?.filter(({ status }) => activeStatuses.includes(status)).sort(appointmentOrder);

  return (
    <section aria-labelledby="jobs-heading" className="space-y-3">
      <h2 id="jobs-heading" className="section-label font-medium">Active jobs</h2>
      {error ? <ErrorBlock message={error.message} onRetry={() => void Promise.all([tickets.mutate(), bootstrap.mutate()])} />
        : !jobs || !lookups ? <LoadingBlock />
        : !jobs.length ? <EmptyState icon={<CalendarDays className="size-5" />} title="No active jobs" description="New matches and appointments will appear here." />
        : <div className="grid gap-4 sm:grid-cols-2">{jobs.map((ticket) => {
            const unit = lookups.units.find(({ id }) => id === ticket.unit_id);
            const property = lookups.properties.find(({ id }) => id === unit?.property_id);
            const tenant = lookups.people.find(({ id }) => id === ticket.tenant_id);
            return <JobCard key={ticket.id} {...{ ticket, unit, property, tenant }} />;
          })}</div>}
    </section>
  );
}

export function DoneJobs({ companyId }: { companyId: string }) {
  const tickets = useTickets({ company_id: companyId });
  const invoices = useInvoices({ company_id: companyId });
  const invoiceList = invoices.data;
  const bootstrap = useBootstrap();
  const lookups = bootstrap.data;
  const error = tickets.error ?? invoices.error ?? bootstrap.error;
  const jobs = tickets.data?.filter(({ status }) => doneStatuses.includes(status));

  return (
    <section aria-labelledby="done-heading" className="space-y-3">
      <h2 id="done-heading" className="section-label font-medium">Completed jobs</h2>
      <p className="text-sm text-muted-foreground">Finished repairs are paid from the owner’s centrix wallet.</p>
      {error ? <ErrorBlock message={error.message} onRetry={() => void Promise.all([tickets.mutate(), invoices.mutate(), bootstrap.mutate()])} />
        : !jobs || !invoiceList || !lookups ? <LoadingBlock />
        : !jobs.length ? <EmptyState icon={<Wrench className="size-5" />} title="No completed jobs" description="Finished repairs and their invoices will appear here." />
        : <GroupedList>{jobs.map((ticket) => {
            const invoice = invoiceList.find(({ ticket_id }) => ticket_id === ticket.id);
            const unit = lookups.units.find(({ id }) => id === ticket.unit_id);
            const date = invoice?.issued_at ?? ticket.appointment_at ?? ticket.created_at;
            return (
              <article key={ticket.id} className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
                <div className="min-w-0 flex-1 basis-52 space-y-1 wrap-anywhere">
                  <p className="text-sm text-muted-foreground">
                    <time dateTime={date}>{formatDate(date)}</time> · {unit?.label ?? "Unit unavailable"}
                  </p>
                  <h3 className="font-semibold">{ticket.triage?.summary ?? ticket.claim}</h3>
                </div>
                {invoice
                  ? <div className="flex flex-wrap items-center gap-2">
                      <Money value={invoice.amount_eur} className="font-semibold tabular-nums" />
                      <Badge variant="secondary" className="h-auto rounded-full px-2.5 py-1">Invoice sent</Badge>
                    </div>
                  : <p className="text-sm text-muted-foreground">No invoice yet</p>}
              </article>
            );
          })}</GroupedList>}
    </section>
  );
}
