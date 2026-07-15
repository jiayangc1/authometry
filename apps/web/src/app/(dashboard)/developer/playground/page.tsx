"use client";

import { useMemo, useState } from "react";
import { Copy, ExternalLink, RefreshCw } from "lucide-react";
import { Button, StatusBadge } from "@authometry/ui";
import { inputClass } from "@/components/auth/auth-shell";
import { PageContainer, PageHeader, SectionHeader } from "@/components/layout/page";

export default function PlaygroundPage() {
  const [clientId, setClientId] = useState("amt_client_dashboard");
  const [redirectUri, setRedirectUri] = useState("http://localhost:3000/callback");
  const [scopes, setScopes] = useState(["openid", "profile", "email"]);
  const [challenge, setChallenge] = useState("example-S256-challenge");
  const url = useMemo(() => {
    const value = new URL(
      "/oauth/authorize",
      typeof window === "undefined" ? "https://auth.example.com" : window.location.origin,
    );
    value.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: scopes.join(" "),
      code_challenge: challenge,
      code_challenge_method: "S256",
      state: "playground-state",
      nonce: "playground-nonce",
    }).toString();
    return value.toString();
  }, [clientId, redirectUri, scopes, challenge]);
  return (
    <PageContainer>
      <PageHeader
        description="Build and inspect an authorization flow without writing application code."
        title="OAuth playground"
      />
      <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
        <section>
          <SectionHeader title="Authorization request" />
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium">Client ID</span>
              <input
                className={`${inputClass} technical-value`}
                onChange={(event) => setClientId(event.target.value)}
                value={clientId}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium">Flow</span>
              <select className={inputClass}>
                <option>Authorization Code + PKCE</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium">Redirect URI</span>
              <input
                className={`${inputClass} technical-value`}
                onChange={(event) => setRedirectUri(event.target.value)}
                value={redirectUri}
              />
            </label>
            <fieldset>
              <legend className="mb-2 text-xs font-medium">Scopes</legend>
              <div className="flex flex-wrap gap-2">
                {["openid", "profile", "email", "offline_access"].map((scope) => (
                  <label
                    className="flex items-center gap-1.5 rounded-full border border-[var(--border)] px-2.5 py-1 text-xs"
                    key={scope}
                  >
                    <input
                      checked={scopes.includes(scope)}
                      onChange={(event) =>
                        setScopes(
                          event.target.checked
                            ? [...scopes, scope]
                            : scopes.filter((value) => value !== scope),
                        )
                      }
                      type="checkbox"
                    />
                    {scope}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="block">
              <span className="mb-1.5 flex items-center justify-between text-xs font-medium">
                PKCE challenge
                <Button
                  onClick={() => setChallenge(crypto.randomUUID().replaceAll("-", ""))}
                  size="compact"
                  variant="ghost"
                >
                  <RefreshCw className="size-3" /> Regenerate
                </Button>
              </span>
              <input
                className={`${inputClass} technical-value`}
                onChange={(event) => setChallenge(event.target.value)}
                value={challenge}
              />
            </label>
          </div>
        </section>
        <aside>
          <SectionHeader title="Inspection" />
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)]">
            <div className="flex h-10 items-center justify-between border-b border-[var(--border)] px-3">
              <span className="text-xs font-medium">Generated authorization URL</span>
              <Button
                onClick={() => void navigator.clipboard.writeText(url)}
                size="compact"
                variant="ghost"
              >
                <Copy className="size-3" /> Copy URL
              </Button>
            </div>
            <pre className="max-h-56 scrollbar-thin overflow-auto p-4 text-xs leading-5 break-all whitespace-pre-wrap">
              {decodeURIComponent(url).replaceAll("&", "\n&")}
            </pre>
          </div>
          <div className="mt-4 space-y-2 rounded-lg border border-[var(--border)] p-4">
            <p className="text-xs font-semibold">Security checks</p>
            <div className="flex items-center justify-between text-xs">
              <span>Exact redirect URI</span>
              <StatusBadge label="Required" tone="success" />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span>PKCE method</span>
              <StatusBadge label="S256" tone="success" />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span>State and nonce</span>
              <StatusBadge label="Included" tone="success" />
            </div>
          </div>
          <Button asChild className="mt-4 w-full" variant="primary">
            <a href={url} rel="noreferrer" target="_blank">
              Open authorization request <ExternalLink className="size-3.5" />
            </a>
          </Button>
        </aside>
      </div>
    </PageContainer>
  );
}
