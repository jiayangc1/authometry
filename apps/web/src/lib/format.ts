import { format, formatDistanceToNowStrict } from "date-fns";

export function relativeTime(value: string | Date): string {
  return formatDistanceToNowStrict(new Date(value), { addSuffix: true });
}

export function fullDateTime(value: string | Date): string {
  return format(new Date(value), "MMMM d, yyyy 'at' h:mm:ss.SSS a");
}

export function duration(milliseconds?: number | null): string {
  if (milliseconds === undefined || milliseconds === null) return "—";
  if (milliseconds === 0) return "<1 ms";
  if (milliseconds < 0.01) return "<0.01 ms";
  if (milliseconds < 1) return `${milliseconds.toFixed(2)} ms`;
  if (milliseconds < 10) return `${milliseconds.toFixed(2)} ms`;
  if (milliseconds < 100) return `${milliseconds.toFixed(1)} ms`;
  if (milliseconds < 1000) return `${Math.round(milliseconds)} ms`;
  return `${(milliseconds / 1000).toFixed(2)} s`;
}

export function durationOffset(milliseconds: number): string {
  return milliseconds === 0 ? "start" : `+${duration(milliseconds)}`;
}

export function compactNumber(value: number): string {
  return new Intl.NumberFormat("en", { notation: value > 9999 ? "compact" : "standard" }).format(
    value,
  );
}
