import type { CompanyRating, RatingLabel } from "@/types";
import { Badge } from "@/components/ui/badge";

const labels: Record<RatingLabel, string> = {
  good: "Good",
  neutral: "Neutral",
  bad: "Bad",
  new: "New",
};

export function RatingMeter({
  rating,
  size = "sm",
}: {
  rating: CompanyRating;
  size?: "sm" | "lg";
}) {
  const score = rating.label === "new" ? null : rating.score;
  const label = labels[rating.label];
  const reviewCount = score === null
    ? `${rating.review_count} of 5 reviews`
    : `${rating.review_count} ${rating.review_count === 1 ? "review" : "reviews"}`;
  const large = size === "lg";

  return (
    <div className={large ? "space-y-3" : "space-y-2"}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className={large ? "text-xl font-semibold" : "text-sm font-semibold"}>{label}</span>
        <span className="text-sm text-muted-foreground">{reviewCount}</span>
      </div>
      <div
        className={`flex items-center rounded-full bg-linear-to-r from-destructive/35 via-muted to-success/45 ${large ? "h-2.5" : "h-1.5"}`}
        role={score === null ? undefined : "meter"}
        aria-hidden={score === null ? true : undefined}
        aria-label={score === null ? undefined : "Company rating score"}
        aria-valuemin={score === null ? undefined : -1}
        aria-valuemax={score === null ? undefined : 1}
        aria-valuenow={score ?? undefined}
      >
        {score !== null && (
          <div className="relative mx-[7px] flex grow items-center">
            <span
              aria-hidden="true"
              className={`absolute -translate-x-1/2 rounded-full border-2 border-card bg-foreground ${large ? "size-3.5" : "size-3"}`}
              style={{ left: `${((score + 1) / 2) * 100}%` }}
            />
          </div>
        )}
      </div>
      {rating.potential_partner && (
        <Badge variant="secondary" className="h-auto rounded-full bg-primary/12 px-2.5 py-1 leading-tight text-[#0055ad] dark:text-[#91c5ff]">
          Potential partner
        </Badge>
      )}
    </div>
  );
}
