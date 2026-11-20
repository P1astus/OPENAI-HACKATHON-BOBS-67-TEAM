const euro = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

export function formatMoney(n: number): string {
  return euro.format(n);
}

export function Money({ value, className }: { value: number; className?: string }) {
  return <span className={className}>{formatMoney(value)}</span>;
}
