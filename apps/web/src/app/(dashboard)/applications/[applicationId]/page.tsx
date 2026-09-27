"use client";

import type { ReactNode } from "react";
import { AuthometryProviderButton } from "@authometry/ui";
import { useApplication } from "@/components/applications/application-context";
import { CodeBlock, CopyableValue } from "@/components/data-display/copyable-value";
import { RelativeTime } from "@/components/data-display/formatted-time";
import { DescriptionList, SectionHeader } from "@/components/layout/page";
import { SegmentedControl } from "@/components/ui/tabs";
import { useActiveEnvironment } from "@/lib/use-environment";
import { humanize } from "@/lib/status";
import { useQueryParams } from "@/lib/use-query-params";

const frameworks = ["Next.js", "React", "Express", "Go", "Other"] as const;
type Framework = (typeof frameworks)[number];

function snippet(framework: Framework, issuer: string, clientId: string, redirectUri: string) {
  switch (framework) {
    case "Next.js":
      return {
        label: "auth.ts · Auth.js",
        code: `import NextAuth from "next-auth";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    {
      id: "authometry",
      name: "Authometry",
      type: "oidc",
      issuer: process.env.AUTHOMETRY_ISSUER, // ${issuer}
      clientId: process.env.AUTHOMETRY_CLIENT_ID, // ${clientId}
      clientSecret: process.env.AUTHOMETRY_CLIENT_SECRET,
    },
  ],
});`,
      };
    case "React":
      return {
        label: "auth.ts · oidc-client-ts",
        code: `import { UserManager } from "oidc-client-ts";

export const auth = new UserManager({
  authority: "${issuer}",
  client_id: "${clientId}",
  redirect_uri: "${redirectUri}",
  response_type: "code", // Authorization Code + PKCE
  scope: "openid profile email",
});

// Start sign-in:   await auth.signinRedirect();
// On the callback: await auth.signinRedirectCallback();`,
      };
    case "Express":
      return {
        label: "auth.js · openid-client",
        code: `import * as client from "openid-client";

const config = await client.discovery(
  new URL("${issuer}"),
  "${clientId}",
  process.env.AUTHOMETRY_CLIENT_SECRET,
);

app.get("/auth/login", async (req, res) => {
  const verifier = client.randomPKCECodeVerifier();
  req.session.verifier = verifier;
  const url = client.buildAuthorizationUrl(config, {
    redirect_uri: "${redirectUri}",
    scope: "openid profile email",
    code_challenge: await client.calculatePKCECodeChallenge(verifier),
    code_challenge_method: "S256",
  });
  res.redirect(url.href);
});`,
      };
    case "Go":
      return {
        label: "auth.go · go-oidc",
        code: `provider, err := oidc.NewProvider(ctx, "${issuer}")
if err != nil {
    log.Fatal(err)
}

config := oauth2.Config{
    ClientID:     "${clientId}",
    ClientSecret: os.Getenv("AUTHOMETRY_CLIENT_SECRET"),
    Endpoint:     provider.Endpoint(),
    RedirectURL:  "${redirectUri}",
    Scopes:       []string{oidc.ScopeOpenID, "profile", "email"},
}`,
      };
    default:
      return {
        label: ".env",
        code: `AUTHOMETRY_ISSUER=${issuer}
AUTHOMETRY_DISCOVERY_URL=${issuer}/.well-known/openid-configuration
AUTHOMETRY_CLIENT_ID=${clientId}
AUTHOMETRY_CLIENT_SECRET=<create one under Credentials>
AUTHOMETRY_REDIRECT_URI=${redirectUri}`,
      };
  }
}

