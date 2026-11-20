import { RotateCcw } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { resetDemo } from "@/lib/api-client";

export function DemoReset({ onReset }: { onReset: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const restoreFocus = useRef(false);
  const focusTrigger = useCallback((button: HTMLButtonElement | null) => {
    if (button && restoreFocus.current) {
      button.focus();
      restoreFocus.current = false;
    }
  }, []);
  const focusCancel = useCallback((button: HTMLButtonElement | null) => {
    button?.focus();
  }, []);

  function closeConfirmation() {
    restoreFocus.current = true;
    setConfirming(false);
    setError("");
  }

  async function reset() {
    setError("");
    setPending(true);
    try {
      await resetDemo();
      onReset();
      closeConfirmation();
    } catch {
      setError("Couldn’t reset the demo. Try again.");
    } finally {
      setPending(false);
    }
  }

  return confirming ? (
    <div className="relative flex items-center justify-end gap-1.5" role="group" aria-label="Confirm demo reset">
      <span className="mr-1 whitespace-nowrap text-xs font-medium">Reset demo data?</span>
      <Button type="button" variant="destructive" onClick={reset} disabled={pending}>
        {pending ? "Resetting…" : "Reset"}
      </Button>
      <Button ref={focusCancel} type="button" variant="ghost" onClick={closeConfirmation} disabled={pending}>
        Cancel
      </Button>
      {error && (
        <p role="alert" className="shadow-soft absolute top-full right-0 mt-2 w-max rounded-lg bg-card p-2 text-xs text-foreground">
          {error}
        </p>
      )}
    </div>
  ) : (
    <Button ref={focusTrigger} type="button" variant="outline" onClick={() => setConfirming(true)}>
      <RotateCcw aria-hidden="true" />
      Reset demo
    </Button>
  );
}
