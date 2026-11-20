import { Badge } from "@/components/ui/badge";

export function PartnerPill({ isPartner }: { isPartner: boolean }) {
  const tone = isPartner
    ? "bg-primary/12 text-[#0055ad] dark:text-[#91c5ff]"
    : "bg-muted text-[#626269] dark:text-muted-foreground";

  return (
    <Badge variant="secondary" className={`h-auto rounded-full px-2.5 py-1 leading-tight ${tone}`}>
      {isPartner ? "Partner" : "Non-partner"}
    </Badge>
  );
}
