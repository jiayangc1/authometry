import { Compass } from "lucide-react";
import Link from "next/link";
import { Button } from "@authometry/ui";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh animate-[enter_var(--motion-slow)_var(--ease-out)] flex-col items-center justify-center px-6 text-center">
      <span className="mb-5 flex size-12 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-subtle)]">
        <Compass aria-hidden="true" className="size-5 text-[var(--text-secondary)]" />
      </span>
      <p className="technical-value text-[var(--text-tertiary)]">404</p>
      <h1 className="mt-1 text-2xl leading-8 font-semibold tracking-[-0.03em] text-balance">
        Page not found
      </h1>
      <p className="mt-2 max-w-sm text-sm text-[var(--text-secondary)]">
        This page may have moved, or it belongs to another workspace or environment.
      </p>
      <div className="mt-6 flex gap-2">
        <Button asChild variant="primary">
          <Link href="/overview">Go to dashboard</Link>
        </Button>
        <Button asChild>
          <Link href="/docs">Documentation</Link>
        </Button>
      </div>
    </main>
  );
}
