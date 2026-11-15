"use client";

import { useEffect } from "react";
import { CopyableValue } from "@/components/data-display/copyable-value";
import { ErrorState } from "@/components/data-display/states";
import { PageContainer } from "@/components/layout/page";

/** Keeps the sidebar and header in place when a dashboard page throws. */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => console.error(error), [error]);
  return (
    <PageContainer>
      <ErrorState
        description="This page failed before it finished loading. Try again, or pick another page from the sidebar."
        onRetry={reset}
        title="Something went wrong"
      />
      {error.digest && (
        <div className="mt-3 flex items-center justify-center gap-2 text-xs text-[var(--text-secondary)]">
          Reference <CopyableValue value={error.digest} />
        </div>
      )}
    </PageContainer>
  );
}
