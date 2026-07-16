"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Github, Info } from "lucide-react";
import { Button } from "@authometry/ui";
import { AuthHeading, AuthShell, inputClass } from "@/components/auth/auth-shell";
import { apiFetch } from "@/lib/api";
import { useHydrated } from "@/lib/use-hydrated";

export default function AuthorizationLoginPage() {
  const params = useSearchParams();
  const hydrated = useHydrated();
  const requestId = params.get("request_id") ?? "";
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
        }),
      });
      window.location.assign(result.next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentication failed.");
      setLoading(false);
    }
  }
  return (
    <AuthShell>
      <div className="w-full">
        <AuthHeading
          description={`${request.data?.application.name ?? "This application"} uses Authometry to sign you in securely.`}
          title={`Continue to ${request.data?.application.name ?? "the application"}`}
        />
        <div className="mb-5 flex gap-2.5 rounded-lg border border-[var(--accent-border)] bg-[var(--accent-soft)] px-3 py-2.5 text-xs leading-5 text-[var(--text-secondary)]">
          <Info className="mt-0.5 size-3.5 shrink-0 text-[var(--accent)]" />
          <p>
            Use your{" "}
            <strong className="font-semibold text-[var(--text-primary)]">
              {request.data?.workspace.name ?? "workspace"}
            </strong>{" "}
            account. You do not need a separate Authometry dashboard account.
          </p>
        </div>
        <form className="space-y-4" method="post" onSubmit={submit}>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium">Workspace email</span>
            <input autoComplete="email" className={inputClass} name="email" required type="email" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium">Password</span>
            <input
              autoComplete="current-password"
              className={inputClass}
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
            className="w-full"
            disabled={!hydrated || loading}
            type="submit"
            variant="primary"
          >
            {loading ? "Signing in…" : `Continue to ${request.data?.application.name ?? "app"}`}
          </Button>
        </form>
        <div className="my-5 flex items-center gap-3 text-[11px] text-[var(--text-tertiary)] before:h-px before:flex-1 before:bg-[var(--border)] after:h-px after:flex-1 after:bg-[var(--border)]">
          OR
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button asChild>
            <a
              aria-disabled={!providers.data?.google}
              className={!providers.data?.google ? "pointer-events-none opacity-50" : undefined}
              href={
                providers.data?.google
                  ? `/api/v1/authorize/social/google?request_id=${encodeURIComponent(requestId)}`
                  : undefined
              }
            >
              Google
            </a>
          </Button>
          <Button asChild>
            <a
              aria-disabled={!providers.data?.github}
              className={!providers.data?.github ? "pointer-events-none opacity-50" : undefined}
              href={
                providers.data?.github
                  ? `/api/v1/authorize/social/github?request_id=${encodeURIComponent(requestId)}`
                  : undefined
              }
            >
              <Github className="size-4" /> GitHub
            </a>
          </Button>
        </div>
        <p className="mt-4 text-center text-[11px] leading-4 text-[var(--text-tertiary)]">
          First time here? Google or GitHub creates your workspace identity when enabled. For email
          sign-in, ask the workspace administrator for access.
        </p>
      </div>
    </AuthShell>
  );
}
