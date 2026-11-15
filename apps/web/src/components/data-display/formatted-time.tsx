"use client";

import { fullDateTime, relativeTime } from "@/lib/format";
import { useHydrated } from "@/lib/use-hydrated";

/** Relative time with the exact timestamp on hover. */
export function RelativeTime({ value }: { value: string | Date }) {
  const hydrated = useHydrated();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return <span>—</span>;
  const exact = fullDateTime(date, false);
  return (
    <time dateTime={date.toISOString()} title={hydrated ? exact : undefined}>
      {hydrated ? relativeTime(date) : exact}
    </time>
  );
}

export function FullDateTime({
  value,
  precise = false,
}: {
  value: string | Date;
  /** Include milliseconds — for traces, where ordering within a second matters. */
  precise?: boolean;
}) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return <span>—</span>;
  return <time dateTime={date.toISOString()}>{fullDateTime(date, precise)}</time>;
}
