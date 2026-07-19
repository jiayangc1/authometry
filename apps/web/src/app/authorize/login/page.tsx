"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Github, LoaderCircle, ShieldCheck } from "lucide-react";
import { Button, GoogleIcon } from "@authometry/ui";
import { AuthorizationShell, inputClass } from "@/components/auth/auth-shell";
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
  return (
    <AuthorizationShell>
      <div className="w-full">
        <header className="mb-8 text-center">
          <h1 className="text-[28px] leading-9 font-medium tracking-[-0.035em] text-balance">
            Sign In
          </h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            {linkToken ? (
              <>Confirm your password to link {linkProvider}</>
            ) : (
              <>
                to continue to{" "}
                <span className="font-medium text-[var(--text-primary)]">
                  {request.data?.application.name ?? "the application"}
                </span>
              </>
            )}
          </p>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">
            Use your {request.data?.workspace.name ?? "workspace"} account
          </p>
        </header>
        {linkToken ? (
          <div className="mb-6 border border-[var(--info-border)] bg-[var(--info-soft)] px-3 py-2.5 text-xs leading-5 text-[var(--text-secondary)]">
            The verified {linkProvider} email belongs to an existing account. Sign in once to
            confirm the link; future {linkProvider} sign-ins will use that same user.
          </div>
        ) : (
          <>
            <div className="grid gap-2.5">
              <Button asChild className="h-10 w-full rounded-full text-sm">
                <a
                  aria-disabled={!providers.data?.google}
                  className={!providers.data?.google ? "pointer-events-none opacity-50" : undefined}
                  href={
                    providers.data?.google
                      ? `/api/v1/authorize/social/google?request_id=${encodeURIComponent(requestId)}`
                      : undefined
                  }
                >
                  <GoogleIcon className="size-[18px]" />
                  Continue with Google
                </a>
              </Button>
              <Button asChild className="h-10 w-full rounded-full text-sm">
                <a
                  aria-disabled={!providers.data?.github}
                  className={!providers.data?.github ? "pointer-events-none opacity-50" : undefined}
                  href={
                    providers.data?.github
                      ? `/api/v1/authorize/social/github?request_id=${encodeURIComponent(requestId)}`
                      : undefined
                  }
                >
                  <Github className="size-[18px]" /> Continue with GitHub
                </a>
              </Button>
            </div>
            <div className="my-6 flex items-center gap-3 text-[11px] text-[var(--text-tertiary)] before:h-px before:flex-1 before:bg-[var(--border)] after:h-px after:flex-1 after:bg-[var(--border)]">
              OR CONTINUE WITH EMAIL
            </div>
          </>
        )}
        <form className="space-y-4" method="post" onSubmit={submit}>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium">Email address</span>
            <input
              autoComplete="email"
              className={`${inputClass} h-11 rounded-lg`}
              name="email"
              required
              spellCheck={false}
              type="email"
            />
          </label>
          {mfaRequired && (
            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium">
                <ShieldCheck aria-hidden="true" className="size-3.5 text-[var(--accent)]" />
                Authentication code
              </span>
              <input
                autoComplete="one-time-code"
                autoFocus
                className={`${inputClass} h-11 rounded-lg font-mono tracking-[0.18em]`}
                name="mfaCode"
                placeholder="000000 or recovery code"
                required
              />
            </label>
          )}
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium">Password</span>
            <input
              autoComplete="current-password"
              className={`${inputClass} h-11 rounded-lg`}
              name="password"
              required
              type="password"
            />
          </label>
          {error && (
            <p className="text-xs text-[var(--danger)]" role="alert">
              {error}
            </p>
          )}
          <Button
            className="h-10 w-full rounded-full text-sm"
            disabled={!hydrated || loading}
            type="submit"
            variant="primary"
          >
            {loading ? (
              <>
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> Signing in…
              </>
            ) : linkToken ? (
              `Link ${linkProvider} & Continue`
            ) : (
              "Sign In & Continue"
            )}
          </Button>
        </form>
      </div>
    </AuthorizationShell>
  );
}
