"use client";

import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { PartnerPill } from "@/components/index";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { assignTicket, clarifyTicket, type CompanyView } from "@/lib/api-client";
import { refreshAll } from "@/lib/hooks";
import type { Property, Ticket } from "@/types";
import { CompanyList } from "./company-list";
import { tradeLabels } from "./trades";
import { WebResults } from "./web-results";

export { tradeLabels } from "./trades";

export function ClarifyRepair({ ticket, actor, companies, property, tenantName }: {
  ticket: Ticket;
  actor: "owner" | "admin";
  companies: CompanyView[];
  property?: Property;
  tenantName: string;
}) {
  const id = useId();
  const [note, setNote] = useState("");
  const [step, setStep] = useState<"reading" | "matching" | null>(null);
  const [result, setResult] = useState<Ticket | null>(null);
  const [assigning, setAssigning] = useState<string | null>(null);
  const current = result && result.events.length > ticket.events.length ? result : ticket;
  const canClarify = current.status === "needs_human" || current.status === "emergency";
  const emergency = current.status === "emergency";
  const active = companies.filter((company) => company.status === "active");
  const chosen = companies.find((company) => company.id === result?.company_id);
  const chosenTrade = result?.triage?.trade;
  const matched = result?.status === "matched" || result?.status === "awaiting_owner";
  const latestMatch = result?.events.findLastIndex((event) => event.type === "matched") ?? -1;
  const calling = result?.status === "matched" && result.proposed_slots.length === 0
    && result.events.slice(latestMatch + 1).some((event) => event.type === "calling_company");
  const trade = current.triage?.trade;
  const disabled = step !== null || assigning !== null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);
    setStep("reading");
    const timer = setTimeout(() => setStep("matching"), 700);
    try {
      const updated = await clarifyTicket(ticket.id, note, actor);
      setResult(updated);
      setNote("");
      void refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t clarify the repair.");
    } finally {
      clearTimeout(timer);
      setStep(null);
    }
  }

  async function assign(company: CompanyView) {
    setAssigning(company.id);
    try {
      const updated = await assignTicket(ticket.id, company.id);
      setResult(null);
      await refreshAll();
      toast.success(updated.status === "awaiting_owner"
        ? `${company.name} assigned. The estimate needs owner approval.`
        : `${company.name} assigned. ${tenantName} will get times to pick.`);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t assign the company.");
      return false;
    } finally {
      setAssigning(null);
    }
  }

  if (!canClarify && !matched) return null;

  return (
    <div className="space-y-4">
      <section aria-labelledby={id} className="shadow-soft space-y-3 rounded-[14px] border bg-card p-4">
        <h3 id={id} className="font-semibold">What&apos;s the actual problem?</h3>
        {canClarify && (
          <form className="space-y-3" onSubmit={submit}>
            {emergency && <p className="text-sm text-muted-foreground">A person must assign a company to this emergency.</p>}
            <Textarea aria-labelledby={id} placeholder="e.g. Water drips from the ceiling light in the hallway"
              value={note} onChange={(event) => setNote(event.target.value)} minLength={5} maxLength={1000}
              required disabled={disabled} rows={3} className="resize-y" />
            <Button type="submit" className="min-h-11 dark:text-black" disabled={disabled || note.trim().length < 5}>
              {emergency ? "Update problem" : "Find the right company"}
            </Button>
          </form>
        )}
        <div role="status" className="text-sm [&:empty]:hidden">
          {step ? (
            <p className="text-muted-foreground">{step === "reading" ? "Reading your note…" : "Matching companies…"}</p>
          ) : matched && chosenTrade && chosen ? (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>{calling
                ? `Calling ${chosen.name} for times…`
                : `Clear now: ${tradeLabels[chosenTrade]}. ${chosen.name} was chosen; ${tenantName} gets times to pick${result.status === "awaiting_owner" ? " after approval" : ""}.`}</span>
              <PartnerPill isPartner={chosen.is_partner} />
            </p>
          ) : result?.status === "needs_human" ? (
            <p>Still not clear. Pick a company below.</p>
          ) : result?.status === "emergency" ? (
            <p>Problem updated. Pick a company below.</p>
          ) : null}
        </div>
      </section>
      {canClarify && <CompanyList ticket={current} companies={active} disabled={disabled} assigning={assigning} onAssign={assign} />}
      {canClarify && trade && property && <WebResults key={`${trade}:${property.id}`} trade={trade} property={property} />}
    </div>
  );
}
