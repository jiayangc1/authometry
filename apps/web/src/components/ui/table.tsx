import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@authometry/ui";

/**
 * Dense, Geist-style data list. Columns are a CSS grid template applied to the header and
 * every row, so cells stay aligned without `<table>` layout constraints on small screens.
 */
export function Table({
  children,
  className,
  columns,
  label,
}: {
  children: ReactNode;
  className?: string;
  columns: string;
  label?: string;
}) {
  return (
    <div
      aria-label={label}
      className={cn(
        "overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-raised)]",
        className,
      )}
      role={label ? "region" : undefined}
      style={{ "--table-columns": columns } as CSSProperties}
    >
      {children}
    </div>
  );
}

export function TableHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "hidden h-10 items-center gap-4 border-b border-[var(--border)] bg-[var(--surface-subtle)] px-4 text-xs font-medium text-[var(--text-secondary)] lg:grid lg:[grid-template-columns:var(--table-columns)] lg:pr-9",
        className,
      )}
    >
      {children}
    </div>
  );
}

const rowClass =
  "group virtualized-row row-link relative grid min-h-14 items-center gap-x-4 gap-y-1 border-b border-[var(--border)] px-4 py-2.5 last:border-0 lg:pr-9 lg:[grid-template-columns:var(--table-columns)]";

export function TableRow({
  children,
  className,
  href,
  mobileColumns = "minmax(0,1fr) auto",
  arrow = true,
}: {
  children: ReactNode;
  className?: string;
  href?: string;
  mobileColumns?: string;
  arrow?: boolean;
}) {
  const style = { "--mobile-columns": mobileColumns } as CSSProperties;
  const classes = cn(
    rowClass,
    "[grid-template-columns:var(--mobile-columns)]",
    href &&
      "focus-visible:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:outline-none focus-visible:ring-inset",
    className,
  );
  if (!href)
    return (
      <div className={classes} style={style}>
        {children}
      </div>
    );
  return (
    <Link className={classes} href={href} style={style}>
      {children}
      {arrow && (
        <ArrowRight
          aria-hidden="true"
          className="row-arrow pointer-events-none absolute top-1/2 right-3 hidden size-3.5 -translate-y-1/2 text-[var(--text-tertiary)] lg:block"
        />
      )}
    </Link>
  );
}

/** Results footer showing count and optional pagination/loading state. */
export function TableFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-2 text-xs text-[var(--text-secondary)]">
      {children}
    </div>
  );
}
