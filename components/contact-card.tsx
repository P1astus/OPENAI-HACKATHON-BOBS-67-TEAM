import { Mail, Phone } from "lucide-react";
import type { Consent } from "@/types";
import { formatDate } from "./format";

const linkClass = "inline-flex min-h-11 min-w-11 max-w-full items-center gap-2 rounded-md text-sm font-medium text-[#0055ad] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dark:text-[#91c5ff]";

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
