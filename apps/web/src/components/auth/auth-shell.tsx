import Link from "next/link";
import { Check, ShieldCheck } from "lucide-react";
import { AuthometryLogo, AuthometryMark } from "@authometry/ui";

const authorizationTrace = [
  {
    label: "Request received",
    detail: "GET /oauth/authorize",
    elapsed: "00 ms",
  },
  {
    label: "Client verified",
    detail: "Client credentials active",
    elapsed: "08 ms",
  },
  {
    label: "Redirect URI matched",
    detail: "Exact registered callback",
    elapsed: "11 ms",
  },
  {
    label: "PKCE challenge validated",
    detail: "S256 proof verified",
    elapsed: "16 ms",
  },
];

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
      <aside className="relative hidden overflow-hidden border-l border-[var(--border)] bg-[var(--surface)] p-10 lg:flex lg:items-center">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_68%_42%,var(--accent-soft),transparent_38%)] opacity-50"
        />
        <div className="relative mx-auto w-full max-w-xl">
          <div className="mb-5 flex items-center gap-2.5">
            <span className="technical-value text-[var(--text-tertiary)]">AUTHORIZATION TRACE</span>
            <span className="flex items-center gap-1.5 rounded-full border border-[var(--success-border)] bg-[var(--success-soft)] px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em] text-[var(--success)] uppercase">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--success)] opacity-40" />
                <span className="relative inline-flex size-1.5 rounded-full bg-[var(--success)]" />
              </span>
              Live
            </span>
          </div>
          <h2 className="max-w-lg text-[32px] leading-[1.18] font-semibold tracking-[-0.045em] text-balance">
            Every decision leaves evidence.
          </h2>
          <p className="mt-4 max-w-lg text-sm leading-6 text-[var(--text-secondary)]">
            Follow every check from the authorization request to the final policy decision, with the
            exact inputs that produced it.
          </p>

          <div className="mt-9 overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--background)] shadow-[0_18px_55px_rgba(0,0,0,0.12)]">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]">
                  <ShieldCheck aria-hidden="true" className="size-[18px]" />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold">Authorization request</p>
                  <p className="technical-value truncate text-[10px] text-[var(--text-tertiary)]">
                    req_9f2a7c1d · authorization_code
                  </p>
                </div>
              </div>
              <span className="rounded-md bg-[var(--success-soft)] px-2 py-1 text-[10px] font-semibold text-[var(--success)]">
                ALLOWED
              </span>
            </div>

            <ol aria-label="Example authorization trace" className="px-5 py-2">
              {authorizationTrace.map((step, index) => (
                <li className="relative grid grid-cols-[24px_1fr_auto] gap-3 py-3" key={step.label}>
                  {index < authorizationTrace.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="absolute top-8 bottom-[-12px] left-[11px] w-px bg-[var(--success-border)]"
                    />
                  )}
                  <span className="relative z-10 mt-0.5 flex size-6 items-center justify-center rounded-full border border-[var(--success-border)] bg-[var(--success-soft)] text-[var(--success)]">
                    <Check aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="technical-value text-[10px] text-[var(--text-tertiary)]">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="text-[13px] font-medium">{step.label}</span>
                    </div>
                    <p className="technical-value mt-0.5 truncate text-[10px] text-[var(--text-tertiary)]">
                      {step.detail}
                    </p>
                  </div>
                  <span className="technical-value pt-0.5 text-[10px] text-[var(--text-tertiary)]">
                    +{step.elapsed}
                  </span>
                </li>
              ))}
            </ol>

            <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--surface-subtle)] px-5 py-3">
              <span className="text-xs font-medium">Policy result</span>
              <span className="technical-value text-[10px] text-[var(--success)]">
                PASS · 16 MS
              </span>
            </div>
          </div>
          <p className="technical-value mt-3 text-[10px] text-[var(--text-tertiary)]">
            Sensitive values are redacted before storage.
          </p>
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
