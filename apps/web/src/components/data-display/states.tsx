"use client";

import { AlertCircle, RotateCw } from "lucide-react";
import { Button, cn } from "@authometry/ui";

export function ErrorState({
  title,
  description,
  headingLevel = "h1",
  onRetry,
}: {
  title: string;
  description: string;
  headingLevel?: "h1" | "h2" | "h3";
  onRetry?: () => void;
}) {
  const Heading = headingLevel;
  return (
    <div className="flex min-h-72 flex-col items-center justify-center border-y border-[var(--border)] px-6 text-center">
      <AlertCircle aria-hidden="true" className="mb-4 size-6 text-[var(--danger)]" />
      <Heading className="text-sm font-semibold text-balance">{title}</Heading>
      <p className="mt-1 max-w-md text-[13px] leading-5 text-[var(--text-secondary)]">
        {description}
      </p>
      {onRetry && (
        <Button className="mt-5" onClick={onRetry}>
          <RotateCw aria-hidden="true" className="size-3.5" /> Retry
        </Button>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded bg-[var(--surface-hover)]", className)}
    />
  );
}

export function PageSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-label="Loading…" className="space-y-6" role="status">
      <div>
        <Skeleton className="h-7 w-48" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="h-28 rounded-lg border border-[var(--border)] p-4" key={index}>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-5 h-7 w-20" />
          </div>
        ))}
      </div>
      <div className="border-y border-[var(--border)]">
        {Array.from({ length: rows }, (_, index) => (
          <div
            className="flex h-14 items-center gap-4 border-b border-[var(--border-subtle)] px-3 last:border-0"
            key={index}
          >
            <Skeleton className="size-5" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="ml-auto h-3 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
