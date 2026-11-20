import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="shadow-soft flex flex-col items-center rounded-[14px] bg-card px-5 py-8 text-center text-card-foreground">
      {icon != null && <div aria-hidden="true" className="mb-3 rounded-full bg-muted p-3 text-muted-foreground">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {description != null && <div className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</div>}
      {action != null && <div className="mt-4">{action}</div>}
    </div>
  );
}
