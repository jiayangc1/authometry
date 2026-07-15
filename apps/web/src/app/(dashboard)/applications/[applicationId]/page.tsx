"use client";

import { useState } from "react";
import { Button } from "@authometry/ui";
import { useApplication } from "@/components/applications/application-context";
import { CopyableValue } from "@/components/data-display/copyable-value";
import { DividerSection, SectionHeader } from "@/components/layout/page";
import { relativeTime } from "@/lib/format";

export default function ApplicationOverviewPage() {
  const { application } = useApplication();
  const [framework, setFramework] = useState("Next.js");
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
    typeof window === "undefined" ? "https://auth.example.com" : window.location.origin;
  const endpoints: Array<[string, string]> = [
    ["Issuer", issuer],
    ["Discovery", `${issuer}/.well-known/openid-configuration`],
    ["Authorization", `${issuer}/oauth/authorize`],
    ["Token", `${issuer}/oauth/token`],
    ["UserInfo", `${issuer}/oauth/userinfo`],
    ["JWKS", `${issuer}/.well-known/jwks.json`],
  ];
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
