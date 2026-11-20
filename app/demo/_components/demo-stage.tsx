"use client";

import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Monitor,
} from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { DemoPane } from "./demo-pane";
import { DemoReset } from "./demo-reset";

const panes = [
  { id: "tenant", label: "Tenant · Lena Hoffmann", href: "/tenant?as=p_lena", width: 390, layout: "row-span-2" },
  { id: "partner", label: "Partner · WarmHaus Heizungstechnik", href: "/partner?as=c_warmhaus", width: 1024, layout: "" },
  { id: "owner", label: "Owner · Maria Becker", href: "/owner?as=p_maria", width: 1024, layout: "" },
  { id: "admin", label: "reltix Operations", href: "/admin", width: 1280, layout: "col-span-2" },
] as const;

type PaneId = (typeof panes)[number]["id"];

const steps: { pane: PaneId; hint: string }[] = [
  { pane: "tenant", hint: "Lena reports: the heating is cold" },
  { pane: "admin", hint: "AI triage reads it, the formula picks the best partner" },
  { pane: "tenant", hint: "Lena picks a time and shares her contact" },
  { pane: "partner", hint: "WarmHaus accepts, does the job, sends the invoice" },
  { pane: "owner", hint: "Paid from Maria’s centrix wallet" },
  { pane: "tenant", hint: "Lena rates the repair, WarmHaus’ score updates" },
];

const wideScreen = "(min-width: 1200px)";

function subscribeToWidth(callback: () => void) {
  const query = window.matchMedia(wideScreen);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function isWideScreen() {
  return window.matchMedia(wideScreen).matches;
}

export function DemoStage() {
  const wide = useSyncExternalStore(subscribeToWidth, isWideScreen, () => false);
  const [stepIndex, setStepIndex] = useState(0);
  const [focused, setFocused] = useState<PaneId | null>(null);
  const [frameVersion, setFrameVersion] = useState(0);
  const step = steps[stepIndex];

  function handleReset() {
    setFrameVersion((version) => version + 1);
    setFocused(null);
    setStepIndex(0);
  }

  return (
    <div className="flex min-h-dvh flex-col min-[1200px]:h-dvh min-[1200px]:overflow-hidden">
      <header className="glass sticky top-0 z-10 grid shrink-0 grid-cols-[1fr_auto] items-center gap-x-4 border-b px-4 py-3 min-[1200px]:grid-cols-[1fr_auto_1fr] min-[1200px]:px-6">
        <h1 className="text-sm font-semibold">
          centrix Fix <span className="font-medium text-muted-foreground">· live demo</span>
        </h1>
        <nav aria-label="Presenter steps" className="col-span-2 row-start-2 mt-3 flex items-center justify-center gap-2 min-[1200px]:col-span-1 min-[1200px]:col-start-2 min-[1200px]:row-start-1 min-[1200px]:mt-0">
          <Button
            type="button"
            variant="ghost"
            disabled={stepIndex === 0}
            onClick={() => setStepIndex((index) => index - 1)}
          >
            <ChevronLeft aria-hidden="true" />
            Back
          </Button>
          <p aria-live="polite" className="text-center text-sm font-semibold min-[1200px]:w-[390px]">
            {step.hint}
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={stepIndex === steps.length - 1}
            onClick={() => setStepIndex((index) => index + 1)}
          >
            Next
            <ChevronRight aria-hidden="true" />
          </Button>
        </nav>
        <div className="col-start-2 row-start-1 justify-self-end min-[1200px]:col-start-3">
          <DemoReset onReset={handleReset} />
        </div>
      </header>

      {wide ? (
        <main aria-label="Live repair views" className="grid min-h-0 flex-1 grid-cols-[clamp(270px,21vw,400px)_repeat(2,minmax(0,1fr))] grid-rows-2 gap-4 px-5 pt-4 pb-5 min-[1600px]:gap-6 min-[1600px]:px-7">
          {panes.map(({ id, label, href, width, layout }) => {
            const phone = id === "tenant";
            const isFocused = focused === id;
            return (
              <DemoPane
                key={`${id}-${frameVersion}`}
                label={label}
                src={`${href}${href.includes("?") ? "&" : "?"}embed=1`}
                width={width}
                phone={phone}
                current={step.pane === id}
                focused={isFocused}
                hidden={focused !== null && !isFocused && !phone}
                className={isFocused ? (phone ? "col-span-3 row-span-2" : "col-span-2 row-span-2") : layout}
                onToggleFocus={() => setFocused((pane) => pane === id ? null : id)}
              />
            );
          })}
        </main>
      ) : (
        <main className="mx-auto w-full max-w-md px-5 py-14 min-[1200px]:hidden">
          <div className="shadow-soft rounded-2xl border bg-card p-6">
            <Monitor aria-hidden="true" className="mb-4 size-6 text-primary" />
            <h2 className="large-title leading-tight">Open on a wide screen</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              See all four live views together, or open a view below.
            </p>
            <ul className="mt-5 divide-y border-t">
              {panes.map(({ id, label, href }) => (
                <li key={id}>
                  <a href={href} className="flex items-center justify-between gap-2 rounded-md py-3 text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary">
                    {label}
                    <ArrowUpRight aria-hidden="true" className="size-4 shrink-0" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </main>
      )}
    </div>
  );
}
