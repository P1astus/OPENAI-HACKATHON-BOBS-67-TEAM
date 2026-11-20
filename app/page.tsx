import { ChevronRight, Home, LayoutDashboard, Smartphone, Wrench } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/index";
import { ResetDemoButton } from "./admin/_components/reset-demo-button";

const views = [
  { name: "Tenant", description: "Lena Hoffmann · reports a problem", href: "/tenant?as=p_lena", icon: Smartphone },
  { name: "Partner", description: "WarmHaus Heizungstechnik · gets the job", href: "/partner?as=c_warmhaus", icon: Wrench },
  { name: "Owner", description: "Maria Becker · approves repairs and sees wallet payments", href: "/owner?as=p_maria", icon: Home },
  { name: "Operations", description: "reltix property manager", href: "/admin", icon: LayoutDashboard },
];

export default function HomePage() {
  return (
    <>
      <PageHeader
        title="centrix Fix"
        subtitle={<p className="max-w-xl leading-relaxed">Report a repair, book a company and pay from the owner’s centrix wallet.</p>}
      />
      <main className="fade-in mx-auto w-full max-w-7xl px-4 pt-2 pb-12 sm:px-6">
        <nav aria-label="Demo views">
          <ul className="grid gap-4 sm:grid-cols-2">
            {views.map(({ name, description, href, icon: Icon }) => (
              <li key={href} className="min-w-0">
                <Link
                  href={href}
                  prefetch={false}
                  className="group shadow-soft flex h-full min-h-32 items-center gap-4 rounded-[14px] border border-transparent bg-card px-5 py-6 transition-colors hover:border-primary/35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:min-h-40 sm:px-7"
                >
                  <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Icon aria-hidden="true" className="size-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xl font-semibold tracking-tight">{name}</span>
                    <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{description}</span>
                  </span>
                  <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-5">
          <ResetDemoButton />
        </div>
      </main>
    </>
  );
}
