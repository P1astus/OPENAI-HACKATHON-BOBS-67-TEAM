"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export function TenantSheet({
  open, onClose, restoreFocus, title, description, busy = false, children,
}: {
  open: boolean;
  onClose: () => void;
  restoreFocus: () => void;
  title: string;
  description: string;
  busy?: boolean;
  children: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next && !busy) onClose(); }}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="mx-auto max-h-[calc(100dvh-1rem)] max-w-[460px] gap-0 overflow-hidden rounded-t-3xl sm:max-h-[88dvh]"
        onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }}
        onInteractOutside={(event) => { if (busy) event.preventDefault(); }}
        onCloseAutoFocus={(event) => { event.preventDefault(); restoreFocus(); }}
      >
        <SheetHeader className="shrink-0 gap-1 border-b px-5 pt-5 pb-3 pr-16">
          <SheetTitle className="text-xl font-semibold tracking-tight">{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <SheetClose asChild>
          <Button variant="ghost" size="icon" type="button" disabled={busy} className="absolute top-2 right-2 size-11 rounded-full" aria-label="Close">
            <X aria-hidden="true" />
          </Button>
        </SheetClose>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
