import Link from "next/link";
import { ArrowRight, Github } from "lucide-react";
import { AuthometryLogo, Button } from "@authometry/ui";
import { LegalFooter } from "@/components/legal/legal-page";

export default function LandingPage() {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-[var(--background)]">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <AuthometryLogo />
        <nav className="flex items-center gap-1" aria-label="Primary">
          <Button asChild variant="ghost">
            <a href="https://github.com/jiayangc1/authometry" rel="noreferrer">
              <Github className="size-4" /> GitHub
            </a>
          </Button>
          <Button asChild>
            <Link href="/login">Open dashboard</Link>
          </Button>
        </nav>
      </header>
      <section className="mx-auto grid max-w-6xl items-center gap-16 px-5 py-20 lg:grid-cols-[0.82fr_1.18fr] lg:py-32">
        <div>
          <p className="mb-5 text-xs font-medium text-[var(--text-secondary)]">
            Transparent OAuth 2.0 and OpenID Connect infrastructure
          </p>
          <h1 className="max-w-xl text-[48px] leading-[1.02] font-semibold tracking-[-0.055em] sm:text-[64px]">
            Authometry
          </h1>
          <p className="mt-4 text-[24px] leading-8 font-medium tracking-[-0.025em]">
            OAuth you can see.
          </p>
          <p className="mt-6 max-w-lg text-[15px] leading-6 text-[var(--text-secondary)]">
            Authometry is an authorization server and administration dashboard that lets people
            securely sign in to applications with email, Google, or GitHub. Developers use it to
            register OAuth clients, issue OpenID Connect tokens, manage scopes and policies, and
            inspect every authorization decision.
          </p>
          <div className="mt-8 flex items-center gap-2">
            <Button asChild variant="primary">
              <Link href="/login">
                Open dashboard <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild>
              <a href="https://github.com/jiayangc1/authometry">View source</a>
            </Button>
          </div>
        </div>
        <TraceThesis />
      </section>
      <section
        aria-labelledby="authometry-purpose"
        className="mx-auto max-w-6xl border-t border-[var(--border)] px-5 py-16"
      >
        <div className="max-w-3xl">
          <p className="text-xs font-medium text-[var(--text-secondary)]">Application purpose</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em]" id="authometry-purpose">
            What Authometry does
          </h2>
          <p className="mt-4 text-[15px] leading-7 text-[var(--text-secondary)]">
            Authometry provides authentication and authorization infrastructure for web
            applications. It verifies user identities, issues OAuth 2.0 and OpenID Connect tokens,
            enforces application access policies, and gives administrators a clear audit trail of
            sign-in and consent decisions. Google and GitHub profile information is used only to
            authenticate the user and identify their Authometry account.
          </p>
        </div>
      </section>
      <LegalFooter />
    </main>
  );
}

function TraceThesis() {
  const steps = [
    ["Client verified", "dashboard", "passed"],
    ["Redirect URI matched", "/auth/callback", "passed"],
    ["PKCE challenge validated", "S256", "passed"],
    ["Scope denied", "admin:write", "failed"],
    ["Authorization code issued", "Not run", "skipped"],
  ] as const;
  return (
    <div className="border border-[var(--border)] bg-[var(--surface-raised)] shadow-[0_20px_60px_rgba(0,0,0,0.06)] dark:shadow-none">
      <div className="flex h-11 items-center justify-between border-b border-[var(--border-subtle)] px-4">
        <span className="technical-value text-[var(--text-secondary)]">req_a72b9c</span>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--danger)]">
          <span className="size-1.5 rounded-full bg-current" /> Denied
        </span>
      </div>
      <ol className="px-5 py-6">
        {steps.map(([name, value, status], index) => (
          <li className="relative grid grid-cols-[24px_1fr_auto] gap-3 pb-6 last:pb-0" key={name}>
            {index < steps.length - 1 && (
              <span
                className={`absolute top-4 bottom-0 left-[7px] w-px ${status === "failed" ? "bg-transparent" : "bg-[var(--border-strong)]"}`}
              />
            )}
            <span
              className={`relative mt-1 flex size-3.5 items-center justify-center rounded-full border-2 bg-[var(--surface-raised)] ${
                status === "passed"
                  ? "border-[var(--success)]"
                  : status === "failed"
                    ? "border-[var(--danger)]"
                    : "border-[var(--border-strong)]"
              }`}
            >
              {status !== "skipped" && <span className="size-1 rounded-full bg-current" />}
            </span>
            <span className={status === "skipped" ? "text-[var(--text-tertiary)]" : "font-medium"}>
              {name}
            </span>
            <span className="technical-value max-w-40 truncate text-[var(--text-secondary)]">
              {value}
            </span>
          </li>
        ))}
      </ol>
      <div className="border-t border-[var(--danger-border)] bg-[var(--danger-soft)] px-5 py-4">
        <p className="text-[13px] font-semibold text-[var(--danger)]">
          Scope admin:write is not assigned
        </p>
        <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
          Assign the scope to Dashboard or remove it from the request.
        </p>
      </div>
    </div>
  );
}
