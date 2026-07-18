import Link from "next/link";
import { AuthometryLogo, AuthometryMark } from "@authometry/ui";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh bg-[var(--background)] pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] lg:grid-cols-[1fr_0.92fr]">
      <section className="flex min-h-0 flex-col px-6 py-6 sm:px-10 lg:px-14">
        <Link
          href="/"
          className="w-fit rounded-md focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:outline-none"
        >
          <AuthometryLogo />
        </Link>
        <div className="mx-auto flex w-full max-w-[380px] flex-1 items-center py-12">
          {children}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-tertiary)]">
          <span>Authometry · OAuth you can see.</span>
          <Link className="hover:text-[var(--text-primary)]" href="/privacy">
            Privacy
          </Link>
          <Link className="hover:text-[var(--text-primary)]" href="/terms">
            Terms
          </Link>
          <Link className="hover:text-[var(--text-primary)]" href="/data-deletion">
            Data deletion
          </Link>
        </div>
      </section>
      <aside className="hidden border-l border-[var(--border)] bg-[var(--surface)] p-10 lg:flex lg:items-center">
        <div className="mx-auto w-full max-w-xl">
          <p className="technical-value mb-5 text-[var(--text-tertiary)]">
            AUTHORIZATION TRACE / LIVE
          </p>
          <h2 className="max-w-md text-3xl leading-10 font-semibold tracking-[-0.04em] text-balance">
            Every decision leaves evidence.
          </h2>
          <p className="mt-4 max-w-md text-sm leading-6 text-[var(--text-secondary)]">
            Inspect the exact client, redirect URI, PKCE challenge, user session, consent grant, and
            policy result behind every request.
          </p>
          <div className="mt-10 border-y border-[var(--border)] py-2">
            {[
              "Request received",
              "Client verified",
              "Redirect URI matched",
              "PKCE challenge validated",
            ].map((step, index) => (
              <div
                className="grid grid-cols-[28px_1fr_auto] items-center border-b border-[var(--border-subtle)] py-3 last:border-0"
                key={step}
              >
                <span className="technical-value text-[var(--text-tertiary)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="text-[13px] font-medium">{step}</span>
                <span className="text-xs text-[var(--success)]">Passed</span>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </main>
  );
}

export function AuthorizationShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col bg-[var(--surface)] pt-[max(1.5rem,env(safe-area-inset-top))] pr-[max(1.25rem,env(safe-area-inset-right))] pb-[max(1.5rem,env(safe-area-inset-bottom))] pl-[max(1.25rem,env(safe-area-inset-left))] sm:justify-center sm:py-10">
      <section className="mx-auto flex w-full max-w-[450px] flex-1 flex-col justify-center sm:flex-none sm:rounded-[24px] sm:border sm:border-[var(--border-strong)] sm:bg-[var(--background)] sm:px-10 sm:py-10 sm:shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <Link
          href="/"
          aria-label="Authometry home"
          className="mx-auto mb-7 flex size-10 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:outline-none"
        >
          <AuthometryMark className="size-6" />
        </Link>
        {children}
      </section>
      <p className="mt-7 text-center text-xs text-[var(--text-tertiary)]">Secured by Authometry</p>
    </main>
  );
}

export function AuthHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-7">
      <h1 className="text-2xl font-semibold tracking-[-0.035em] text-balance">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
    </div>
  );
}

export const inputClass =
  "h-9 w-full rounded-[6px] border border-[var(--border-strong)] bg-[var(--surface-raised)] px-3 text-sm text-[var(--text-primary)] shadow-[0_1px_1px_rgba(0,0,0,0.02)] placeholder:text-[var(--text-tertiary)] focus-visible:border-[var(--focus)] focus-visible:ring-2 focus-visible:ring-[var(--accent-soft)] focus-visible:outline-none";
