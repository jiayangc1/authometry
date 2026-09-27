"use client";

import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useId, type ReactNode } from "react";
import { cn } from "@authometry/ui";

const spring = { type: "spring", stiffness: 520, damping: 40, mass: 0.8 } as const;

/** Geist Tabs as route navigation, with a sliding underline and hover pill. */
export function TabNav({
  className,
  items,
  label,
}: {
  className?: string;
  items: Array<{ href: string; label: ReactNode; active: boolean; count?: number }>;
  label: string;
}) {
  const id = useId();
  const reduced = useReducedMotion();
  return (
    <LayoutGroup id={id}>
      <nav
        aria-label={label}
        className={cn(
          "-mx-1 flex scrollbar-thin gap-1 overflow-x-auto border-b border-[var(--border)] px-1",
          className,
        )}
      >
        {items.map((item) => (
          <Link
            aria-current={item.active ? "page" : undefined}
            className={cn(
              "group relative flex h-10 shrink-0 items-center gap-1.5 px-2 text-[13px] transition-colors duration-[var(--motion-fast)] focus-visible:outline-none",
              item.active
                ? "text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
            )}
            href={item.href}
            key={item.href}
          >
            <span className="absolute inset-x-0 inset-y-1.5 rounded-[var(--radius-control)] transition-colors duration-[var(--motion-fast)] group-hover:bg-[var(--surface-hover)] group-focus-visible:ring-2 group-focus-visible:ring-[var(--focus)]" />
            <span className="relative">{item.label}</span>
            {item.count !== undefined && (
              <span className="relative rounded-full bg-[var(--geist-gray-100)] px-1.5 text-[11px] text-[var(--text-secondary)] tabular-nums">
                {item.count}
              </span>
            )}
            {item.active && (
              <motion.span
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[var(--text-primary)]"
                layoutId="tab-indicator"
                transition={reduced ? { duration: 0 } : spring}
              />
            )}
          </Link>
        ))}
      </nav>
    </LayoutGroup>
  );
}

/** Geist Toggle/segmented control with a sliding selection pill. */
export function SegmentedControl<T extends string>({
  className,
  label,
  onChange,
  options,
  size = "default",
  value,
}: {
  className?: string;
  label: string;
  onChange: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: ReactNode }>;
  size?: "default" | "compact";
  value: T;
}) {
  const id = useId();
  const reduced = useReducedMotion();
  return (
    <LayoutGroup id={id}>
      <div
        aria-label={label}
        className={cn(
          "inline-flex max-w-full overflow-x-auto rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface-subtle)] p-0.5",
          className,
        )}
        role="radiogroup"
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              aria-checked={selected}
              className={cn(
                "pressable relative shrink-0 rounded-[calc(var(--radius-control)-2px)] font-medium focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:outline-none",
                size === "compact" ? "h-6 px-2 text-xs" : "h-7 px-3 text-[13px]",
                selected
                  ? "text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              )}
              key={option.value}
              onClick={() => onChange(option.value)}
              role="radio"
              type="button"
            >
              {selected && (
                <motion.span
                  className="absolute inset-0 rounded-[inherit] bg-[var(--surface-raised)] shadow-[0_0_0_1px_var(--border),var(--shadow-small)]"
                  layoutId="segment-pill"
                  transition={reduced ? { duration: 0 } : spring}
                />
              )}
              <span className="relative">{option.label}</span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
