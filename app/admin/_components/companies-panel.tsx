"use client";

import { Building2, ShieldBan } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, ErrorBlock, GroupedList, LoadingBlock, Money, PartnerPill, RatingMeter } from "@/components/index";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CompanyView } from "@/lib/api-client";
import { useCompanies } from "@/lib/hooks";

type DirectoryView = "companies" | "partners" | "potential" | "blacklist";

const directories: Record<DirectoryView, { includes: (company: CompanyView) => boolean; empty: string }> = {
  companies: { includes: () => true, empty: "No companies yet" },
  partners: { includes: (company) => company.is_partner, empty: "No partners yet" },
  potential: { includes: (company) => company.rating.potential_partner, empty: "No potential partners yet" },
  blacklist: { includes: (company) => company.status === "blacklisted", empty: "No blacklisted companies" },
};

function CompanyRow({ company, view }: { company: CompanyView; view: Exclude<DirectoryView, "blacklist"> }) {
  const active = company.status === "active";
  return (
    <div className="grid items-center gap-x-6 gap-y-4 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:px-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(9rem,1fr)]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold wrap-anywhere">{company.name}</h3>
          <PartnerPill isPartner={company.is_partner} />
        </div>
        <p className="mt-1 text-sm capitalize text-muted-foreground">{company.trades.map((trade) => trade.replaceAll("_", " ")).join(", ") || "–"}</p>
      </div>
      <div className="min-w-0 [&_.bg-linear-to-r]:bg-muted [&_.bg-linear-to-r]:bg-none">
        <RatingMeter rating={company.rating} size="sm" />
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 sm:col-span-2 lg:col-span-1 lg:justify-end lg:text-right">
        <Badge variant="secondary" className={`h-auto rounded-full px-2.5 py-1 ${active ? "bg-success/14 text-[#166534] dark:text-[#a0e6b0]" : "bg-destructive/12 text-[#a51d18] dark:text-[#ffafa8]"}`}>
          {active ? "Active" : "Blacklisted"}
        </Badge>
        {view === "partners" && (
          <p className="text-sm text-muted-foreground">
            <Money value={company.hourly_rate_eur} />/hr · <span className="capitalize">{company.booking}</span>
          </p>
        )}
        {view === "potential" && (
          <>
            <p className="text-sm text-muted-foreground">
              {company.rating.above6_count} reviews above 6 · score {company.rating.score?.toFixed(2) ?? "–"}
            </p>
            <Button
              type="button"
              variant="secondary"
              className="min-h-11 px-4"
              aria-label={`Approach ${company.name}`}
              onClick={() => toast.info(`Outreach preview for ${company.name}.`)}
            >
              Approach
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function BlacklistRow({ company }: { company: CompanyView }) {
  const recent = [...company.reviews]
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .slice(0, 5);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
      <div className="min-w-0">
        <h3 className="text-base font-semibold wrap-anywhere">{company.name}</h3>
        <p className="mt-1 text-sm text-muted-foreground">Removed automatically: score below −0.3 after 5+ reviews.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm tabular-nums">Score <strong>{company.rating.score?.toFixed(2) ?? "–"}</strong></p>
        <ul aria-label="Last five ratings, most recent first" className="flex flex-wrap gap-1">
          {recent.map((review) => (
            <li key={review.ticket_id}>
              <Badge variant="secondary" className="h-6 min-w-6 justify-center rounded-full tabular-nums">{review.rating}</Badge>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function CompaniesPanel({ view }: { view: DirectoryView }) {
  const { data, error, mutate } = useCompanies();
  if (error) return <ErrorBlock message={error.message} onRetry={() => void mutate()} />;
  if (!data) return <LoadingBlock />;

  const directory = directories[view];
  const companies = data.filter(directory.includes).sort(
    (a, b) => (b.rating.score ?? -Infinity) - (a.rating.score ?? -Infinity) || a.name.localeCompare(b.name),
  );

  if (!companies.length) {
    return <EmptyState icon={view === "blacklist" ? <ShieldBan /> : <Building2 />} title={directory.empty} />;
  }

  return (
    <GroupedList>
      {companies.map((company) => view === "blacklist"
        ? <BlacklistRow key={company.id} company={company} />
        : <CompanyRow key={company.id} company={company} view={view} />)}
    </GroupedList>
  );
}
