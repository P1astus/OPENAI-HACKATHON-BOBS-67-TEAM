"use client";

import { Button } from "@/components/ui/button";

export function FilterChips<Value extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: Value; label: string }[];
  value: Value | null;
  onChange: (value: Value) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          variant="outline"
          aria-pressed={option.value === value}
          className="min-h-11 min-w-11 rounded-full bg-card px-3 text-xs aria-pressed:border-primary/30 aria-pressed:bg-primary/10 aria-pressed:text-primary"
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
