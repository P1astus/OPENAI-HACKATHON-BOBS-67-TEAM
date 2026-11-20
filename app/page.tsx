import { ChevronRight } from "lucide-react";
import Link from "next/link";

const views = [
  { name: "Tenant", href: "/tenant?as=p_lena" },
  { name: "Partner", href: "/partner?as=c_warmhaus" },
  { name: "Owner", href: "/owner?as=p_maria" },
  { name: "Admin", href: "/admin" },
];

export default function Home() {
  return (
    <main className="fade-in mx-auto w-full max-w-2xl px-6 py-16 sm:py-24">
      <h1 className="large-title leading-tight">centrix Fix</h1>
      <p className="mt-2 text-muted-foreground">Repair matching for centrix</p>

      <nav aria-label="Demo views" className="mt-8">
        <ul className="grid gap-3 sm:grid-cols-2">
          {views.map(({ name, href }) => (
            <li key={href}>
              <Link
                href={href}
                prefetch={false}
                className="shadow-soft flex items-center justify-between gap-4 rounded-xl border bg-card p-5 font-medium text-card-foreground transition-colors hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {name}
                <ChevronRight aria-hidden="true" className="size-4 text-primary" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}
