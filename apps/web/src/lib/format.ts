import { format, formatDistanceToNowStrict } from "date-fns";

export function relativeTime(value: string | Date): string {
  return formatDistanceToNowStrict(new Date(value), { addSuffix: true });
}

export function fullDateTime(value: string | Date): string {
  return format(new Date(value), "MMMM d, yyyy 'at' h:mm:ss.SSS a");
}

export function duration(milliseconds?: number | null): string {
  if (milliseconds === undefined || milliseconds === null) return "—";
  if (milliseconds < 1000) return `${milliseconds} ms`;
  return `${(milliseconds / 1000).toFixed(2)} s`;
}

export function compactNumber(value: number): string {
  return new Intl.NumberFormat("en", { notation: value > 9999 ? "compact" : "standard" }).format(
    value,
  );
}
