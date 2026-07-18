"use client";

import { fullDateTime, relativeTime } from "@/lib/format";
import { useHydrated } from "@/lib/use-hydrated";

export function RelativeTime({ value }: { value: string | Date }) {
  const hydrated = useHydrated();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return <span>—</span>;
  return (
    <time dateTime={date.toISOString()}>{hydrated ? relativeTime(date) : fullDateTime(date)}</time>
  );
}

export function FullDateTime({ value }: { value: string | Date }) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return <span>—</span>;
  return <time dateTime={date.toISOString()}>{fullDateTime(date)}</time>;
}
