import { Search } from "lucide-react";
import type { InputHTMLAttributes } from "react";
import { cn } from "@authometry/ui";

export function SearchInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={cn("relative block", className)}>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-[var(--text-tertiary)]"
      />
      <input
        aria-label={props["aria-label"] ?? "Search"}
        autoComplete={props.autoComplete ?? "off"}
        className="h-8 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-raised)] pr-3 pl-8 text-[13px] placeholder:text-[var(--text-tertiary)] focus-visible:border-[var(--focus)] focus-visible:ring-2 focus-visible:ring-[var(--accent-soft)] focus-visible:outline-none"
        name={props.name ?? "search"}
        {...props}
      />
    </div>
  );
}

export const selectClass =
  "h-8 rounded-[6px] border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 text-[13px] text-[var(--text-secondary)] focus-visible:border-[var(--focus)] focus-visible:ring-2 focus-visible:ring-[var(--accent-soft)] focus-visible:outline-none";
