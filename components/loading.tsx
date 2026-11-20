"use client";

import { Button } from "@/components/ui/button";

export function LoadingBlock({ lines = 3 }: { lines?: number }) {
  return (
    <div role="status" className="shadow-soft rounded-[14px] bg-card p-4 sm:p-5">
      <span className="sr-only">Loading…</span>
      <div aria-hidden="true" className="space-y-3 motion-safe:animate-pulse">
        {Array.from({ length: lines }, (_, index) => (
          <div
            key={index}
            className={`h-3 rounded-full bg-muted ${index === 0 ? "w-2/5" : "w-full"}`}
          />
        ))}
      </div>
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="shadow-soft flex flex-wrap items-center justify-between gap-3 rounded-[14px] bg-card p-4 text-card-foreground sm:p-5">
      <p role="alert" className="min-w-0 text-sm font-medium wrap-anywhere text-[#a51d18] dark:text-[#ffafa8]">{message}</p>
      {onRetry && (
        <Button type="button" variant="secondary" className="min-h-11 min-w-11 px-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
