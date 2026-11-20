import { Suspense } from "react";
import { LoadingBlock, PageHeader } from "@/components/index";
import { OperationsTabs } from "./_components/operations-tabs";
import { ResetDemoButton } from "./_components/reset-demo-button";

export default function AdminPage() {
  return (
    <>
      <PageHeader
        title="Operations"
        subtitle="centrix Fix · all properties"
        right={<ResetDemoButton />}
      />
      <main className="fade-in mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6">
        <Suspense fallback={<LoadingBlock />}>
          <OperationsTabs />
        </Suspense>
      </main>
    </>
  );
}
