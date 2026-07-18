"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button, cn } from "@authometry/ui";

export function CopyableValue({ value, className }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy the value. Select it and copy manually.");
    }
  }
  return (
    <span className={cn("inline-flex max-w-full min-w-0 items-center gap-1", className)}>
      <code className="technical-value truncate" translate="no">
        {value}
      </code>
      <Button
        aria-label={copied ? "Value copied" : "Copy value"}
        aria-live="polite"
        onClick={() => void copy()}
        size="icon"
        variant="ghost"
      >
        {copied ? (
          <Check aria-hidden="true" className="size-3.5 text-[var(--success)]" />
        ) : (
          <Copy aria-hidden="true" className="size-3.5" />
        )}
      </Button>
    </span>
  );
}
