"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Github, ShieldCheck } from "lucide-react";
import { Button, GoogleIcon, Note } from "@authometry/ui";
import { AuthorizationShell } from "@/components/auth/auth-shell";
import { Field, Input } from "@/components/ui/form";
import { PasswordInput } from "@/components/ui/password-input";
import { ApiClientError, apiFetch } from "@/lib/api";
import { useHydrated } from "@/lib/use-hydrated";

export default function AuthorizationLoginPage() {
  const params = useSearchParams();
  const hydrated = useHydrated();
  const requestId = params.get("request_id") ?? "";
  const linkToken = params.get("link_token") ?? "";
  const linkProvider = params.get("provider") === "github" ? "GitHub" : "Google";
  const request = useQuery({
    queryKey: ["authorize-request", requestId],
    queryFn: () =>
      apiFetch<{ application: { name: string }; workspace: { name: string } }>(
        `/api/v1/authorize/requests/${requestId}`,
      ),
    enabled: Boolean(requestId),
  });
  const providers = useQuery({
    queryKey: ["authorize-providers"],
    queryFn: () => apiFetch<{ google: boolean; github: boolean }>("/api/v1/authorize/providers"),
  });
  const [error, setError] = useState<string>();
  const [mfaRequired, setMfaRequired] = useState(false);
  const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(undefined);
    const data = new FormData(event.currentTarget);
    try {
      const result = await apiFetch<{ next: string }>("/api/v1/authorize/login", {
        method: "POST",
        body: JSON.stringify({
          requestId,
          email: data.get("email"),
          password: data.get("password"),
          ...(mfaRequired ? { mfaCode: data.get("mfaCode") } : {}),
          ...(linkToken ? { linkToken } : {}),
        }),
      });
      window.location.assign(result.next);
    } catch (caught) {
      if (caught instanceof ApiClientError && caught.code === "mfa_required") {
        setMfaRequired(true);
        setError(undefined);
      } else {
        setError(caught instanceof Error ? caught.message : "Authentication failed.");
      }
      setLoading(false);
    }
  }
  const hasSocial = Boolean(providers.data?.google || providers.data?.github);
  return (
    <AuthorizationShell>
      <div className="w-full">
        <header className="mb-6 text-center">
          <h1 className="text-2xl leading-8 font-semibold tracking-[-0.03em] text-balance">
            {linkToken ? `Link ${linkProvider}` : "Sign in"}
          </h1>
          <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
            {linkToken ? (
              <>Confirm your password to link {linkProvider} to your account</>
            ) : (
              <>
                to continue to{" "}
                <span className="font-medium text-[var(--text-primary)]">
                  {request.data?.application.name ?? "the application"}
                </span>
              </>
            )}
          </p>
          {request.data?.workspace.name && (
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">
              with your {request.data.workspace.name} account
            </p>
          )}
        </header>
        {linkToken ? (
          <Note className="mb-5" tone="info">
            This verified {linkProvider} email belongs to an existing account. Sign in once to
            confirm; future {linkProvider} sign-ins will use the same account.
          </Note>
        ) : hasSocial ? (
          <>
            <div className="grid gap-2">
              {providers.data?.google && (
                <Button asChild className="w-full" size="large">
                  <a
                    href={`/api/v1/authorize/social/google?request_id=${encodeURIComponent(requestId)}`}
                  >
                    <GoogleIcon className="size-4" /> Continue with Google
                  </a>
                </Button>
              )}
              {providers.data?.github && (
                <Button asChild className="w-full" size="large">
                  <a
                    href={`/api/v1/authorize/social/github?request_id=${encodeURIComponent(requestId)}`}
                  >
                    <Github aria-hidden="true" className="size-4" /> Continue with GitHub
                  </a>
                </Button>
              )}
            </div>
            <div className="my-5 flex items-center gap-3 text-xs text-[var(--text-tertiary)] before:h-px before:flex-1 before:bg-[var(--border)] after:h-px after:flex-1 after:bg-[var(--border)]">
              or with email
            </div>
          </>
        ) : null}
        <form className="space-y-4" method="post" onSubmit={submit}>
          <Field label="Email">
            <Input
              autoComplete="email"
              autoFocus={!mfaRequired}
              className="h-10"
              name="email"
              readOnly={mfaRequired}
              required
              spellCheck={false}
              type="email"
            />
          </Field>
          <Field label="Password">
            <PasswordInput
              autoComplete="current-password"
              large
              name="password"
              readOnly={mfaRequired}
              required
            />
          </Field>
          {mfaRequired && (
            <div className="animate-enter">
              <Field
                description="Open your authenticator app, or use a recovery code."
                label={
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck aria-hidden="true" className="size-3.5 text-[var(--success)]" />
                    Authentication code
                  </span>
                }
              >
                <Input
                  autoComplete="one-time-code"
                  autoFocus
                  className="h-10 text-center tracking-[0.3em]"
                  inputMode="numeric"
                  mono
                  name="mfaCode"
                  placeholder="000000"
                  required
                />
              </Field>
            </div>
          )}
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
            {loading
              ? "Signing in…"
              : mfaRequired
                ? "Verify & continue"
                : linkToken
                  ? `Link ${linkProvider} & continue`
                  : "Continue"}
          </Button>
        </form>
      </div>
    </AuthorizationShell>
  );
}
