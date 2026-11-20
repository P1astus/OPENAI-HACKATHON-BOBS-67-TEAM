"use client";

import { AlertTriangle, Check, CircleCheck, Clock3, LoaderCircle, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { EmptyState, ErrorBlock, formatDateTime, formatSlot, LoadingBlock, Money, PartnerPill, RatingMeter } from "@/components/index";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { bookSlot, createTicket, type CompanyView } from "@/lib/api-client";
import { refreshAll, useCompanies, useTicket } from "@/lib/hooks";
import type { Ticket, Unit } from "@/types";
import { TenantSheet } from "./tenant-sheet";

const steps = ["Reading your message…", "Finding the right company…", "Checking free times…"];

export function RepairSheet({
  mode, unit, onClose, restoreFocus,
}: {
  mode: "report" | Ticket | null;
  unit: Unit | undefined;
  onClose: () => void;
  restoreFocus: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [booked, setBooked] = useState("");
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timeout.current !== null) clearTimeout(timeout.current);
  }, []);

  function close() {
    if (timeout.current !== null) clearTimeout(timeout.current);
    setBooked("");
    onClose();
  }

  const reporting = mode === "report";
  return (
    <TenantSheet
      open={mode !== null}
      onClose={close}
      restoreFocus={restoreFocus}
      busy={busy}
      title={reporting ? "Report a problem" : "Book your repair"}
      description={reporting ? "Tell us what needs fixing at home." : "Choose a time that works for you."}
    >
      {booked ? (
        <div role="status" className="motion-safe:fade-in flex items-start gap-3 rounded-xl bg-success/12 p-4 font-medium">
          <CircleCheck className="size-5 shrink-0 text-success" aria-hidden="true" />
          <p>{booked}</p>
        </div>
      ) : mode && (
        <RepairFlow
          key={reporting ? "report" : mode.id}
          initialTicket={reporting ? undefined : mode}
          unit={unit}
          busy={busy}
          setBusy={setBusy}
          onBooked={(message) => {
            setBooked(message);
            timeout.current = setTimeout(close, 1700);
          }}
        />
      )}
    </TenantSheet>
  );
}

function RepairFlow({
  initialTicket, unit, busy, setBusy, onBooked,
}: {
  initialTicket?: Ticket;
  unit?: Unit;
  busy: boolean;
  setBusy: (value: boolean) => void;
  onBooked: (message: string) => void;
}) {
  const [claim, setClaim] = useState("");
  const [reported, setReported] = useState<Ticket>();
  const [step, setStep] = useState(0);
  const result = useRef<HTMLDivElement>(null);
  const snapshot = reported ?? initialTicket;
  const ticketQuery = useTicket(snapshot?.id);
  const companies = useCompanies();
  const ticket = ticketQuery.data ?? snapshot;

  useEffect(() => {
    if (reported) result.current?.focus();
  }, [reported]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!unit?.tenant_id || !claim.trim() || busy) return;

    setBusy(true);
    setStep(0);
    const matching = setTimeout(() => setStep(1), 850);
    const slots = setTimeout(() => setStep(2), 1700);
    try {
      setReported(await createTicket({ tenant_id: unit.tenant_id, unit_id: unit.id, claim: claim.trim() }));
      void refreshAll();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      clearTimeout(matching);
      clearTimeout(slots);
      setBusy(false);
    }
  }

  if (ticket) {
    const company = companies.data?.find(({ id }) => id === ticket.company_id);
    const mayBook = ticket.status === "matched" && !ticket.appointment_at && ticket.proposed_slots.length > 0;
    return (
      <div ref={result} tabIndex={-1} className="motion-safe:fade-in space-y-3 rounded-xl outline-none">
        {ticketQuery.error && (
          <ErrorBlock message={ticketQuery.error.message} onRetry={() => void ticketQuery.mutate()} />
        )}
        {mayBook ? (
          company ? (
            <SlotPicker
              key={ticket.company_id}
              ticket={ticket}
              company={company}
              busy={busy}
              setBusy={setBusy}
              onBooked={onBooked}
              refreshTicket={() => void ticketQuery.mutate()}
            />
          ) : companies.error ? (
            <ErrorBlock message={companies.error.message} onRetry={() => void companies.mutate()} />
          ) : companies.isLoading ? (
            <LoadingBlock />
          ) : (
            <EmptyState title="Company details are unavailable" description="Check back from My requests to book this repair." />
          )
        ) : <RepairResult ticket={ticket} company={company} />}
      </div>
    );
  }

  return (
    <form onSubmit={send} className="space-y-3">
      <Textarea
        aria-label="What's wrong?"
        placeholder="What's wrong? e.g. The heating is cold in every room"
        value={claim}
        onChange={(event) => setClaim(event.target.value)}
        className="min-h-28 rounded-xl bg-background p-3"
        required
        disabled={busy}
      />
      <Button type="submit" disabled={busy || !claim.trim()} className="min-h-11 w-full rounded-full">
        {busy && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
        {busy ? "Sending…" : "Send"}
      </Button>
      {busy && (
        <ol aria-live="polite" className="space-y-3 rounded-xl bg-background p-4">
          {steps.slice(0, step + 1).map((label, index) => (
            <li key={label} className="motion-safe:fade-in flex items-center gap-3">
              {index < step ? <Check className="size-4 text-success" aria-hidden="true" /> : <LoaderCircle className="size-4 animate-spin text-primary" aria-hidden="true" />}
              <span>{label}{index < step && <span className="sr-only"> Done</span>}</span>
            </li>
          ))}
        </ol>
      )}
    </form>
  );
}

