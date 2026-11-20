"use client";

import { AlertTriangle, CircleCheck, Clock3, LoaderCircle, PhoneCall, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { EmptyState, ErrorBlock, formatDateTime, formatSlot, LoadingBlock, Money, PartnerPill, RatingMeter } from "@/components/index";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { bookSlot, createTicket, type CompanyView } from "@/lib/api-client";
import { refreshAll, useCompanies, useTicket } from "@/lib/hooks";
import type { Ticket, Unit } from "@/types";
import { isCallingCompany } from "./repair-activity";
import { TenantSheet } from "./tenant-sheet";

const steps = ["Reviewing your report…", "Checking repair options…", "Still working on your request…"];

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
  const [hasReport, setHasReport] = useState(false);
  const doneButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (booked) doneButton.current?.focus();
  }, [booked]);

  function close() {
    setBooked("");
    setHasReport(false);
    onClose();
  }

  const reporting = mode === "report";
  const writing = reporting && !hasReport;
  return (
    <TenantSheet
      open={mode !== null}
      onClose={close}
      restoreFocus={restoreFocus}
      busy={busy}
      title={booked ? "Appointment confirmed" : writing ? "Report a problem" : "Your repair request"}
      description={booked ? "You can find this visit under Upcoming." : writing ? "Tell us what needs fixing at home." : "See the latest update or choose a time."}
    >
      {booked ? (
        <div className="space-y-4">
          <div role="status" className="motion-safe:fade-in flex items-start gap-3 rounded-xl bg-success/12 p-4 font-medium">
            <CircleCheck className="size-5 shrink-0 text-success" aria-hidden="true" />
            <p>{booked}</p>
          </div>
          <Button ref={doneButton} type="button" className="min-h-12 w-full rounded-full" onClick={close}>Done</Button>
        </div>
      ) : mode && (
        <RepairFlow
          key={reporting ? "report" : mode.id}
          initialTicket={reporting ? undefined : mode}
          unit={unit}
          busy={busy}
          setBusy={setBusy}
          onReported={() => setHasReport(true)}
          onBooked={setBooked}
        />
      )}
    </TenantSheet>
  );
}

