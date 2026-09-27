import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { cn } from "@authometry/ui";

export function PageContainer({
  children,
  className,
  size = "standard",
}: {
  children: ReactNode;
  className?: string;
  size?: "standard" | "settings" | "trace" | "narrow";
}) {
  const widths = {
    standard: "max-w-[1200px]",
    settings: "max-w-[960px]",
    trace: "max-w-[1200px]",
    narrow: "max-w-[680px]",
  };
  return (
    <div
      className={cn(
        "mx-auto w-full animate-[enter_var(--motion-slow)_var(--ease-out)] px-4 pt-6 pb-16 sm:px-6 lg:px-8 lg:pt-8",
        widths[size],
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Breadcrumbs({ items }: { items: Array<{ label: ReactNode; href?: string }> }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3">
      <ol className="flex min-w-0 items-center gap-1 text-[13px] text-[var(--text-secondary)]">
        {items.map((item, index) => (
          <Fragment key={index}>
            {index > 0 && (
              <ChevronRight
                aria-hidden="true"
                className="size-3.5 shrink-0 text-[var(--text-tertiary)]"
              />
            )}
            <li className="min-w-0 truncate">
              {item.href ? (
                <Link
                  className="rounded-[4px] transition-colors hover:text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:outline-none"
                  href={item.href}
                >
                  {item.label}
                </Link>
              ) : (
                <span aria-current="page" className="text-[var(--text-primary)]">
                  {item.label}
                </span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  badges,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  badges?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col justify-between gap-4 border-b border-[var(--border)] pb-6 sm:flex-row sm:items-end">
      <div className="min-w-0">
        {eyebrow && <div className="mb-2 text-[13px] text-[var(--text-secondary)]">{eyebrow}</div>}
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl leading-8 font-semibold tracking-[-0.03em] text-balance break-words">
            {title}
          </h1>
          {badges}
        </div>
        {description && (
          <p className="mt-1 max-w-2xl text-sm leading-5 text-pretty text-[var(--text-secondary)]">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function SectionHeader({
  title,
  description,
  actions,
  as: Heading = "h2",
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  as?: "h2" | "h3";
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <Heading className="text-base leading-6 font-semibold tracking-[-0.01em] text-balance">
          {title}
        </Heading>
        {description && (
          <p className="mt-0.5 text-[13px] text-pretty text-[var(--text-secondary)]">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function DividerSection({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={cn("pt-2", className)}>{children}</section>;
}

/** Geist-style key/value list inside a bordered surface. */
export function DescriptionList({
  className,
  items,
}: {
  className?: string;
  items: Array<[ReactNode, ReactNode]>;
}) {
  return (
    <dl
      className={cn(
        "divide-y divide-[var(--border)] rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-raised)]",
        className,
      )}
    >
      {items.map(([label, value], index) => (
        <div
          className="grid min-h-11 items-center gap-1 px-4 py-2.5 sm:grid-cols-[200px_minmax(0,1fr)]"
          key={index}
        >
          <dt className="text-[13px] text-[var(--text-secondary)]">{label}</dt>
          <dd className="min-w-0 text-[13px]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
