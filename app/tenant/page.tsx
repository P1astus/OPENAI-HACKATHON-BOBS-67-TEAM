import { Suspense } from "react";
import { LoadingBlock, PageHeader } from "@/components/index";
import { TenantView } from "./_components/tenant-view";

export default function TenantPage() {
  return (
    <Suspense fallback={
      <div className="mx-auto w-full max-w-[430px]">
        <PageHeader title="Your repairs" />
        <main className="px-4"><LoadingBlock /></main>
      </div>
    }>
      <TenantView />
    </Suspense>
  );
}
