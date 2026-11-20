import { Suspense } from "react";
import { LoadingBlock } from "@/components/loading";
import { PageHeader } from "@/components/page-header";
import { OwnerDashboard } from "./_components/owner-dashboard";

export default function OwnerPage() {
  return (
    <Suspense fallback={
      <>
        <PageHeader title="Your properties" />
        <main className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6"><LoadingBlock /></main>
      </>
    }>
      <OwnerDashboard />
    </Suspense>
  );
}
