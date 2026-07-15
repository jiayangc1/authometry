"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button, cn } from "@authometry/ui";

export function CopyableValue({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <span className={cn("inline-flex max-w-full min-w-0 items-center gap-1", className)}>
      <code className="technical-value truncate">{value}</code>
      <Button aria-label={`Copy ${value}`} onClick={() => void copy()} size="icon" variant="ghost">
        {copied ? (
          <Check className="size-3.5 text-[var(--success)]" />
        ) : (
          <Copy className="size-3.5" />
        )}
      </Button>
    </span>
  );
}
