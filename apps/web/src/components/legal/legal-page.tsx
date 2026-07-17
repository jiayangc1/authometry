import Link from "next/link";
import { AuthometryLogo } from "@authometry/ui";

export function LegalPage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-dvh bg-[var(--background)]">
      <header className="border-b border-[var(--border)]">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-5">
          <Link
            href="/"
            className="rounded-md focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:outline-none"
          >
            <AuthometryLogo />
          </Link>
          <Link
            className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            href="/login"
          >
            Open dashboard
          </Link>
        </div>
      </header>
      <article className="mx-auto max-w-3xl px-5 py-14 sm:py-20">
        <p className="text-xs font-medium text-[var(--text-tertiary)]">AUTHOMETRY LEGAL</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em]">{title}</h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-7 text-[var(--text-secondary)]">
          {description}
        </p>
        <p className="mt-3 text-xs text-[var(--text-tertiary)]">Effective July 17, 2026</p>
        <div className="mt-12 space-y-10 text-sm leading-7 text-[var(--text-secondary)] [&_a]:font-medium [&_a]:text-[var(--text-primary)] [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-[-0.025em] [&_h2]:text-[var(--text-primary)] [&_li]:ml-5 [&_li]:list-disc [&_p+p]:mt-3">
          {children}
        </div>
      </article>
      <LegalFooter />
    </main>
  );
}

export function LegalFooter() {
  return (
    <footer className="border-t border-[var(--border)]">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-5 gap-y-2 px-5 py-7 text-xs text-[var(--text-tertiary)]">
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
        <a
          className="hover:text-[var(--text-primary)]"
          href="https://github.com/jiayangc1/authometry"
          rel="noreferrer"
        >
          Source
        </a>
      </div>
    </footer>
  );
}
