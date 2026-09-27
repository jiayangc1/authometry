"use client";

import { AlertCircle, RotateCw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@authometry/ui";
import { CopyableValue } from "@/components/data-display/copyable-value";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => console.error(error), [error]);
  return (
    <main className="flex min-h-dvh animate-[enter_var(--motion-slow)_var(--ease-out)] flex-col items-center justify-center px-6 text-center">
      <span className="mb-5 flex size-12 items-center justify-center rounded-full border border-[var(--danger-border)] bg-[var(--danger-soft)]">
        <AlertCircle aria-hidden="true" className="size-5 text-[var(--danger)]" />
      </span>
      <h1 className="text-2xl leading-8 font-semibold tracking-[-0.03em] text-balance">
        Something went wrong
      </h1>
      <p className="mt-2 max-w-md text-sm text-[var(--text-secondary)]">
        This page failed before it finished loading. Try again, or share the reference below when
        checking the server logs.
      </p>
      {error.digest && (
        <div className="mt-3 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          Reference <CopyableValue value={error.digest} />
        </div>
      )}
      <div className="mt-6 flex gap-2">
        <Button className="[&:hover_svg]:-rotate-90" onClick={reset} variant="primary">
          <RotateCw aria-hidden="true" className="size-3.5" /> Try again
        </Button>
        <Button asChild>
          <Link href="/overview">Go to dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
