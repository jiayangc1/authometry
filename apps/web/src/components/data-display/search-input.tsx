import { Search } from "lucide-react";
import type { InputHTMLAttributes } from "react";
import { cn } from "@authometry/ui";

export function SearchInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={cn("relative block", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-[var(--text-tertiary)]" />
      <input
        className="h-8 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-raised)] pr-3 pl-8 text-[13px] placeholder:text-[var(--text-tertiary)] focus:border-[var(--focus)] focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none"
        {...props}
      />
    </label>
  );
}

export const selectClass =
  "h-8 rounded-[6px] border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 text-[13px] text-[var(--text-secondary)] focus:border-[var(--focus)] focus:ring-2 focus:ring-[var(--accent-soft)] focus:outline-none";
