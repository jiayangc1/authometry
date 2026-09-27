"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Github } from "lucide-react";
import { Button, GoogleIcon, Note } from "@authometry/ui";
import { AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { Field, Input } from "@/components/ui/form";
import { PasswordInput } from "@/components/ui/password-input";
import { apiFetch } from "@/lib/api";
import { useHydrated } from "@/lib/use-hydrated";

function localReturnTo(value: string): string {
  if (!value.startsWith("/")) return "/overview";
  const base = "https://authometry.local";
  try {
    const parsed = new URL(value, base);
    return parsed.origin === base
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : "/overview";
  } catch {
    return "/overview";
  }
}

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const hydrated = useHydrated();
  const [bootstrapRequired, setBootstrapRequired] = useState(false);
  const [providers, setProviders] = useState({ google: false, github: false });
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const returnTo = localReturnTo(params.get("returnTo") ?? "");
  const isMcpAuthorization = returnTo.startsWith("/authorize/consent");

  useEffect(() => {
    void apiFetch<{ bootstrapRequired: boolean }>("/api/v1/auth/bootstrap/status")
      .then((result) => setBootstrapRequired(result.bootstrapRequired))
      .catch(() => undefined);
    void apiFetch<{ google: boolean; github: boolean }>("/api/v1/auth/providers")
      .then(setProviders)
      .catch(() => undefined);
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(undefined);
    const data = new FormData(event.currentTarget);
    try {
      await apiFetch("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: data.get("email"), password: data.get("password") }),
      });
      router.push(returnTo);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign in failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <div className="w-full">
        <AuthHeading
          title="Sign in to Authometry"
          description={
            isMcpAuthorization
              ? "Sign in with your admin account to review an MCP connection request."
              : "Manage applications, policies, identities, and authorization traces."
          }
        />
        {bootstrapRequired && (
          <Note className="mb-5" tone="info">
            This installation needs its first owner.{" "}
            <Link href="/bootstrap">Set up Authometry</Link>
          </Note>
        )}
        {(providers.google || providers.github) && (
          <>
            <div className="grid gap-2">
              {providers.google && (
                <Button asChild size="large">
                  <a href={`/api/v1/auth/social/google?return_to=${encodeURIComponent(returnTo)}`}>
                    <GoogleIcon className="size-4" /> Continue with Google
                  </a>
                </Button>
              )}
              {providers.github && (
                <Button asChild size="large">
                  <a href={`/api/v1/auth/social/github?return_to=${encodeURIComponent(returnTo)}`}>
                    <Github aria-hidden="true" className="size-4" /> Continue with GitHub
                  </a>
                </Button>
              )}
            </div>
            <div className="my-5 flex items-center gap-3 text-xs text-[var(--text-tertiary)] before:h-px before:flex-1 before:bg-[var(--border)] after:h-px after:flex-1 after:bg-[var(--border)]">
              or with email
            </div>
          </>
        )}
        <form className="space-y-4" method="post" onSubmit={submit}>
          <Field label="Email">
            <Input
              autoComplete="email"
              autoFocus
              className="h-10"
              name="email"
              placeholder="you@company.com"
              required
              spellCheck={false}
              type="email"
            />
          </Field>
          <Field
            label="Password"
            labelAction={
              <Link
                className="text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                href="/forgot-password"
              >
                Forgot password?
              </Link>
            }
          >
            <PasswordInput
              autoComplete="current-password"
              large
              minLength={12}
              name="password"
              required
            />
          </Field>
          {error && (
            <Note role="alert" tone="danger">
              {error}
            </Note>
          )}
          <Button
            className="w-full"
            disabled={!hydrated}
            loading={loading}
            size="large"
            type="submit"
            variant="primary"
          >
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}
