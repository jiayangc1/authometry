const dateTimeFormatter = new Intl.DateTimeFormat("en", {
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  fractionalSecondDigits: 3,
});
const relativeTimeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function rounded(value: number, maximumFractionDigits: number): string {
  return new Intl.NumberFormat("en", {
    maximumFractionDigits,
    minimumFractionDigits: maximumFractionDigits,
  }).format(value);
}

export function relativeTime(value: string | Date): string {
  const deltaSeconds = (new Date(value).getTime() - Date.now()) / 1000;
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  const [unit, seconds] = units.find(([, size]) => Math.abs(deltaSeconds) >= size) ?? ["second", 1];
  return relativeTimeFormatter.format(Math.round(deltaSeconds / seconds), unit);
}

export function fullDateTime(value: string | Date): string {
  return dateTimeFormatter.format(new Date(value));
}

export function duration(milliseconds?: number | null): string {
  if (milliseconds === undefined || milliseconds === null) return "—";
  if (milliseconds === 0) return "<1\u00a0ms";
  if (milliseconds < 0.01) return "<0.01\u00a0ms";
  if (milliseconds < 10) return `${rounded(milliseconds, 2)}\u00a0ms`;
  if (milliseconds < 100) return `${rounded(milliseconds, 1)}\u00a0ms`;
  if (milliseconds < 1000)
    return `${new Intl.NumberFormat("en").format(Math.round(milliseconds))}\u00a0ms`;
  return `${rounded(milliseconds / 1000, 2)}\u00a0s`;
}

export function durationOffset(milliseconds: number): string {
  return milliseconds === 0 ? "start" : `+${duration(milliseconds)}`;
}

export function compactNumber(value: number): string {
  return new Intl.NumberFormat("en", { notation: value > 9999 ? "compact" : "standard" }).format(
    value,
  );
}

export function percentage(value: number, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat("en", {
    style: "percent",
    maximumFractionDigits,
    minimumFractionDigits: maximumFractionDigits,
  }).format(value / 100);
}

export function hourLabel(hour: number): string {
  const value = new Date(Date.UTC(2020, 0, 1, hour));
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC",
  }).format(value);
}

export function minutesFromSeconds(seconds: number): string {
  return new Intl.NumberFormat("en", {
    style: "unit",
    unit: "minute",
    unitDisplay: "short",
    maximumFractionDigits: 0,
  }).format(seconds / 60);
}
