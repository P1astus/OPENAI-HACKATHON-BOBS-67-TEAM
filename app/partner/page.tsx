import { Suspense } from "react";
import { LoadingBlock } from "@/components/loading";
import { PageHeader } from "@/components/page-header";
import { PartnerDashboard } from "./_components/partner-dashboard";

export default function PartnerPage() {
  return (
    <Suspense fallback={
      <>
        <PageHeader title="Company" />
        <main className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6"><LoadingBlock /></main>
      </>
    }>
      <PartnerDashboard />
    </Suspense>
  );
}
