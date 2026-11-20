"use client";

import { ChartColumn } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { EmptyState, ErrorBlock, LoadingBlock, Money, formatMoney } from "@/components/index";
import {
  ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig,
} from "@/components/ui/chart";
import { useCompanyBalance } from "@/lib/hooks";

const config = {
  earned_eur: { label: "Earned", color: "var(--chart-1)" },
  paid_eur: { label: "Paid", color: "var(--chart-2)" },
  outstanding_eur: { label: "Outstanding", color: "var(--chart-4)" },
} satisfies ChartConfig;

const monthName = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });
const fullMonth = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

function formatMonth(month: string, formatter: Intl.DateTimeFormat) {
  return formatter.format(new Date(`${month}-01T00:00:00Z`));
}

export function PartnerBalance({ companyId }: { companyId: string }) {
  const balance = useCompanyBalance(companyId);
  const current = balance.data?.months.at(-1);

  return (
    <section aria-labelledby="balance-heading" className="space-y-4">
      <h2 id="balance-heading" className="section-label font-medium">
        {current ? formatMonth(current.month, fullMonth) : "Monthly balance"}
      </h2>
      {balance.error ? <ErrorBlock message={balance.error.message} onRetry={() => void balance.mutate()} />
        : !balance.data ? <LoadingBlock />
        : !current ? <EmptyState icon={<ChartColumn className="size-5" />} title="No balance history" description="Monthly invoice balances will appear here." />
        : (
          <>
            <dl className="grid gap-3 sm:grid-cols-3">
              {Object.entries(config).map(([key, { label }]) => (
                <div key={key} className="shadow-soft rounded-[14px] bg-card p-4 sm:p-5">
                  <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
                  <dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
                    <Money value={current[key as keyof typeof config]} />
                  </dd>
                </div>
              ))}
            </dl>
            <div className="shadow-soft min-w-0 rounded-[14px] bg-card p-4 sm:p-6">
              <h3 className="mb-4 text-base font-semibold">Last six months</h3>
              <ChartContainer config={config} className="aspect-auto h-60 w-full sm:h-72">
                <BarChart accessibilityLayer data={balance.data.months} maxBarSize={26} barGap={3}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="month" tickFormatter={(month) => formatMonth(month, monthName)} axisLine={false} tickLine={false} tickMargin={8} />
                  <ChartTooltip content={<ChartTooltipContent
                    labelFormatter={(month) => formatMonth(String(month), fullMonth)}
                    formatter={(value, name) => (
                      <div className="flex w-full items-center justify-between gap-4">
                        <span>{config[name as keyof typeof config]?.label}</span>
                        <span className="font-medium tabular-nums">{formatMoney(Number(value))}</span>
                      </div>
                    )}
                  />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  {Object.keys(config).map((key) => <Bar key={key} dataKey={key} fill={`var(--color-${key})`} radius={[4, 4, 0, 0]} isAnimationActive={false} />)}
                </BarChart>
              </ChartContainer>
            </div>
            <p className="text-sm text-muted-foreground">centrix takes no commission. You receive the full amount.</p>
          </>
        )}
    </section>
  );
}
