import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, Braces, KeyRound, ShieldCheck } from "lucide-react";
import { AuthometryLogo, Button } from "@authometry/ui";
import { SkipLink } from "@/components/layout/skip-link";
import {
  documentationGroups,
  documentationPages,
  type DocumentationPage,
} from "@/config/documentation";

const groupIcons = {
  Start: BookOpen,
  "OAuth and OIDC": KeyRound,
  Operate: ShieldCheck,
} as const;

function slugId(value: string) {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
}

function Navigation({ selected }: { selected: DocumentationPage | undefined }) {
  return (
    <nav aria-label="Documentation" className="space-y-6 md:sticky md:top-8 md:self-start">
      {documentationGroups.map((group) => {
        const Icon = groupIcons[group];
        return (
          <div key={group}>
            <p className="mb-2 flex items-center gap-2 px-2 text-[10px] font-semibold tracking-[0.12em] text-[var(--text-tertiary)] uppercase">
              <Icon aria-hidden="true" className="size-3" /> {group}
            </p>
            <div className="space-y-0.5">
              {documentationPages
                .filter((page) => page.group === group)
                .map((page) => (
                  <Link
                    aria-current={selected?.slug === page.slug ? "page" : undefined}
                    className={`block border-l-2 px-3 py-2 text-xs leading-5 transition-colors ${
                      selected?.slug === page.slug
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] font-medium text-[var(--text-primary)]"
                        : "border-transparent text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
                    }`}
                    href={`/docs/${page.slug}`}
                    key={page.slug}
                  >
                    {page.title}
                  </Link>
                ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

function DocumentationIndex() {
  return (
    <article>
      <p className="technical-value mb-3 text-[var(--accent)]">AUTHOMETRY FIELD MANUAL</p>
      <h1 className="max-w-2xl text-4xl font-semibold tracking-[-0.045em] text-balance md:text-5xl">
        Follow the request. Find the decision.
      </h1>
      <p className="mt-5 max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">
        Configure clients, implement supported OAuth flows, and operate each environment with the
        same exact inputs Authometry records in its authorization traces.
      </p>
      <div className="mt-10 grid gap-px overflow-hidden border border-[var(--border)] bg-[var(--border)] sm:grid-cols-2">
        {documentationPages.map((page) => (
          <Link
            className="group min-h-40 bg-[var(--surface)] p-5 transition-colors hover:bg-[var(--surface-hover)]"
            href={`/docs/${page.slug}`}
            key={page.slug}
          >
            <p className="technical-value text-[var(--text-tertiary)]">{page.group}</p>
            <h2 className="mt-4 flex items-center justify-between text-base font-semibold tracking-[-0.02em]">
              {page.title}
              <ArrowRight
                aria-hidden="true"
                className="size-4 text-[var(--text-tertiary)] transition-transform group-hover:translate-x-1 group-hover:text-[var(--accent)]"
              />
            </h2>
            <p className="mt-3 text-xs leading-6 text-[var(--text-secondary)]">{page.summary}</p>
          </Link>
        ))}
      </div>
    </article>
  );
}

function Article({ page }: { page: DocumentationPage }) {
  return (
    <>
      <article className="min-w-0">
        <p className="technical-value mb-3 text-[var(--accent)]">{page.group}</p>
        <h1 className="text-3xl font-semibold tracking-[-0.04em] text-balance md:text-4xl">
          {page.title}
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">
          {page.summary}
        </p>
        <div className="mt-10 space-y-12">
          {page.sections.map((section) => (
            <section className="scroll-mt-20" id={slugId(section.title)} key={section.title}>
              <div className="mb-5 flex items-center gap-3 border-b border-[var(--border)] pb-3">
                <Braces aria-hidden="true" className="size-3.5 text-[var(--accent)]" />
                <h2 className="text-lg font-semibold tracking-[-0.025em] text-balance">
                  {section.title}
                </h2>
              </div>
              <div className="max-w-3xl space-y-4 text-sm leading-7 text-[var(--text-secondary)]">
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {section.bullets ? (
                  <ul className="space-y-2 pl-5">
                    {section.bullets.map((bullet) => (
                      <li className="list-[square] pl-1 marker:text-[var(--accent)]" key={bullet}>
                        {bullet}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {section.code ? (
                  <pre className="overflow-x-auto border border-[var(--border)] bg-[var(--surface-subtle)] p-4 text-xs leading-6 text-[var(--text-primary)]">
                    <code>{section.code}</code>
                  </pre>
                ) : null}
                {section.note ? (
                  <div className="border-l-2 border-[var(--accent)] bg-[var(--accent-soft)] px-4 py-3 text-xs leading-6 text-[var(--text-primary)]">
                    {section.note}
                  </div>
                ) : null}
              </div>
            </section>
          ))}
        </div>
      </article>
      <aside className="hidden xl:block">
        <div className="sticky top-8 border-l border-[var(--border)] pl-5">
          <p className="technical-value mb-3 text-[var(--text-tertiary)]">ON THIS PAGE</p>
          <div className="space-y-2">
            {page.sections.map((section) => (
              <a
                className="block text-xs leading-5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                href={`#${slugId(section.title)}`}
                key={section.title}
              >
                {section.title}
              </a>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}

export default async function DocsPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const path = (await params).slug?.join("/") ?? "";
  const selected = documentationPages.find((page) => page.slug === path);
  return (
    <div className="mx-auto min-h-screen max-w-[1440px] pt-[max(1.5rem,env(safe-area-inset-top))] pr-[max(1.25rem,env(safe-area-inset-right))] pb-[max(1.5rem,env(safe-area-inset-bottom))] pl-[max(1.25rem,env(safe-area-inset-left))] md:pr-[max(2rem,env(safe-area-inset-right))] md:pl-[max(2rem,env(safe-area-inset-left))]">
      <SkipLink />
      <header className="flex items-center justify-between border-b border-[var(--border)] pb-5">
        <Link aria-label="Documentation home" href="/docs">
          <AuthometryLogo />
        </Link>
        <Button asChild variant="ghost">
          <Link href="/overview">
            <ArrowLeft aria-hidden="true" className="size-3.5" /> Dashboard
          </Link>
        </Button>
      </header>
      <main
        className="grid gap-10 py-10 md:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,760px)_180px] xl:gap-14"
        id="main-content"
        tabIndex={-1}
      >
        <Navigation selected={selected} />
        {selected ? <Article page={selected} /> : <DocumentationIndex />}
      </main>
    </div>
  );
}
