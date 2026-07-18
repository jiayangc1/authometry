"use client";

import { useEffect } from "react";
import { Button } from "@authometry/ui";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => console.error(error), [error]);
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <h1 className="text-xl font-semibold text-balance">Authometry Could Not Load This Page</h1>
      <p className="mt-2 max-w-md text-sm text-[var(--text-secondary)]">
        The request failed before the page finished loading. Retry the request, or check the server
        logs using the request ID.
      </p>
      <Button className="mt-5" onClick={reset}>
        Retry
      </Button>
    </main>
  );
}
