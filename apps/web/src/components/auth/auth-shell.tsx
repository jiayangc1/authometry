import Link from "next/link";
import { Check } from "lucide-react";
import { AuthometryLogo, AuthometryMark } from "@authometry/ui";

const authorizationTrace = [
  { label: "Request received", detail: "GET /oauth/authorize", elapsed: "0.0" },
  { label: "Client verified", detail: "client credentials active", elapsed: "8.1" },
  { label: "Redirect URI matched", detail: "exact registered callback", elapsed: "11.4" },
  { label: "PKCE challenge validated", detail: "S256 proof verified", elapsed: "16.2" },
  { label: "Policy evaluated", detail: "production-admins · allow", elapsed: "17.9" },
];

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh bg-[var(--background)] pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="flex min-h-0 flex-col px-6 py-6 sm:px-10">
        <Link
          className="w-fit rounded-[var(--radius-control)] focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:outline-none"
          href="/"
        >
          <AuthometryLogo />
        </Link>
        <div className="mx-auto flex w-full max-w-[360px] flex-1 animate-[enter_var(--motion-slow)_var(--ease-out)] items-center py-12">
          {children}
        </div>
        <nav
          aria-label="Legal"
          className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-tertiary)]"
        >
          <span>© Authometry</span>
          {[
            ["Privacy", "/privacy"],
            ["Terms", "/terms"],
            ["Data deletion", "/data-deletion"],
          ].map(([label, href]) => (
            <Link
              className="transition-colors hover:text-[var(--text-primary)]"
              href={href!}
              key={href}
            >
              {label}
            </Link>
          ))}
        </nav>
      </section>
      <aside
        aria-hidden="true"
        className="relative hidden overflow-hidden border-l border-[var(--border)] bg-[var(--surface)] lg:flex lg:items-center lg:justify-center lg:p-12"
      >
        <div className="pointer-events-none absolute inset-0 [background-image:radial-gradient(var(--geist-gray-alpha-200)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)] [background-size:16px_16px]" />
        <div className="relative w-full max-w-md">
          <p className="technical-value mb-3 text-[var(--text-tertiary)]">authorization trace</p>
          <h2 className="text-[28px] leading-9 font-semibold tracking-[-0.04em] text-balance">
            Every decision leaves evidence.
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            Follow each check from the authorization request to the final policy decision, with the
            exact inputs that produced it.
          </p>
          <div className="mt-8 overflow-hidden rounded-[var(--radius-panel)] bg-[var(--surface-raised)] shadow-[var(--shadow-modal)]">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <div className="min-w-0">
                <p className="text-[13px] font-medium">Authorization request</p>
                <p className="technical-value truncate text-[11px] text-[var(--text-tertiary)]">
                  req_9f2a7c1d · authorization_code
                </p>
              </div>
              <span className="inline-flex h-5 items-center gap-1.5 rounded-full bg-[var(--success-soft)] px-2 text-[11px] font-medium text-[var(--success)]">
                <span className="size-1.5 rounded-full bg-[var(--success-solid)]" /> Authorized
              </span>
            </div>
            <ol className="stagger px-4 py-2">
              {authorizationTrace.map((step, index) => (
                <li className="relative grid grid-cols-[20px_1fr_auto] gap-3 py-2" key={step.label}>
                  {index < authorizationTrace.length - 1 && (
                    <span className="absolute top-7 bottom-[-8px] left-[9.5px] w-px bg-[var(--border)]" />
                  )}
                  <span className="relative z-10 mt-0.5 flex size-5 items-center justify-center rounded-full bg-[var(--success-soft)] text-[var(--success)]">
                    <Check className="size-3" strokeWidth={2.5} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium">{step.label}</p>
                    <p className="technical-value truncate text-[11px] text-[var(--text-tertiary)]">
                      {step.detail}
                    </p>
                  </div>
                  <span className="technical-value pt-0.5 text-[11px] text-[var(--text-tertiary)]">
                    +{step.elapsed}ms
                  </span>
                </li>
              ))}
            </ol>
            <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-2.5">
              <span className="text-xs text-[var(--text-secondary)]">
                Sensitive values redacted
              </span>
              <span className="technical-value text-[11px] text-[var(--success)]">
                allow · 17.9ms
              </span>
            </div>
          </div>
        </div>
      </aside>
    </main>
  );
}

export function AuthorizationShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col bg-[var(--surface)] pt-[max(1.5rem,env(safe-area-inset-top))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1.5rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] sm:items-center sm:justify-center sm:py-10">
      <section className="mx-auto flex w-full max-w-[420px] flex-1 animate-[enter_var(--motion-slow)_var(--ease-out)] flex-col justify-center sm:flex-none sm:rounded-[var(--radius-panel)] sm:bg-[var(--surface-raised)] sm:p-8 sm:shadow-[var(--shadow-raised)]">
        <Link
          aria-label="Authometry home"
          className="mx-auto mb-6 flex size-10 items-center justify-center rounded-full bg-[var(--surface-raised)] shadow-[var(--shadow-border),var(--shadow-small)] transition-transform duration-[var(--motion-normal)] ease-[var(--ease-spring)] hover:scale-105 focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:outline-none"
          href="/"
        >
          <AuthometryMark className="size-6" />
        </Link>
        {children}
      </section>
      <p className="mt-6 text-center text-xs text-[var(--text-tertiary)]">Secured by Authometry</p>
    </main>
  );
}

export function AuthHeading({
  title,
  description,
}: {
  title: string;
  description: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl leading-8 font-semibold tracking-[-0.03em] text-balance">{title}</h1>
      <p className="mt-1.5 text-sm leading-6 text-pretty text-[var(--text-secondary)]">
        {description}
      </p>
    </div>
  );
}

export { inputClass } from "@/components/ui/form";
