"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Github } from "lucide-react";
import { Button } from "@authometry/ui";
import { AuthorizationLoginShell, inputClass } from "@/components/auth/auth-shell";
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
    <AuthorizationLoginShell>
      <div className="w-full">
        <header className="mb-8 text-center">
          <h1 className="text-[28px] leading-9 font-medium tracking-[-0.035em]">Sign in</h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            to continue to{" "}
            <span className="font-medium text-[var(--text-primary)]">
              {request.data?.application.name ?? "the application"}
            </span>
          </p>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">
            Use your {request.data?.workspace.name ?? "workspace"} account
          </p>
        </header>
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
        <form className="space-y-4" method="post" onSubmit={submit}>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium">Email address</span>
            <input
              autoComplete="email"
              className={`${inputClass} h-11 rounded-lg`}
              name="email"
              required
              type="email"
            />
          </label>
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
            {loading ? "Signing in…" : "Continue"}
          </Button>
        </form>
      </div>
    </AuthorizationLoginShell>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 18 18">
      <path
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.482h4.844a4.14 4.14 0 0 1-1.797 2.715v2.258h2.909c1.702-1.567 2.684-3.874 2.684-6.614Z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.181l-2.909-2.258c-.806.54-1.836.859-3.047.859-2.344 0-4.328-1.585-5.037-3.715H.956v2.332A8.998 8.998 0 0 0 9 18Z"
        fill="#34A853"
      />
      <path
        d="M3.963 10.705A5.41 5.41 0 0 1 3.682 9c0-.592.102-1.168.281-1.705V4.963H.956A8.997 8.997 0 0 0 0 9c0 1.452.347 2.827.956 4.037l3.007-2.332Z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.507.454 3.441 1.346l2.582-2.582C13.463.892 11.426 0 9 0A8.998 8.998 0 0 0 .956 4.963l3.007 2.332C4.672 5.165 6.656 3.58 9 3.58Z"
        fill="#EA4335"
      />
    </svg>
  );
}
