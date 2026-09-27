"use client";

import { AlertCircle, RotateCw } from "lucide-react";
import { Button, cn } from "@authometry/ui";

export function ErrorState({
  title,
  description,
  headingLevel = "h1",
  onRetry,
  retrying = false,
}: {
  title: string;
  description: string;
  headingLevel?: "h1" | "h2" | "h3";
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const Heading = headingLevel;
  return (
    <div
      className="flex min-h-72 animate-[enter_var(--motion-slow)_var(--ease-out)] flex-col items-center justify-center rounded-[var(--radius-card)] border border-[var(--border)] px-6 py-12 text-center"
      role="alert"
    >
      <span className="mb-4 flex size-10 items-center justify-center rounded-[var(--radius-card)] border border-[var(--danger-border)] bg-[var(--danger-soft)]">
        <AlertCircle aria-hidden="true" className="size-[18px] text-[var(--danger)]" />
      </span>
      <Heading className="text-sm font-semibold text-balance">{title}</Heading>
      <p className="mt-1 max-w-md text-[13px] leading-5 text-pretty text-[var(--text-secondary)]">
        {description}
      </p>
      {onRetry && (
        <Button className="mt-5 [&:hover_svg]:-rotate-90" loading={retrying} onClick={onRetry}>
          {!retrying && <RotateCw aria-hidden="true" className="size-3.5" />} Try again
        </Button>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("skeleton rounded-[var(--radius-control)]", className)} />
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div
      aria-label="Loading…"
      className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)]"
      role="status"
    >
      {Array.from({ length: rows }, (_, index) => (
        <div
          className="flex h-14 items-center gap-4 border-b border-[var(--border)] px-4 last:border-0"
          key={index}
          style={{ opacity: 1 - index * (0.6 / rows) }}
        >
          <Skeleton className="size-7" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-2.5 w-1/5" />
          </div>
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton({ rows = 5, metrics = true }: { rows?: number; metrics?: boolean }) {
  return (
    <div aria-label="Loading…" className="space-y-6" role="status">
      <div>
        <Skeleton className="h-7 w-48" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      </div>
      {metrics && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              className="h-28 rounded-[var(--radius-card)] border border-[var(--border)] p-4"
              key={index}
            >
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-5 h-7 w-20" />
            </div>
          ))}
        </div>
      )}
      <ListSkeleton rows={rows} />
    </div>
  );
}
