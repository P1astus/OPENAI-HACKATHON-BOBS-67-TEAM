"use client";

import { CalendarDays, ClipboardList, History, MessageCircle, Plus, ReceiptText } from "lucide-react";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { EmptyState, ErrorBlock, GroupedList, GroupedRow, LoadingBlock, PageHeader } from "@/components/index";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useBootstrap, useCompanies, useInvoices, useTickets, useViewer } from "@/lib/hooks";
import type { Ticket, TicketStatus } from "@/types";
import { Appointment, FinishedRepair, InvoiceRow, RequestRow } from "./repair-activity";
import { RepairSheet } from "./repair-sheet";
import { TenantSheet } from "./tenant-sheet";

const openStatuses: TicketStatus[] = ["reported", "needs_human", "emergency", "matched", "awaiting_owner"];
const finishedStatuses: TicketStatus[] = ["done", "invoiced", "paid"];

export function TenantView() {
  const viewer = useViewer("p_lena");
  return <Resident key={viewer} viewer={viewer} />;
}

function Resident({ viewer }: { viewer: string }) {
  const bootstrap = useBootstrap();
  const tickets = useTickets({ tenant_id: viewer });
  const companies = useCompanies();
  const invoices = useInvoices({ tenant_id: viewer });
  const [mode, setMode] = useState<"report" | Ticket | null>(null);
  const reportButton = useRef<HTMLButtonElement>(null);
  const repairTrigger = useRef<HTMLButtonElement | null>(null);

  const person = bootstrap.data?.people.find(({ id, role }) => id === viewer && role === "tenant");
  const unit = bootstrap.data?.units.find(({ tenant_id }) => tenant_id === viewer);
  const property = bootstrap.data?.properties.find(({ id }) => id === unit?.property_id);
  const firstName = person?.name.trim().split(/\s+/)[0];
  const subtitle = [property?.address, unit?.label].filter(Boolean).join(" · ");

  const upcoming = tickets.data?.filter((ticket): ticket is Ticket & { appointment_at: string } => (
    ticket.status === "scheduled" && Boolean(ticket.appointment_at)
  )).sort((a, b) => Date.parse(a.appointment_at) - Date.parse(b.appointment_at));
  const requests = tickets.data?.filter(({ status }) => openStatuses.includes(status));
  const finished = tickets.data?.filter(({ status }) => finishedStatuses.includes(status));
  const tenantInvoices = invoices.data?.filter(({ payer }) => payer === "tenant");

  function companyFor(id: string | null) {
    return companies.data?.find((company) => company.id === id);
  }

  function openRepair(next: "report" | Ticket, trigger: HTMLButtonElement) {
    repairTrigger.current = trigger;
    setMode(next);
  }

  const ticketError = tickets.error && (
    <ErrorBlock message={tickets.error.message} onRetry={() => void tickets.mutate()} />
  );
  const companyError = companies.error && (
    <ErrorBlock message={companies.error.message} onRetry={() => void companies.mutate()} />
  );

  return (
    <div className="mx-auto w-full max-w-[430px]">
      <PageHeader title={firstName ? `Hi ${firstName}` : "Your repairs"} subtitle={subtitle || undefined} />
      <main className="motion-safe:fade-in space-y-6 px-4 pb-10 sm:px-6">
        {bootstrap.error ? (
          <ErrorBlock message={bootstrap.error.message} onRetry={() => void bootstrap.mutate()} />
        ) : bootstrap.isLoading ? (
          <LoadingBlock lines={2} />
        ) : person && unit ? (
          <Button
            ref={reportButton}
            type="button"
            onClick={(event) => openRepair("report", event.currentTarget)}
            className="h-13 w-full gap-2 rounded-full text-base font-semibold"
          >
            <Plus className="size-5" aria-hidden="true" /> Report a problem
          </Button>
        ) : (
          <EmptyState title="No home linked" description="Your property manager can help link your account to your home." />
        )}

        <Section title="Upcoming">
          {ticketError || (!upcoming ? <LoadingBlock /> : upcoming.length === 0 ? (
            <EmptyState icon={<CalendarDays className="size-5" />} title="No upcoming appointments" description="Booked repairs will appear here." />
          ) : companyError || (companies.isLoading ? <LoadingBlock /> : (
            <GroupedList>
              {upcoming.map((ticket) => <Appointment key={ticket.id} ticket={ticket} company={companyFor(ticket.company_id)} />)}
            </GroupedList>
          )))}
        </Section>

        <Section title="My requests">
          {ticketError || (!requests ? <LoadingBlock /> : requests.length === 0 ? (
            <EmptyState icon={<ClipboardList className="size-5" />} title="No open requests" description="Repairs you report will appear here." />
          ) : (
            <GroupedList>
              {requests.map((ticket) => <RequestRow key={ticket.id} ticket={ticket} onPickTime={(trigger) => openRepair(ticket, trigger)} />)}
            </GroupedList>
          ))}
        </Section>

        <Section title="Finished">
          {ticketError || (!finished ? <LoadingBlock /> : finished.length === 0 ? (
            <EmptyState icon={<History className="size-5" />} title="No finished repairs" />
          ) : companyError || (companies.isLoading ? <LoadingBlock /> : (
            <GroupedList>
              {finished.map((ticket) => <FinishedRepair key={ticket.id} ticket={ticket} company={companyFor(ticket.company_id)} />)}
            </GroupedList>
          )))}
        </Section>

        <Section title="Invoices">
          {invoices.error ? (
            <ErrorBlock message={invoices.error.message} onRetry={() => void invoices.mutate()} />
          ) : !tenantInvoices ? <LoadingBlock /> : tenantInvoices.length === 0 ? (
            <EmptyState icon={<ReceiptText className="size-5" />} title="No invoices for you." description="Repairs are billed to your landlord." />
          ) : companyError || (companies.isLoading ? <LoadingBlock /> : (
            <GroupedList>
              {tenantInvoices.map((invoice) => <InvoiceRow key={invoice.id} invoice={invoice} company={companyFor(invoice.company_id)} />)}
            </GroupedList>
          ))}
        </Section>

        <Support />
      </main>
      <RepairSheet
        mode={mode}
        unit={unit}
        onClose={() => setMode(null)}
        restoreFocus={() => {
          const trigger = repairTrigger.current;
          if (trigger?.isConnected) trigger.focus();
          else reportButton.current?.focus();
        }}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title}>
      <h2 className="section-label mb-2 px-4 font-medium">{title}</h2>
      {children}
    </section>
  );
}

function Support() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const trigger = useRef<HTMLButtonElement | null>(null);

  function close() {
    setOpen(false);
    setMessage("");
  }

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim()) return;
    toast.success("Message sent. We'll get back to you today.");
    close();
  }

  return (
    <Section title="Support">
      <GroupedList>
        <GroupedRow
          title="Message the property manager"
          icon={<MessageCircle className="size-5 text-primary" />}
          onClick={(event) => {
            trigger.current = event.currentTarget;
            setOpen(true);
          }}
          chevron
        />
      </GroupedList>
      <TenantSheet
        open={open}
        onClose={close}
        restoreFocus={() => trigger.current?.focus()}
        title="Message the property manager"
        description="How can we help?"
      >
        <form onSubmit={send} className="space-y-3">
          <Textarea
            aria-label="Your message"
            placeholder="Write a message…"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="min-h-24 rounded-xl bg-background p-3"
            required
          />
          <Button type="submit" disabled={!message.trim()} className="min-h-11 w-full rounded-full">Send</Button>
        </form>
      </TenantSheet>
    </Section>
  );
}
