"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { AuthometryProviderButton, Button } from "@authometry/ui";
import { useApplication } from "@/components/applications/application-context";
import { CopyableValue } from "@/components/data-display/copyable-value";
import { DividerSection, SectionHeader } from "@/components/layout/page";
import { relativeTime } from "@/lib/format";

export default function ApplicationOverviewPage() {
  const { application } = useApplication();
  const [framework, setFramework] = useState("Next.js");
  const [buttonAppearance, setButtonAppearance] = useState<"light" | "dark" | "brand">("light");
  const [buttonCopied, setButtonCopied] = useState(false);
  if (!application) return null;
  const metadata: Array<[string, string]> = [
    ["Application ID", application.slug],
    ["Client ID", application.client_id],
    ["Application type", application.type],
    ["Created", relativeTime(application.created_at)],
    ["Last used", application.last_used_at ? relativeTime(application.last_used_at) : "Never"],
  ];
  const code = `import { Authometry } from "@authometry/next";\n\nexport const auth = new Authometry({\n  issuer: process.env.AUTHOMETRY_ISSUER!,\n  clientId: process.env.AUTHOMETRY_CLIENT_ID!,\n  clientSecret: process.env.AUTHOMETRY_CLIENT_SECRET!,\n});`;
  const issuer =
    typeof window === "undefined" ? "https://authometry.ch3n.cc" : window.location.origin;
  const endpoints: Array<[string, string]> = [
    ["Issuer", issuer],
    ["Discovery", `${issuer}/.well-known/openid-configuration`],
    ["Authorization", `${issuer}/oauth/authorize`],
    ["Token", `${issuer}/oauth/token`],
    ["UserInfo", `${issuer}/oauth/userinfo`],
    ["JWKS", `${issuer}/.well-known/jwks.json`],
  ];
  const buttonMarkup = `<a class="authometry-button" href="/auth/login">
  <img src="${issuer}/brand/authometry-icon-192.png" alt="" />
  Continue with Authometry
</a>

<style>
  .authometry-button {
    display: inline-flex; height: 44px; align-items: center; gap: 10px;
    padding: 0 16px; border: 1px solid #d8d8df; border-radius: 10px;
    background: #fff; color: #18181b; box-shadow: 0 1px 2px rgb(15 23 42 / 8%);
    font: 600 14px/1 system-ui, sans-serif; text-decoration: none;
  }
  .authometry-button:hover { background: #fafaff; border-color: #bbb9cb; }
  .authometry-button:focus-visible { outline: 2px solid #7c73ff; outline-offset: 2px; }
  .authometry-button img { width: 24px; height: 24px; }
</style>`;

  const copyButtonMarkup = async () => {
    await navigator.clipboard.writeText(buttonMarkup);
    setButtonCopied(true);
    window.setTimeout(() => setButtonCopied(false), 1800);
  };
  return (
    <div className="space-y-8">
      <section>
        <SectionHeader
          description="Stable identifiers and protocol metadata for this client."
          title="Application details"
        />
        <dl className="divide-y divide-[var(--border-subtle)] border-y border-[var(--border)]">
          {metadata.map(([label, value]) => (
            <div className="grid gap-1 py-3 sm:grid-cols-[180px_1fr]" key={label}>
              <dt className="text-xs text-[var(--text-secondary)]">{label}</dt>
              <dd className="text-[13px]">
                {label.includes("ID") ? <CopyableValue value={value} /> : value}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <DividerSection>
        <SectionHeader
          description="Use these values to connect your application."
          title="Connect your application"
        />
        <div className="flex gap-1 overflow-x-auto border-b border-[var(--border)]">
          {["Next.js", "React", "Express", "Go", "Other"].map((item) => (
            <button
              className={`border-b-2 px-3 py-2 text-xs ${framework === item ? "border-[var(--accent)] font-medium" : "border-transparent text-[var(--text-secondary)]"}`}
              key={item}
              onClick={() => setFramework(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          <div className="flex h-9 items-center justify-between border-b border-[var(--border)] px-3">
            <span className="technical-value text-[var(--text-secondary)]">
              TypeScript · {framework}
            </span>
            <Button size="compact" variant="ghost">
              Copy
            </Button>
          </div>
          <pre className="scrollbar-thin overflow-x-auto p-4 text-[13px] leading-5">
            <code>{code}</code>
          </pre>
        </div>
      </DividerSection>
      <DividerSection>
        <SectionHeader
          description="Add a recognizable entry point to your application. Its route should start Authorization Code with PKCE on your server."
          title="Sign-in button"
        />
        <div className="grid overflow-hidden rounded-xl border border-[var(--border)] lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
          <div
            className={`flex min-h-52 flex-col items-center justify-center gap-5 p-6 ${buttonAppearance === "dark" ? "bg-[#0f0f11]" : "bg-[var(--surface-subtle)]"}`}
          >
            <AuthometryProviderButton appearance={buttonAppearance} />
            <div className="flex rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-1">
              {(["light", "brand", "dark"] as const).map((appearance) => (
                <button
                  className={`rounded-md px-2.5 py-1 text-xs capitalize ${buttonAppearance === appearance ? "bg-[var(--accent-soft)] font-medium text-[var(--accent)]" : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"}`}
                  key={appearance}
                  onClick={() => setButtonAppearance(appearance)}
                  type="button"
                >
                  {appearance}
                </button>
              ))}
            </div>
          </div>
          <div className="min-w-0 border-t border-[var(--border)] bg-[var(--surface-raised)] lg:border-t-0 lg:border-l">
            <div className="flex h-10 items-center justify-between border-b border-[var(--border)] px-3">
              <span className="technical-value text-[var(--text-secondary)]">HTML + CSS</span>
              <Button onClick={() => void copyButtonMarkup()} size="compact" variant="ghost">
                {buttonCopied ? (
                  <Check className="size-3 text-[var(--success)]" />
                ) : (
                  <Copy className="size-3" />
                )}
                {buttonCopied ? "Copied" : "Copy"}
              </Button>
            </div>
            <pre className="max-h-52 scrollbar-thin overflow-auto p-4 text-xs leading-5">
              <code>{buttonMarkup}</code>
            </pre>
          </div>
        </div>
        <p className="mt-3 text-xs leading-5 text-[var(--text-secondary)]">
          The button links to your app’s login handler—not directly to a static authorization URL.
          That handler creates fresh <code className="technical-value">state</code>,{" "}
          <code className="technical-value">nonce</code>, and PKCE values before redirecting to
          Authometry.
        </p>
      </DividerSection>
      <DividerSection>
        <SectionHeader title="Endpoints" />
        <dl className="divide-y divide-[var(--border-subtle)] border-y border-[var(--border)]">
          {endpoints.map(([label, value]) => (
            <div className="grid items-center gap-1 py-2.5 sm:grid-cols-[180px_1fr]" key={label}>
              <dt className="text-xs text-[var(--text-secondary)]">{label}</dt>
              <dd>
                <CopyableValue value={value} />
              </dd>
            </div>
          ))}
        </dl>
      </DividerSection>
    </div>
  );
}
