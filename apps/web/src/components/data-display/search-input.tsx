import { Search, X } from "lucide-react";
import type { InputHTMLAttributes } from "react";
import { cn } from "@authometry/ui";
import { inputCompactClass } from "@/components/ui/form";

export function SearchInput({
  className,
  onClear,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { onClear?: () => void }) {
  const hasValue = Boolean(props.value ?? props.defaultValue);
  return (
    <div className={cn("group relative block", className)}>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-[var(--text-tertiary)] transition-colors group-focus-within:text-[var(--text-primary)]"
      />
      <input
        aria-label={props["aria-label"] ?? "Search"}
        autoComplete={props.autoComplete ?? "off"}
        className={cn(inputCompactClass, "pl-8", onClear && "pr-8")}
        name={props.name ?? "search"}
        type="search"
        {...props}
      />
      {onClear && hasValue && (
        <button
          aria-label="Clear search"
          className="pressable absolute top-1/2 right-1.5 flex size-5 -translate-y-1/2 items-center justify-center rounded-[4px] text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
          onClick={onClear}
          type="button"
        >
          <X aria-hidden="true" className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/** Toolbar row that holds search + filters with consistent spacing. */
export function FilterBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center", className)}
    >
      {children}
    </div>
  );
}

/** @deprecated Use the `Select` primitive from `@/components/ui/form`. */
export const selectClass =
  "h-8 cursor-pointer rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 text-[13px] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-strong)] focus-visible:shadow-[0_0_0_3px_var(--geist-gray-alpha-200)] focus-visible:outline-none";