export default function ApplicationOverviewPage() {
  const { application } = useApplication();
  const [parameters, update] = useQueryParams();
  const { active } = useActiveEnvironment();
  const frameworkParam = parameters.get("framework");
  const framework: Framework = frameworks.includes(frameworkParam as Framework)
    ? (frameworkParam as Framework)
    : "Next.js";
  const appearanceParam = parameters.get("appearance");
  const buttonAppearance: "light" | "dark" | "brand" =
    appearanceParam === "dark" || appearanceParam === "brand" ? appearanceParam : "light";
  if (!application) return null;
  const issuer = active?.issuer ?? "";
  const redirectUri = application.redirect_uris[0] ?? "https://your-app.example/auth/callback";
  const metadata: Array<[string, ReactNode]> = [
    ["Application ID", <CopyableValue key="slug" value={application.slug} />],
    ["Client ID", <CopyableValue key="client" value={application.client_id} />],
    ["Type", humanize(application.type)],
    [
      "Callback URLs",
      application.redirect_uris.length ? (
        <span className="technical-value">{application.redirect_uris.join(", ")}</span>
      ) : (
        <span className="text-[var(--text-tertiary)]">None configured</span>
      ),
    ],
    ["Created", <RelativeTime key="created" value={application.created_at} />],
    [
      "Last used",
      application.last_used_at ? (
        <RelativeTime key="last-used" value={application.last_used_at} />
      ) : (
        "Never"
      ),
    ],
  ];
  const endpoints: Array<[string, ReactNode]> = issuer
    ? [
        ["Issuer", issuer],
        ["Discovery", `${issuer}/.well-known/openid-configuration`],
        ["Authorization", `${issuer}/oauth/authorize`],
        ["Token", `${issuer}/oauth/token`],
        ["UserInfo", `${issuer}/oauth/userinfo`],
        ["JWKS", `${issuer}/.well-known/jwks.json`],
      ].map(([label, value]) => [label!, <CopyableValue key={label} value={value!} />])
    : [];
  const { code, label } = snippet(framework, issuer, application.client_id, redirectUri);
  const buttonMarkup = `<a class="authometry-button" href="/auth/login">
  <img src="${issuer || "https://your-authometry"}/brand/authometry-mark.svg" alt="" width="24" height="24" />
  Continue with Authometry
</a>

<style>
  .authometry-button {
    display: inline-flex; height: 44px; align-items: center; gap: 10px;
    padding: 0 16px; border: 1px solid #d8d8df; border-radius: 10px;
    background: transparent; color: #18181b;
    font: 600 14px/1 system-ui, sans-serif; text-decoration: none;
  }
  .authometry-button:hover { background: rgb(99 91 255 / 6%); border-color: #aaa5c5; }
  .authometry-button:focus-visible { outline: 2px solid #0070f3; outline-offset: 2px; }
</style>`;

  return (
    <div className="space-y-10">
      <section>
        <SectionHeader title="Details" />
        <DescriptionList items={metadata} />
      </section>
      <section>
        <SectionHeader
          actions={
            <SegmentedControl
              label="Framework"
              onChange={(value) => update({ framework: value === "Next.js" ? undefined : value })}
              options={frameworks.map((value) => ({ value, label: value }))}
              size="compact"
              value={framework}
            />
          }
          description={`Connect your app to the ${active?.name ?? "current"} environment.`}
          title="Quickstart"
        />
        <CodeBlock
          code={code}
          key={framework}
          label={label}
          className="animate-[fade-in_var(--motion-normal)_var(--ease-out)]"
        />
      </section>
      <section>
        <SectionHeader
          title="Endpoints"
          description="OpenID Connect endpoints for this environment."
        />
        <DescriptionList items={endpoints} />
      </section>
      <section>
        <SectionHeader
          description="A recognizable entry point for your sign-in page. Link it to your app’s login route, which starts Authorization Code with PKCE."
          title="Sign-in button"
        />
        <div className="grid overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
          <div
            className={`flex min-h-56 flex-col items-center justify-center gap-5 p-6 transition-colors duration-[var(--motion-normal)] ${buttonAppearance === "dark" ? "bg-[#0a0a0a]" : "bg-[var(--surface-subtle)]"}`}
          >
            <AuthometryProviderButton appearance={buttonAppearance} tabIndex={-1} />
            <SegmentedControl
              label="Button appearance"
              onChange={(value) => update({ appearance: value === "light" ? undefined : value })}
              options={[
                { value: "light", label: "Light" },
                { value: "brand", label: "Brand" },
                { value: "dark", label: "Dark" },
              ]}
              size="compact"
              value={buttonAppearance}
            />
          </div>
          <CodeBlock
            className="rounded-none border-0 border-t border-[var(--border)] lg:border-t-0 lg:border-l"
            code={buttonMarkup}
            label="HTML + CSS"
            maxHeight="224px"
          />
        </div>
      </section>
    </div>
  );
}