function SlotPicker({
  ticket, company, busy, setBusy, onBooked, refreshTicket,
}: {
  ticket: Ticket;
  company: CompanyView;
  busy: boolean;
  setBusy: (value: boolean) => void;
  onBooked: (message: string) => void;
  refreshTicket: () => void;
}) {
  const [selection, setSelection] = useState<string>();
  const selected = selection && ticket.proposed_slots.includes(selection) ? selection : undefined;

  async function confirm() {
    if (!selected || busy) return;
    setBusy(true);
    try {
      const booking = await bookSlot(ticket.id, selected, ["name", "phone", "address", "access_notes"]);
      void refreshAll();
      onBooked(booking.appointment_at
        ? `Booked: ${formatDateTime(booking.appointment_at)} with ${company.name}`
        : `Booked with ${company.name}`);
    } catch (err) {
      toast.error((err as Error).message);
      refreshTicket();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl bg-background p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold wrap-anywhere">{company.name}</h3>
          <PartnerPill isPartner={company.is_partner} />
        </div>
        <div className="[&_.bg-linear-to-r]:bg-muted [&_.bg-linear-to-r]:bg-none">
          <RatingMeter rating={company.rating} size="sm" />
        </div>
        <p>{ticket.triage?.summary || ticket.claim}</p>
        {ticket.est_cost_eur !== null && (
          <p className="text-muted-foreground">
            Estimated cost <Money value={ticket.est_cost_eur} /> · paid by your landlord
          </p>
        )}
      </div>
      <section aria-labelledby="tenant-slot-heading" className="space-y-2">
        <h3 id="tenant-slot-heading" className="text-base font-semibold">Pick a time</h3>
        <div className="grid grid-cols-2 gap-2">
          {ticket.proposed_slots.map((slot) => {
            const { day, time } = formatSlot(slot);
            return (
              <Button
                key={slot}
                type="button"
                variant={slot === selected ? "default" : "outline"}
                aria-pressed={slot === selected}
                onClick={() => setSelection(slot)}
                disabled={busy}
                className="h-auto min-h-15 flex-col gap-0.5 rounded-xl py-2"
              >
                <span className="text-xs">{day}</span>
                <span className="text-base font-semibold tabular-nums">{time}</span>
              </Button>
            );
          })}
        </div>
      </section>
      {selected && (
        <div className="motion-safe:fade-in space-y-3">
          <div className="flex items-start gap-3 rounded-xl bg-background p-4">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-medium wrap-anywhere">Share your name, phone, address and access notes with {company.name}?</p>
              <p className="text-muted-foreground">By confirming, you let the company contact you and access your home for this repair.</p>
            </div>
          </div>
          <Button type="button" onClick={confirm} disabled={busy} className="min-h-11 w-full rounded-full">
            {busy && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
            {busy ? "Booking…" : "Confirm booking"}
          </Button>
        </div>
      )}
    </div>
  );
}

function RepairResult({ ticket, company }: { ticket: Ticket; company?: CompanyView }) {
  const emergency = ticket.status === "emergency";
  if (emergency || ticket.status === "needs_human") {
    const Icon = emergency ? AlertTriangle : UserRound;
    return (
      <div role={emergency ? "alert" : "status"} className={`space-y-2 rounded-xl p-4 ${emergency ? "bg-destructive/12" : "bg-background"}`}>
        <Icon className={`size-5 ${emergency ? "text-destructive" : "text-primary"}`} aria-hidden="true" />
        {emergency && (
          <p className="font-semibold">If you smell gas: open the windows, don&apos;t use light switches, leave the flat and call 112 from outside.</p>
        )}
        <p>A property manager is taking this over and will contact you shortly.</p>
        {ticket.triage?.reason && <p className="text-muted-foreground">{ticket.triage.reason}</p>}
      </div>
    );
  }

  if (ticket.status === "awaiting_owner") {
    return (
      <div role="status" className="space-y-2 rounded-xl bg-background p-4">
        <Clock3 className="size-5 text-primary" aria-hidden="true" />
        {ticket.owner_approval === "rejected" ? (
          <p>Your landlord declined the repair estimate. You can contact your property manager for an update.</p>
        ) : (
          <p>
            Your landlord needs to approve this repair
            {ticket.est_cost_eur !== null && <> (estimated <Money value={ticket.est_cost_eur} />)</>}.
            We&apos;ll send you times as soon as it&apos;s approved.
          </p>
        )}
      </div>
    );
  }

  if (ticket.appointment_at) {
    return (
      <p role="status" className="rounded-xl bg-success/12 p-4 font-medium">
        Booked: {formatDateTime(ticket.appointment_at)}{company && ` with ${company.name}`}
      </p>
    );
  }

  return (
    <EmptyState
      icon={<Clock3 className="size-5" />}
      title={ticket.status === "matched" ? "Waiting for appointment times" : "Request received"}
      description={ticket.status === "matched" && company
        ? `Check My requests for times from ${company.name}.`
        : "You can follow this repair in My requests."}
    />
  );
}
