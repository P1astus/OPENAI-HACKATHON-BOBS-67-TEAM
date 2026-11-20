"use client";

import { LoaderCircle, RotateCcw } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { resetDemo } from "@/lib/api-client";
import { refreshAll } from "@/lib/hooks";

export function ResetDemoButton() {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const restoreFocus = useRef(false);

  function closeConfirmation() {
    restoreFocus.current = true;
    setConfirming(false);
  }

  async function reset() {
    setPending(true);
    try {
      await resetDemo();
      await refreshAll();
      toast.success("Demo data reset.");
      closeConfirmation();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn’t reset the demo.");
    } finally {
      setPending(false);
    }
  }

  if (!confirming) {
    return (
      <Button
        ref={(button) => {
          if (button && restoreFocus.current) {
            button.focus();
            restoreFocus.current = false;
          }
        }}
        type="button"
        variant="ghost"
        className="min-h-11 px-3 text-muted-foreground"
        onClick={() => setConfirming(true)}
      >
        <RotateCcw aria-hidden="true" className="size-4" />
        Reset demo
      </Button>
    );
  }

  return (
    <div
      role="group"
      aria-label="Reset all demo data?"
      className="flex flex-wrap items-center gap-x-2 gap-y-0"
    >
      <span className="text-sm font-medium">Reset all demo data?</span>
      <div className="flex items-center gap-1">
        <Button type="button" variant="destructive" className="min-h-11 min-w-11 px-3" onClick={reset} disabled={pending}>
          {pending && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
          {pending ? "Resetting…" : "Reset"}
        </Button>
        <Button
          ref={(button) => { button?.focus(); }}
          type="button"
          variant="ghost"
          className="min-h-11 px-3"
          onClick={closeConfirmation}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
