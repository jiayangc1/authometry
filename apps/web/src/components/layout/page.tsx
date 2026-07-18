import type { ReactNode } from "react";
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
    standard: "max-w-[1440px]",
    settings: "max-w-[900px]",
    trace: "max-w-[1280px]",
    narrow: "max-w-[640px]",
  };
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 py-7 sm:px-6 lg:px-8 lg:py-8 xl:px-10",
        widths[size],
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
      <div className="min-w-0">
        {eyebrow && <div className="mb-2 text-xs text-[var(--text-secondary)]">{eyebrow}</div>}
        <h1 className="text-2xl leading-8 font-semibold tracking-[-0.035em] text-balance break-words">
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-3xl text-sm leading-[22px] text-[var(--text-secondary)]">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function SectionHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-base leading-6 font-semibold text-balance">{title}</h2>
        {description && (
          <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">{description}</p>
        )}
      </div>
      {actions}
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
  return (
    <section className={cn("border-t border-[var(--border)] pt-7", className)}>{children}</section>
  );
}
