import type { AriaAttributes, ComponentType, ReactNode } from "react";
import { AlertTriangle, Check, CircleDashed, CircleX, Info } from "lucide-react";
import { cn } from "./utils";

export type StatusTone = "success" | "danger" | "warning" | "info" | "neutral";

const statusStyles: Record<StatusTone, string> = {
  success: "border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success)]",
  danger: "border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger)]",
  warning: "border-[var(--warning-border)] bg-[var(--warning-soft)] text-[var(--warning)]",
  info: "border-[var(--info-border)] bg-[var(--info-soft)] text-[var(--info)]",
  neutral: "border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-secondary)]",
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

export function StatusBadge({ label, tone = "neutral" }: { label: string; tone?: StatusTone }) {
  const Icon = statusIcons[tone];
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-full border px-1.5 text-[11px] font-medium",
        statusStyles[tone],
      )}
    >
      <Icon aria-hidden="true" className="size-3" />
      {label}
    </span>
  );
}

export function EmptyState({
  description,
  headingLevel = "h2",
  icon: Icon = CircleDashed,
  primaryAction,
  secondaryAction,
  title,
}: {
  icon?: DecorativeIcon;
  title: string;
  description: string;
  headingLevel?: "h2" | "h3";
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
}) {
  const Heading = headingLevel;

  return (
    <div className="flex min-h-64 flex-col items-center justify-center border-y border-[var(--border-subtle)] px-6 py-12 text-center">
      <Icon aria-hidden="true" className="mb-4 size-6 text-[var(--text-tertiary)]" />
      <Heading className="text-sm font-semibold text-balance">{title}</Heading>
      <p className="mt-1 max-w-md text-[13px] leading-5 text-[var(--text-secondary)]">
        {description}
      </p>
      {(primaryAction || secondaryAction) && (
        <div className="mt-5 flex items-center gap-2">
          {primaryAction}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
