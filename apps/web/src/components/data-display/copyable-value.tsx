"use client";

import { Check, Copy } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@authometry/ui";

export function useCopy(timeout = 1500) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), timeout);
      return true;
    } catch {
      toast.error("Could not copy. Select the value and copy it manually.");
      return false;
    }
  }
  return { copied, copy };
}

/** Icon-only copy control with an animated check. */
export function CopyButton({
  className,
  label = "Copy value",
  value,
}: {
  className?: string;
  label?: string;
  value: string;
}) {
  const { copied, copy } = useCopy();
  return (
    <button
      aria-label={copied ? "Copied" : label}
      className={cn(
        "pressable relative flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:outline-none",
        className,
      )}
      onClick={() => void copy(value)}
      title={copied ? "Copied" : label}
      type="button"
    >
      <Copy
        aria-hidden="true"
        className={cn(
          "absolute size-3.5 transition-[opacity,transform] duration-[var(--motion-fast)]",
          copied ? "scale-50 opacity-0" : "scale-100 opacity-100",
        )}
      />
      <Check
        aria-hidden="true"
        className={cn(
          "absolute size-3.5 text-[var(--success)] transition-[opacity,transform] duration-[var(--motion-normal)] ease-[var(--ease-spring)]",
          copied ? "scale-100 opacity-100" : "scale-50 opacity-0",
        )}
      />
      <span aria-live="polite" className="sr-only">
        {copied ? "Copied" : ""}
      </span>
    </button>
  );
}

export function CopyableValue({ value, className }: { value: string; className?: string }) {
  return (
    <span className={cn("inline-flex max-w-full min-w-0 items-center gap-1", className)}>
      <code className="technical-value truncate" title={value} translate="no">
        {value}
      </code>
      <CopyButton value={value} />
    </span>
  );
}

/** Geist Snippet: a bordered, monospace value with copy — for secrets, URLs, and commands. */
export function Snippet({
  className,
  label,
  prompt = false,
  value,
}: {
  className?: string;
  label?: string;
  prompt?: boolean;
  value: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-9 min-w-0 items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface-subtle)] py-1 pr-1 pl-3",
        className,
      )}
    >
      {prompt && <span className="technical-value text-[var(--text-tertiary)] select-none">$</span>}
      <code className="technical-value min-w-0 flex-1 truncate" title={value} translate="no">
        {value}
      </code>
      <CopyButton label={label ? `Copy ${label}` : "Copy value"} value={value} />
    </div>
  );
}

/** Code block with header, language label, and copy action. */
export function CodeBlock({
  className,
  code,
  label,
  maxHeight,
}: {
  className?: string;
  code: string;
  label: string;
  maxHeight?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-subtle)]",
        className,
      )}
    >
      <div className="flex h-9 items-center justify-between border-b border-[var(--border)] bg-[var(--surface-raised)] pr-1 pl-3">
        <span className="technical-value text-[var(--text-secondary)]">{label}</span>
        <CopyButton label="Copy code" value={code} />
      </div>
      <pre
        className="scrollbar-thin overflow-auto p-4 font-mono text-[12.5px] leading-5"
        style={maxHeight ? { maxHeight } : undefined}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}
