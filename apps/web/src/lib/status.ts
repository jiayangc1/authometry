import type { StatusTone } from "@authometry/ui";

export type TraceStatus = "success" | "denied" | "error" | "warning" | "pending";

export function traceTone(status: string): StatusTone {
  if (status === "success") return "success";
  if (status === "denied" || status === "warning") return "warning";
  if (status === "pending") return "neutral";
  return "danger";
}

export function traceLabel(status: string): string {
  if (status === "success") return "Authorized";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function humanize(value: string): string {
  const text = value.replaceAll(/[_-]+/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}
