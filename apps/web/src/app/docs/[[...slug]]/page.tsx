import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, Braces, KeyRound, ShieldCheck } from "lucide-react";
import { AuthometryLogo, Button, Note } from "@authometry/ui";
import { CodeBlock } from "@/components/data-display/copyable-value";
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
            <p className="mb-1 flex items-center gap-2 px-2.5 text-xs text-[var(--text-tertiary)]">
              <Icon aria-hidden="true" className="size-3" /> {group}
            </p>
            <div className="space-y-px">
              {documentationPages
                .filter((page) => page.group === group)
                .map((page) => (
                  <Link
                    aria-current={selected?.slug === page.slug ? "page" : undefined}
                    className={`flex h-8 items-center rounded-[var(--radius-control)] px-2.5 text-[13px] transition-colors duration-[var(--motion-fast)] focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:outline-none ${
                      selected?.slug === page.slug
                        ? "bg-[var(--surface-active)] font-medium text-[var(--text-primary)]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
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
      <p className="technical-value mb-3 text-[var(--text-tertiary)]">Documentation</p>
      <h1 className="max-w-2xl text-[32px] leading-10 font-semibold tracking-[-0.04em] text-balance md:text-[40px] md:leading-[48px]">
        Follow the request. Find the decision.
      </h1>
      <p className="mt-5 max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">
        Configure clients, implement supported OAuth flows, and operate each environment with the
        same exact inputs Authometry records in its authorization traces.
      </p>
      <div className="stagger mt-10 grid gap-3 sm:grid-cols-2">
        {documentationPages.map((page) => (
          <Link
            className="lift group min-h-36 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-raised)] p-5 focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:outline-none"
            href={`/docs/${page.slug}`}
            key={page.slug}
          >
            <p className="technical-value text-[var(--text-tertiary)]">{page.group}</p>
            <h2 className="mt-3 flex items-center justify-between text-base font-semibold tracking-[-0.02em]">
              {page.title}
              <ArrowRight
                aria-hidden="true"
                className="size-4 text-[var(--text-tertiary)] transition-[transform,color] duration-[var(--motion-normal)] ease-[var(--ease-spring)] group-hover:translate-x-1 group-hover:text-[var(--text-primary)]"
              />
            </h2>
            <p className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">
              {page.summary}
            </p>
          </Link>
        ))}
      </div>
    </article>
  );
}

function Article({ page }: { page: DocumentationPage }) {
  return (
    <>
      <article className="min-w-0 animate-[enter_var(--motion-slow)_var(--ease-out)]">
        <p className="technical-value mb-3 text-[var(--text-tertiary)]">{page.group}</p>
        <h1 className="text-[32px] leading-10 font-semibold tracking-[-0.04em] text-balance">
          {page.title}
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">
          {page.summary}
        </p>
        <div className="mt-10 space-y-12">
          {page.sections.map((section) => (
            <section className="scroll-mt-20" id={slugId(section.title)} key={section.title}>
              <div className="mb-5 flex items-center gap-3 border-b border-[var(--border)] pb-3">
                <Braces aria-hidden="true" className="size-3.5 text-[var(--text-tertiary)]" />
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
                      <li
                        className="list-disc pl-1 marker:text-[var(--text-tertiary)]"
                        key={bullet}
                      >
                        {bullet}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {section.code ? <CodeBlock code={section.code} label="Example" /> : null}
                {section.note ? <Note tone="info">{section.note}</Note> : null}
              </div>
            </section>
          ))}
        </div>
      </article>
      <aside className="hidden xl:block">
        <div className="sticky top-8 border-l border-[var(--border)] pl-5">
          <p className="mb-3 text-xs font-medium text-[var(--text-primary)]">On this page</p>
          <div className="space-y-2">
            {page.sections.map((section) => (
              <a
                className="block text-[13px] leading-5 text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
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
      <header className="flex items-center justify-between border-b border-[var(--border)] pb-4">
        <Link
          aria-label="Documentation home"
          className="rounded-[var(--radius-control)] focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:outline-none"
          href="/docs"
        >
          <AuthometryLogo />
        </Link>
        <Button asChild className="[&:hover_svg]:-translate-x-0.5" variant="ghost">
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
