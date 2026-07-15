import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";
import { AuthometryLogo, Button } from "@authometry/ui";

const sections = [
  [
    "applications",
    "Applications",
    "Register exact redirect URIs, select an application type, and assign only the scopes the client needs.",
  ],
  [
    "oauth/pkce",
    "Authorization Code with PKCE",
    "Generate a high-entropy verifier, send its S256 challenge during authorization, and submit the original verifier once at the token endpoint.",
  ],
  [
    "oauth/redirect-uris",
    "Redirect URI matching",
    "Authometry compares the complete redirect URI against registered values. Scheme, host, port, path, and query must match exactly.",
  ],
  [
    "configuration-as-code",
    "Configuration as code",
    "Use authometry.dev/v1alpha1 manifests with validate, plan, apply, status, and export. Applies are atomic and record provenance without secret values.",
  ],
] as const;

export default async function DocsPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const path = (await params).slug?.join("/") ?? "";
  const selected = sections.find(([key]) => key === path);
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-5 py-8">
      <header className="flex items-center justify-between border-b border-[var(--border)] pb-5">
        <AuthometryLogo />
        <Button asChild variant="ghost">
          <Link href="/overview">
            <ArrowLeft className="size-3.5" /> Dashboard
          </Link>
        </Button>
      </header>
      <div className="grid gap-10 py-10 md:grid-cols-[220px_1fr]">
        <nav aria-label="Documentation">
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold">
            <BookOpen className="size-3.5" /> Documentation
          </p>
          <div className="space-y-1">
            {sections.map(([key, title]) => (
              <Link
                className="block rounded px-2 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                href={`/docs/${key}`}
                key={key}
              >
                {title}
              </Link>
            ))}
          </div>
        </nav>
        <article>
          <p className="technical-value mb-2 text-[var(--accent)]">AUTHOMETRY DOCUMENTATION</p>
          <h1 className="text-3xl font-semibold tracking-[-0.035em]">
            {selected?.[1] ?? "Authorization you can inspect"}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">
            {selected?.[2] ??
              "Authometry implements modern OAuth 2.0 and OpenID Connect flows with exact validation, explicit policies, redacted traces, and Git-native configuration."}
          </p>
          <div className="mt-8 border-l-2 border-[var(--accent)] bg-[var(--accent-soft)] p-4 text-sm leading-6">
            Protocol errors include a stable OAuth code, the observed condition, the expected
            condition, a technical explanation, and an exact corrective action.
          </div>
        </article>
      </div>
    </main>
  );
}
