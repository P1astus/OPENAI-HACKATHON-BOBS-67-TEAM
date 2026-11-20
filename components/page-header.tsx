import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <>
      <header className="glass sticky top-0 z-20">
        <div className="mx-auto flex min-h-14 w-full max-w-7xl items-center justify-between gap-3 px-4 py-1 sm:px-6">
          <Link
            href="/"
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center rounded-md text-sm font-semibold tracking-tight hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            centrix Fix
          </Link>
          {right != null && <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">{right}</div>}
        </div>
      </header>
      <div className="mx-auto w-full max-w-7xl px-4 pt-6 pb-5 sm:px-6 sm:pt-9">
        <h1 className="large-title leading-tight wrap-anywhere">{title}</h1>
        {subtitle != null && <div className="mt-2 text-muted-foreground">{subtitle}</div>}
      </div>
    </>
  );
}
