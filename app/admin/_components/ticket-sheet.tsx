"use client";

import { Code2, History, LoaderCircle, X } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  EmptyState, ErrorBlock, formatDateTime, LoadingBlock, Money, PartnerPill, StatusPill, Timeline,
} from "@/components/index";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { assignTicket, type Bootstrap, type CompanyView } from "@/lib/api-client";
import { refreshAll, useBootstrap, useCompanies, useTicket } from "@/lib/hooks";
import type { MatchCandidate, Ticket } from "@/types";

const percent = new Intl.NumberFormat("en", { style: "percent" });
const weights = [
  ["reviews", "Reviews 50%"],
  ["price", "Price 30%"],
  ["distance", "Distance 20%"],
] as const satisfies readonly [keyof MatchCandidate["parts"], string][];

function DetailSection({ title, id, children }: { title: string; id?: string; children: ReactNode }) {
  return (
    <section>
      <h3 id={id} tabIndex={id ? -1 : undefined} className="section-label mb-2 scroll-mt-4 px-1 font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function TicketDetails({ ticket, bootstrap, companies }: {
  ticket: Ticket;
  bootstrap: Bootstrap;
  companies: CompanyView[];
}) {
  const [pendingCompany, setPendingCompany] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const rawId = useId();
  const timelineId = useId();
  const { triage, consent } = ticket;
  const tenant = bootstrap.people.find((person) => person.id === ticket.tenant_id);
  const canAssign = ticket.status === "needs_human" || ticket.status === "emergency";
  const companyById = new Map(companies.map((company) => [company.id, company]));

  async function assign(companyId: string) {
    setPendingCompany(companyId);
    try {
      await assignTicket(ticket.id, companyId);
      await refreshAll();
      toast.success("Company assigned.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t assign the company.");
    } finally {
      setPendingCompany(null);
    }
  }

  return (
    <div className="min-w-0 space-y-6">
      <DetailSection title="Claim">
        <div className="shadow-soft space-y-3 rounded-[14px] bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">{tenant?.name ?? "Tenant"}</p>
            <StatusPill status={ticket.status} />
          </div>
          <blockquote className="text-base leading-relaxed whitespace-pre-wrap wrap-anywhere">“{ticket.claim}”</blockquote>
          {ticket.events.length > 0 && (
            <a href={`#${timelineId}`} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary/8 px-3 text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring">
              <History aria-hidden="true" className="size-4" /> View timeline
            </a>
          )}
        </div>
      </DetailSection>
      <DetailSection title="Triage">
        {triage ? (
          <div className="shadow-soft space-y-3 rounded-[14px] bg-card p-4">
            <Badge variant="secondary" className="rounded-full">{triage.source === "model" ? "AI model" : "Rules fallback"}</Badge>
            <dl className="grid grid-cols-3 gap-2">
              <div><dt className="text-xs text-muted-foreground">Trade</dt><dd className="mt-1 font-medium capitalize">{triage.trade?.replaceAll("_", " ") ?? "–"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Urgency</dt><dd className="mt-1 font-medium capitalize">{triage.urgency}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Confidence</dt><dd className="mt-1 font-medium tabular-nums">{percent.format(triage.confidence)}</dd></div>
            </dl>
            <p className="wrap-anywhere">{triage.summary}</p>
            {triage.needs_human && triage.reason && (
              <p className="rounded-lg bg-warning/12 px-3 py-2 text-sm wrap-anywhere">{triage.reason}</p>
            )}
          </div>
        ) : <EmptyState title="No triage yet" />}
      </DetailSection>
      <DetailSection title="Why this company">
        {ticket.candidates.length === 0 ? (
          <EmptyState title="No ranked candidates" />
        ) : (
          <ol className="space-y-2">
            {ticket.candidates.map((candidate) => {
              const company = companyById.get(candidate.company_id);
              const chosen = candidate.company_id === ticket.company_id;
              const assigning = pendingCompany === candidate.company_id;
              return (
                <li
                  key={candidate.company_id}
                  className={`shadow-soft rounded-[14px] border bg-card p-4 ${chosen ? "border-primary/40" : "border-transparent"}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold wrap-anywhere">{company?.name ?? candidate.company_id}</span>
                    <div className="flex flex-wrap items-center gap-2">
                      {company && <PartnerPill isPartner={company.is_partner} />}
                      {chosen && <span className="text-xs font-semibold text-primary">Chosen</span>}
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Match <strong className="font-semibold text-foreground">{candidate.match.toFixed(2)}</strong>
                    {" · "}{candidate.distance_km.toFixed(1)} km
                    {" · "}<Money value={candidate.est_cost_eur} /> estimated
                  </p>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    {weights.map(([part, label]) => (
                      <div key={part} className="space-y-1.5">
                        <p className="text-xs leading-tight text-muted-foreground">{label}</p>
                        <div
                          role="meter"
                          aria-label={label}
                          aria-valuemin={0}
                          aria-valuemax={1}
                          aria-valuenow={candidate.parts[part]}
                          className="h-1.5 overflow-hidden rounded-full bg-muted"
                        >
                          <div className="h-full origin-left rounded-full bg-primary" style={{ transform: `scaleX(${candidate.parts[part]})` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  {canAssign && (
                    <div className="mt-3 flex justify-end">
                      <Button
                        type="button"
                        variant="secondary"
                        className="min-h-11 px-4"
                        aria-label={`${assigning ? "Assigning" : "Assign"} ${company?.name ?? candidate.company_id}`}
                        disabled={pendingCompany !== null || company?.status !== "active"}
                        onClick={() => assign(candidate.company_id)}
                      >
                        {assigning && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
                        {assigning ? "Assigning…" : company?.status === "active" ? "Assign" : "Unavailable"}
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </DetailSection>
      <DetailSection title="Consent">
        {consent ? (
          <dl className="shadow-soft grid gap-3 rounded-[14px] bg-card p-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted-foreground">What was shared</dt>
              <dd className="mt-1 wrap-anywhere">{consent.data_shared.map((field) => field.replaceAll("_", " ")).join(", ") || "–"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">When</dt>
              <dd className="mt-1"><time dateTime={consent.given_at}>{formatDateTime(consent.given_at)}</time></dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Channel</dt>
              <dd className="mt-1 capitalize">{consent.channel}</dd>
            </div>
          </dl>
        ) : <EmptyState title="No consent yet" />}
      </DetailSection>
      <DetailSection title="Timeline" id={timelineId}>
        {ticket.events.length ? <Timeline events={ticket.events} /> : <EmptyState title="No events yet" />}
      </DetailSection>
      <div className="shadow-soft rounded-[14px] bg-card p-2">
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 w-full justify-start px-2"
          aria-expanded={showRaw}
          aria-controls={rawId}
          onClick={() => setShowRaw(!showRaw)}
        >
          <Code2 aria-hidden="true" className="size-4" />
          Raw JSON
        </Button>
        <pre id={rawId} hidden={!showRaw} tabIndex={0} aria-label="Raw ticket JSON" className="max-h-72 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs focus-visible:outline-2 focus-visible:outline-ring">
          {showRaw ? JSON.stringify(ticket, null, 2) : null}
        </pre>
      </div>
    </div>
  );
}

export function TicketSheet({ id, onClose, restoreFocus }: { id: string | null; onClose: () => void; restoreFocus: () => void }) {
  const ticket = useTicket(id);
  const bootstrap = useBootstrap();
  const companies = useCompanies();
  const error = ticket.error ?? bootstrap.error ?? companies.error;
  const unit = bootstrap.data?.units.find((entry) => entry.id === ticket.data?.unit_id);
  const property = bootstrap.data?.properties.find((entry) => entry.id === unit?.property_id);

  return (
    <Sheet open={id !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        className="gap-0 bg-background data-[side=right]:w-full data-[side=right]:sm:max-w-[620px]"
        showCloseButton={false}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          restoreFocus();
        }}
      >
        <SheetHeader className="glass relative shrink-0 gap-1 border-b px-5 py-4 pr-16">
          <SheetTitle className="text-xl font-semibold">Ticket details</SheetTitle>
          <SheetDescription className="wrap-anywhere">
            {unit ? [unit.label, property?.address].filter(Boolean).join(" · ") : "Repair request"}
          </SheetDescription>
          <SheetClose asChild>
            <Button type="button" variant="ghost" className="absolute top-2 right-2 size-11" aria-label="Close ticket details">
              <X aria-hidden="true" className="size-5" />
            </Button>
          </SheetClose>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-8 sm:px-5">
          {error ? (
            <ErrorBlock message={error.message} onRetry={() => void refreshAll()} />
          ) : !ticket.data || !companies.data || !bootstrap.data ? (
            <LoadingBlock />
          ) : (
            <TicketDetails key={ticket.data.id} ticket={ticket.data} companies={companies.data} bootstrap={bootstrap.data} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
