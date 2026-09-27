import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@authometry/ui";

/** Geist material surface: 1px border, 8px radius, no decorative shadow. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-raised)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  actions,
  className,
  description,
  title,
}: {
  actions?: ReactNode;
  className?: string;
  description?: ReactNode;
  title: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3 sm:px-5",
        className,
      )}
    >
      <div className="min-w-0">
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && (
          <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Settings-style footer strip: explanatory text on the left, action on the right. */
export function CardFooter({
  children,
  className,
  hint,
  tone = "neutral",
}: {
  children?: ReactNode;
  className?: string;
  hint?: ReactNode;
  tone?: "neutral" | "danger";
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-b-[calc(var(--radius-card)-1px)] border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5",
        tone === "danger"
          ? "border-[var(--danger-border)] bg-[var(--danger-soft)]"
          : "border-[var(--border)] bg-[var(--surface-subtle)]",
        className,
      )}
    >
      <div className="text-[13px] text-[var(--text-secondary)]">{hint}</div>
      {children && <div className="flex shrink-0 items-center justify-end gap-2">{children}</div>}
    </div>
  );
}
