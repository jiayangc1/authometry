import Link from "next/link";
import { Button } from "@authometry/ui";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="technical-value text-[var(--text-tertiary)]">404</p>
      <h1 className="mt-3 text-xl font-semibold text-balance">Page Not Found</h1>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        The page may have moved or belong to another workspace.
      </p>
      <Button asChild className="mt-5">
        <Link href="/overview">Return to Dashboard</Link>
      </Button>
    </main>
  );
}
