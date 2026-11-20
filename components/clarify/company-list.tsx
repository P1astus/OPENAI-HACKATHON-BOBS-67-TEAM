import { ChevronDown, LoaderCircle } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Money, PartnerPill, RatingMeter } from "@/components/index";
import { Button } from "@/components/ui/button";
import type { CompanyView } from "@/lib/api-client";
import type { RatingLabel, Ticket } from "@/types";
import { tradeLabels, tradesByLabel } from "./trades";

const ratingOrder: RatingLabel[] = ["good", "neutral", "new", "bad"];

export function CompanyList({ ticket, companies, disabled, assigning, onAssign }: {
  ticket: Ticket;
  companies: CompanyView[];
  disabled: boolean;
  assigning: string | null;
  onAssign: (company: CompanyView) => Promise<boolean>;
}) {
  const [confirmRow, setConfirmRow] = useState<string | null>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const headingId = useId();
  const promptId = useId();
  const byRank = [...companies].sort((a, b) =>
    Number(b.is_partner) - Number(a.is_partner)
    || ratingOrder.indexOf(a.rating.label) - ratingOrder.indexOf(b.rating.label)
    || a.name.localeCompare(b.name),
  );
  const candidates = new Map(ticket.candidates.map((candidate) => [candidate.company_id, candidate]));

  return (
    <section aria-labelledby={headingId} className="space-y-2">
      <h3 id={headingId} className="section-label font-medium">All companies by type of work</h3>
      {companies.length === 0 && <p className="text-sm text-muted-foreground">No active companies listed.</p>}
      {tradesByLabel.map((trade) => {
        const group = byRank.filter((company) => company.trades.includes(trade));
        if (!group.length) return null;
        return (
          <details key={trade} open={trade === ticket.triage?.trade} className="group rounded-[14px] border bg-card">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-[14px] px-3 font-medium focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
              {tradeLabels[trade]}
              <ChevronDown aria-hidden="true" className="size-4 text-muted-foreground group-open:rotate-180" />
            </summary>
            <ul className="divide-y border-t">
              {group.map((company) => {
                const row = `${trade}:${company.id}`;
                const confirming = confirmRow === row;
                const pending = assigning === company.id && confirming;
                const candidate = candidates.get(company.id);
                return (
                  <li key={company.id} className="flex flex-wrap items-center gap-3 p-3">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="font-semibold wrap-anywhere">{company.name}</p>
                        <PartnerPill isPartner={company.is_partner} />
                      </div>
                      <RatingMeter rating={company.rating} size="sm" />
                      <p className="flex flex-wrap gap-x-2 text-sm text-muted-foreground tabular-nums">
                        <span><Money value={company.hourly_rate_eur} />/hr</span>
                        {candidate && (
                          <>
                            <span>{candidate.distance_km.toFixed(1)} km</span>
                            <span><Money value={candidate.est_cost_eur} /> estimated</span>
                          </>
                        )}
                      </p>
                    </div>
                    <div className={confirming ? "flex w-full flex-wrap items-center gap-2 border-t pt-3" : "shrink-0"}>
                      {confirming && <p id={promptId} className="w-full text-sm wrap-anywhere">Assign {company.name}? The tenant gets times to choose from once the repair is approved.</p>}
                      <Button
                        type="button"
                        variant={confirming ? "default" : "secondary"}
                        className="min-h-11 px-4"
                        ref={confirming ? confirmButton : undefined}
                        aria-label={`${pending ? "Assigning" : confirming ? "Confirm assignment of" : "Assign"} ${company.name}`}
                        aria-describedby={confirming ? promptId : undefined}
                        disabled={disabled}
                        onClick={async () => {
                          if (!confirming) setConfirmRow(row);
                          else if (await onAssign(company)) setConfirmRow(null);
                        }}
                      >
                        {pending && <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />}
                        {pending ? "Assigning…" : confirming ? "Confirm assignment" : "Assign"}
                      </Button>
                      {confirming && (
                        <Button type="button" variant="ghost" className="min-h-11 px-4" disabled={disabled}
                          onClick={() => {
                            confirmButton.current?.focus();
                            setConfirmRow(null);
                          }}>
                          Cancel
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </details>
        );
      })}
    </section>
  );
}
