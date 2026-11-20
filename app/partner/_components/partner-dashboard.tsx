"use client";

import { CalendarDays, ChartColumn, CircleHelp, ClipboardCheck, Star } from "lucide-react";
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader, RatingMeter } from "@/components/index";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCompanies, useViewer } from "@/lib/hooks";
import { PartnerBalance } from "./partner-balance";
import { DoneJobs, PartnerJobs } from "./partner-jobs";
import { PartnerReviews, PartnerSupport } from "./partner-relations";

const tabs = [
  { title: "Jobs", value: "jobs", icon: CalendarDays },
  { title: "Done", value: "done", icon: ClipboardCheck },
  { title: "Balance", value: "balance", icon: ChartColumn },
  { title: "Reviews", value: "reviews", icon: Star },
  { title: "Support", value: "support", icon: CircleHelp },
];

export function PartnerDashboard() {
  const viewer = useViewer("c_warmhaus");
  const companies = useCompanies();
  const company = companies.data?.find(({ id }) => id === viewer);

  return (
    <>
      <PageHeader
        title={company?.name ?? "Company"}
        subtitle={company?.is_partner ? "Partner of centrix" : "Company"}
        right={company && <div className="w-35 py-2 sm:w-52 [&_.bg-linear-to-r]:bg-muted [&_.bg-linear-to-r]:bg-none"><RatingMeter rating={company.rating} size="lg" /></div>}
      />
      <main className="fade-in mx-auto w-full max-w-5xl px-4 pb-12 sm:px-6">
        {companies.error ? <ErrorBlock message={companies.error.message} onRetry={() => void companies.mutate()} />
          : !companies.data ? <LoadingBlock />
          : !company ? <EmptyState title="Company unavailable" description="No company matches this viewer." />
          : (
            <Tabs key={viewer} defaultValue="jobs" className="gap-5">
              <TabsList aria-label="Company dashboard" className="grid w-full grid-cols-5 group-data-horizontal/tabs:h-auto sm:w-fit">
                {tabs.map(({ title, value, icon: Icon }) => (
                  <TabsTrigger key={value} value={value} className="min-h-11 min-w-11 px-1 text-xs data-active:bg-card sm:px-4 sm:text-sm">
                    <Icon aria-hidden="true" className="hidden sm:block" />
                    {title}
                  </TabsTrigger>
                ))}
              </TabsList>
              <TabsContent value="jobs"><PartnerJobs companyId={company.id} /></TabsContent>
              <TabsContent value="done"><DoneJobs companyId={company.id} /></TabsContent>
              <TabsContent value="balance"><PartnerBalance companyId={company.id} /></TabsContent>
              <TabsContent value="reviews"><PartnerReviews company={company} /></TabsContent>
              <TabsContent value="support"><PartnerSupport /></TabsContent>
            </Tabs>
          )}
      </main>
    </>
  );
}
