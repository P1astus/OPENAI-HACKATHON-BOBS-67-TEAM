"use client";

import { ChevronRight } from "lucide-react";
import type { MouseEventHandler, ReactNode } from "react";

export function GroupedList({
  title,
  children,
  footer,
}: {
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div>
      {title != null && <div className="section-label mb-2 px-4 font-medium">{title}</div>}
      <div className="shadow-soft overflow-hidden rounded-[14px] bg-card text-card-foreground [&>*+*]:relative [&>*+*]:before:pointer-events-none [&>*+*]:before:absolute [&>*+*]:before:inset-s-4 [&>*+*]:before:inset-e-0 [&>*+*]:before:top-0 [&>*+*]:before:border-t [&>*+*]:before:border-border">
        {children}
      </div>
      {footer != null && <div className="mt-2 px-4 text-sm text-muted-foreground">{footer}</div>}
    </div>
  );
}

export function GroupedRow({
  icon,
  title,
  subtitle,
  value,
  href,
  onClick,
  chevron = false,
  children,
}: {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  value?: ReactNode;
  href?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  chevron?: boolean;
  children?: ReactNode;
}) {
  const row = "flex min-h-11 w-full items-center gap-3 px-4 py-2 text-start text-sm";
  const interactive = `${row} cursor-pointer hover:bg-muted/55 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring`;
  const content = (
    <>
      {icon != null && <span aria-hidden="true" className="shrink-0 text-muted-foreground">{icon}</span>}
      <span className="min-w-0 flex-1 wrap-anywhere">
        <span className="block font-medium">{title}</span>
        {subtitle != null && <span className="block text-muted-foreground">{subtitle}</span>}
        {children != null && <span className="block">{children}</span>}
      </span>
      {value != null && (
        <span className="max-w-[45%] min-w-0 text-end wrap-anywhere text-muted-foreground">{value}</span>
      )}
      {chevron && <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" />}
    </>
  );

  if (href !== undefined) {
    return <a href={href} className={interactive}>{content}</a>;
  }

  if (onClick) {
    return <button type="button" onClick={onClick} className={interactive}>{content}</button>;
  }

  return <div className={row}>{content}</div>;
}
