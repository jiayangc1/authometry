"use client";

import { ChevronRight } from "lucide-react";
import { useId, type ReactNode } from "react";
import { cn } from "@authometry/ui";

/** List row that expands in place with an animated height and rotating chevron. */
export function DisclosureRow({
  children,
  className,
  onOpenChange,
  open,
  summary,
}: {
  children: ReactNode;
  className?: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  summary: ReactNode;
}) {
  const id = useId();
  return (
    <div className={cn("border-b border-[var(--border)] last:border-0", className)}>
      <button
        aria-controls={id}
        aria-expanded={open}
        className={cn(
          "group flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-[var(--motion-fast)] hover:bg-[var(--surface-subtle)] focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:outline-none focus-visible:ring-inset",
          open && "bg-[var(--surface-subtle)]",
        )}
        onClick={() => onOpenChange(!open)}
        type="button"
      >
        <ChevronRight
          aria-hidden="true"
          className={cn(
            "size-3.5 shrink-0 text-[var(--text-tertiary)] transition-transform duration-[var(--motion-normal)] ease-[var(--ease-out)]",
            open && "rotate-90",
          )}
        />
        <div className="min-w-0 flex-1">{summary}</div>
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-[var(--motion-normal)] ease-[var(--ease-out)]",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
        id={id}
        inert={!open}
      >
        <div className="overflow-hidden">
          <div className="border-t border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-3 pl-[42px]">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
