import { Mail, Phone } from "lucide-react";
import type { Consent, Person, TicketStatus } from "@/types";
import { formatDate } from "./format";
import { Button } from "./ui/button";

const linkClass = "inline-flex min-h-11 min-w-11 max-w-full items-center gap-2 rounded-md text-sm font-medium text-[#0055ad] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dark:text-[#91c5ff]";
const contactButtonClass = "h-11 rounded-full px-4";
const primaryContactButtonClass = `${contactButtonClass} dark:text-black hover:bg-[color-mix(in_oklch,var(--primary),black_10%)]!`;

export function ContactCard({
  name,
  phone,
  email,
  consent,
}: {
  name: string;
  phone: string;
  email: string;
  consent: Consent | null;
}) {
  return (
    <div className="shadow-soft rounded-[14px] bg-card p-4 text-card-foreground">
      <p className="font-semibold">{name}</p>
      {consent ? (
        <>
          <div className="mt-1 flex flex-wrap gap-x-4">
            <a className={linkClass} href={`tel:${phone.replace(/[\s().-]/g, "")}`}>
              <Phone aria-hidden="true" className="size-4 shrink-0" />
              <span className="wrap-anywhere">{phone}</span>
            </a>
            <a className={linkClass} href={`mailto:${email}`}>
              <Mail aria-hidden="true" className="size-4 shrink-0" />
              <span className="wrap-anywhere">{email}</span>
            </a>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Shared on <time dateTime={consent.given_at}>{formatDate(consent.given_at)}</time> via {consent.channel}
          </p>
        </>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">Contact shared after the tenant confirms</p>
      )}
    </div>
  );
}

export function TenantContactCard({ tenant, status, claim, unitLabel, senderName }: {
  tenant: Person;
  status: TicketStatus;
  claim: string;
  unitLabel: string;
  senderName: string;
}) {
  const firstName = tenant.name.trim().split(/\s+/)[0];
  const emergency = status === "emergency";
  const needsHuman = status === "needs_human";
  const subject = encodeURIComponent(`Your repair request at ${unitLabel}`);
  const body = encodeURIComponent(
    `Hi ${firstName}, about your request: "${claim}". Could you tell us a bit more about what exactly is wrong and where? Thanks, ${senderName}`,
  );

  return (
    <section aria-label="Contact the tenant" className="shadow-soft space-y-3 rounded-[14px] border bg-card p-4 text-card-foreground">
      <h3 className="font-semibold">Contact the tenant</h3>
      <div>
        <p className="text-sm font-medium wrap-anywhere">{tenant.name}</p>
        <p className="flex flex-wrap gap-x-3 text-sm text-muted-foreground">
          <span>{tenant.phone}</span>
          <span className="min-w-0 wrap-anywhere">{tenant.email}</span>
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant={emergency ? "default" : "secondary"} className={emergency ? primaryContactButtonClass : contactButtonClass}>
          <a href={`tel:${tenant.phone.replace(/[\s().-]/g, "")}`}>
            <Phone aria-hidden="true" /> Call {firstName}
          </a>
        </Button>
        <Button asChild variant={needsHuman ? "default" : "secondary"} className={needsHuman ? primaryContactButtonClass : contactButtonClass}>
          <a href={`mailto:${tenant.email}?subject=${subject}&body=${body}`}>
            <Mail aria-hidden="true" /> Email {firstName}
          </a>
        </Button>
      </div>
      {emergency && <p className="text-sm text-muted-foreground">Possible emergency. Call {firstName} now.</p>}
      {needsHuman && (
        <p className="text-sm text-muted-foreground">
          Our assistant couldn&apos;t tell what&apos;s wrong. Ask {firstName} for details; reltix assigns a company once it&apos;s clear.
        </p>
      )}
    </section>
  );
}
