import type { AriaAttributes, ComponentType, ReactNode } from "react";
import { AlertTriangle, Check, CircleDashed, CircleX, Info } from "lucide-react";
import { cn } from "./utils";

export type StatusTone = "success" | "danger" | "warning" | "info" | "neutral";

const badgeStyles: Record<StatusTone, string> = {
  success: "bg-[var(--success-soft)] text-[var(--success)]",
  danger: "bg-[var(--danger-soft)] text-[var(--danger)]",
  warning: "bg-[var(--warning-soft)] text-[var(--warning)]",
  info: "bg-[var(--info-soft)] text-[var(--info)]",
  neutral: "bg-[var(--geist-gray-100)] text-[var(--text-secondary)]",
};

const dotStyles: Record<StatusTone, string> = {
  success: "bg-[var(--success-solid)]",
  danger: "bg-[var(--danger-solid)]",
  warning: "bg-[var(--warning-solid)]",
  info: "bg-[var(--accent)]",
  neutral: "bg-[var(--geist-gray-600)]",
};

type DecorativeIcon = ComponentType<{
  className?: string;
  "aria-hidden"?: AriaAttributes["aria-hidden"];
}>;

const statusIcons: Record<StatusTone, DecorativeIcon> = {
  success: Check,
  danger: CircleX,
  warning: AlertTriangle,
  info: Info,
  neutral: CircleDashed,
};

/** Geist Badge (subtle). The dot keeps state readable without relying on hue alone. */
export function StatusBadge({
  className,
  label,
  tone = "neutral",
}: {
  className?: string;
  label: string;
  tone?: StatusTone;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1.5 rounded-full px-2 text-[11px] leading-none font-medium whitespace-nowrap",
        badgeStyles[tone],
        className,
      )}
    >
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", dotStyles[tone])} />
      {label}
    </span>
  );
}

/** Geist Status Dot — a bare indicator for dense rows. */
export function StatusDot({
  className,
  label,
  pulse = false,
  tone = "neutral",
}: {
  className?: string;
  label?: string;
  pulse?: boolean;
  tone?: StatusTone;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span aria-hidden="true" className="relative flex size-2">
        {pulse && (
          <span
            className={cn(
              "absolute inline-flex size-full animate-ping rounded-full opacity-50",
              dotStyles[tone],
            )}
          />
        )}
        <span className={cn("relative inline-flex size-2 rounded-full", dotStyles[tone])} />
      </span>
      {label && <span>{label}</span>}
    </span>
  );
}

const noteStyles: Record<StatusTone, string> = {
  success: "border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success)]",
  danger: "border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger)]",
  warning: "border-[var(--warning-border)] bg-[var(--warning-soft)] text-[var(--warning)]",
  info: "border-[var(--info-border)] bg-[var(--info-soft)] text-[var(--info)]",
  neutral: "border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-secondary)]",
};

/** Geist Note — inline, contextual messaging with an optional trailing action. */
export function Note({
  action,
  children,
  className,
  icon,
  role,
  tone = "neutral",
}: {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  icon?: DecorativeIcon | false;
  role?: "alert" | "status";
  tone?: StatusTone;
}) {
  const Icon = icon === false ? undefined : (icon ?? statusIcons[tone]);
  return (
    <div
      className={cn(
        "flex animate-[fade-in_var(--motion-normal)_var(--ease-out)] items-start gap-2.5 rounded-[var(--radius-control)] border px-3 py-2.5 text-[13px] leading-5",
        noteStyles[tone],
        className,
      )}
      role={role}
    >
      {Icon && <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />}
      <div className="min-w-0 flex-1 [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-2">
        {children}
      </div>
      {action && <div className="-my-1 shrink-0">{action}</div>}
    </div>
  );
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-[4px] border border-[var(--border)] bg-[var(--surface-raised)] px-1 font-sans text-[11px] text-[var(--text-secondary)] shadow-[0_1px_0_var(--border)]",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

export function EmptyState({
  className,
  description,
  headingLevel = "h2",
  icon: Icon = CircleDashed,
  primaryAction,
  secondaryAction,
  title,
}: {
  className?: string;
  icon?: DecorativeIcon;
  title: string;
  description: string;
  headingLevel?: "h2" | "h3";
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
}) {
  const Heading = headingLevel;

  return (
    <div
      className={cn(
        "flex min-h-64 animate-[enter_var(--motion-slow)_var(--ease-out)] flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-[var(--border-strong)] px-6 py-12 text-center",
        className,
      )}
    >
      <span className="mb-4 flex size-10 items-center justify-center rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-raised)] shadow-[var(--shadow-small)]">
        <Icon aria-hidden="true" className="size-[18px] text-[var(--text-secondary)]" />
      </span>
      <Heading className="text-sm font-semibold text-balance">{title}</Heading>
      <p className="mt-1 max-w-md text-[13px] leading-5 text-pretty text-[var(--text-secondary)]">
        {description}
      </p>
      {(primaryAction || secondaryAction) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {primaryAction}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