function RepairFlow({
  initialTicket, unit, busy, setBusy, onReported, onBooked,
}: {
  initialTicket?: Ticket;
  unit?: Unit;
  busy: boolean;
  setBusy: (value: boolean) => void;
  onReported: () => void;
  onBooked: (message: string) => void;
}) {
  const [claim, setClaim] = useState("");
  const [reported, setReported] = useState<Ticket>();
  const [step, setStep] = useState(0);
  const [sendError, setSendError] = useState("");
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
    if (!unit?.tenant_id || claim.trim().length < 3 || busy) return;

    setBusy(true);
    setSendError("");
    setStep(0);
    const matching = setTimeout(() => setStep(1), 1400);
    const waiting = setTimeout(() => setStep(2), 6000);
    try {
      setReported(await createTicket({ tenant_id: unit.tenant_id, unit_id: unit.id, claim: claim.trim() }));
      onReported();
      void refreshAll();
    } catch (err) {
      setSendError((err as Error).message);
    } finally {
      clearTimeout(matching);
      clearTimeout(waiting);
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

  if (busy) {
    return (
      <div className="motion-safe:fade-in space-y-4 py-1">
        <p className="max-h-28 overflow-y-auto rounded-2xl bg-primary/8 p-4 wrap-anywhere">{claim.trim()}</p>
        <div role="status" className="flex items-center gap-3 rounded-2xl bg-background p-4">
          <LoaderCircle className="size-5 shrink-0 motion-safe:animate-spin text-primary" aria-hidden="true" />
          <p className="font-medium">{steps[step]}</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={send} className="space-y-4">
      <Textarea
        aria-label="What's wrong?"
        aria-invalid={Boolean(sendError)}
        placeholder="What’s wrong? E.g. The heating is cold in every room."
        value={claim}
        onChange={(event) => { setClaim(event.target.value); setSendError(""); }}
        className="min-h-30 rounded-2xl bg-background p-4 md:text-base"
        maxLength={2000}
        required
      />
      {sendError && <p role="alert" className="text-sm font-medium text-destructive">{sendError}</p>}
      <Button type="submit" disabled={claim.trim().length < 3} className="min-h-12 w-full rounded-full text-base">
        Send
      </Button>
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
  const [bookingError, setBookingError] = useState("");
  const selected = selection && ticket.proposed_slots.includes(selection) ? selection : undefined;

  async function confirm() {
    if (!selected || busy) return;
    setBookingError("");
    setBusy(true);
    try {
      const booking = await bookSlot(ticket.id, selected, ["name", "phone", "address", "access_notes"]);
      void refreshAll();
      onBooked(booking.appointment_at
        ? `${formatDateTime(booking.appointment_at)} · ${company.name}`
        : `Booked with ${company.name}`);
    } catch (err) {
      setBookingError((err as Error).message);
      refreshTicket();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2.5 rounded-2xl bg-background px-4 py-3">
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
            Estimate <Money value={ticket.est_cost_eur} /> · paid by your landlord
          </p>
        )}
      </div>
      <section aria-labelledby="tenant-slot-heading" className="space-y-2">
        <h3 id="tenant-slot-heading" className="text-base font-semibold">Pick a time</h3>
        <div className="grid grid-cols-3 gap-2">
          {ticket.proposed_slots.map((slot) => {
            const { day, time } = formatSlot(slot);
            return (
              <Button
                key={slot}
                type="button"
                variant={slot === selected ? "default" : "outline"}
                aria-pressed={slot === selected}
                onClick={() => { setSelection(slot); setBookingError(""); }}
                disabled={busy}
                className="h-auto min-h-15 flex-col gap-0.5 rounded-xl px-1 py-2"
              >
                <span className="text-xs">{day}</span>
                <span className="text-base font-semibold tabular-nums">{time}</span>
              </Button>
            );
          })}
        </div>
      </section>
      {bookingError && <p role="alert" className="text-sm font-medium text-destructive">{bookingError}</p>}
      {selected && (
        <div className="motion-safe:fade-in space-y-3">
          <div className="flex items-start gap-3 rounded-xl bg-background p-4">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-medium wrap-anywhere">Share your name, phone, address and access notes with {company.name}?</p>
              <p className="text-muted-foreground">We’ll share these details for this repair when you confirm.</p>
            </div>
          </div>
          <Button type="button" onClick={confirm} disabled={busy} className="min-h-12 w-full rounded-full text-base">
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
        <p className="font-semibold">{ticket.owner_approval === "rejected" ? "Your landlord declined the estimate" : "Your property manager is reviewing this"}</p>
        <p className="text-muted-foreground">We’ll post the next update in My requests.</p>
      </div>
    );
  }

  if (ticket.status === "awaiting_owner") {
    return (
      <div role="status" className="space-y-2 rounded-xl bg-background p-4">
        <Clock3 className="size-5 text-primary" aria-hidden="true" />
        <p className="font-semibold">Waiting for landlord approval</p>
        <p className="text-muted-foreground">
          {ticket.est_cost_eur !== null && <>The estimate is <Money value={ticket.est_cost_eur} />. </>}
          We’ll look for times once your landlord approves.
        </p>
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

  if (isCallingCompany(ticket)) {
    return (
      <div role="status" className="flex items-start gap-3 rounded-2xl bg-primary/8 p-4">
        <PhoneCall className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="space-y-1">
          <p className="font-semibold">We’re calling {company?.name ?? "the company"} for times…</p>
          <p className="text-muted-foreground">Times will appear here when the company replies. You can also come back from My requests.</p>
        </div>
      </div>
    );
  }

  return (
    <EmptyState
      icon={<Clock3 className="size-5" />}
      title={ticket.status === "matched" ? "No appointment times available yet" : "Request received"}
      description="You can follow this repair in My requests."
    />
  );
}
