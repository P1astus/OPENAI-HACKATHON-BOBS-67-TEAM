"use client";

import { LifeBuoy, Star } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { EmptyState, GroupedList, GroupedRow, RatingMeter, formatDate } from "@/components/index";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { CompanyView } from "@/lib/api-client";

export function PartnerReviews({ company }: { company: CompanyView }) {
  const { rating } = company;
  const reviews = [...company.reviews].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));

  return (
    <section aria-labelledby="reviews-heading" className="space-y-4">
      <h2 id="reviews-heading" className="section-label font-medium">Tenant reviews</h2>
      <div className="shadow-soft grid gap-6 rounded-[14px] bg-card p-5 sm:grid-cols-2 sm:p-6 [&_.bg-linear-to-r]:bg-muted [&_.bg-linear-to-r]:bg-none">
        <RatingMeter rating={rating} size="lg" />
        <dl className="grid grid-cols-3 gap-2 border-t pt-4 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6">
          {[
            { label: "Total", value: rating.review_count },
            { label: "Good", value: rating.good_count },
            { label: "Bad", value: rating.bad_count },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col-reverse">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
      {reviews.length ? (
        <GroupedList>
          {reviews.map((review) => (
            <div key={review.ticket_id} className="flex items-center gap-4 px-4 py-3 sm:px-5">
              <span className="w-12 shrink-0 font-semibold tabular-nums">{review.rating}/10</span>
              <progress
                aria-label="Tenant rating out of 10"
                max={10}
                value={review.rating}
                className="h-1.5 w-full max-w-40 overflow-hidden rounded-full bg-muted [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-primary"
              />
              <time dateTime={review.created_at} className="ml-auto shrink-0 text-sm text-muted-foreground">{formatDate(review.created_at)}</time>
            </div>
          ))}
        </GroupedList>
      ) : <EmptyState icon={<Star className="size-5" />} title="No reviews yet" description="Tenant ratings will appear after completed jobs." />}
    </section>
  );
}

export function PartnerSupport() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);

  return (
    <section aria-labelledby="support-heading" className="space-y-3">
      <h2 id="support-heading" className="section-label font-medium">Partner support</h2>
      <GroupedList>
        <GroupedRow icon={<LifeBuoy className="size-4" />} title="Contact centrix partner support" chevron onClick={(event) => { trigger.current = event.currentTarget; setOpen(true); }} />
      </GroupedList>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent showCloseButton={false} onCloseAutoFocus={(event) => { event.preventDefault(); trigger.current?.focus(); }} className="data-[side=right]:w-full data-[side=right]:sm:max-w-md">
          <SheetHeader className="p-5">
            <SheetTitle>Contact centrix partner support</SheetTitle>
            <SheetDescription>Use this demo form to preview contacting partner support.</SheetDescription>
          </SheetHeader>
          <form className="space-y-4 px-5" onSubmit={(event) => {
            event.preventDefault();
            if (!message.trim()) return;
            setMessage("");
            setOpen(false);
            toast.success("Support message submitted in the demo");
          }}>
            <div className="space-y-2">
              <label htmlFor="support-message" className="font-medium">Message</label>
              <Textarea id="support-message" required rows={5} value={message}
                onChange={(event) => setMessage(event.target.value)} placeholder="How can we help?" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" className="min-h-11" disabled={!message.trim()}>Send message</Button>
              <SheetClose asChild><Button type="button" variant="secondary" className="min-h-11">Cancel</Button></SheetClose>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </section>
  );
}
