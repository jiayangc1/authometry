"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Github, LoaderCircle } from "lucide-react";
import { Button, GoogleIcon } from "@authometry/ui";
import { AuthHeading, AuthShell, inputClass } from "@/components/auth/auth-shell";
import { apiFetch } from "@/lib/api";
import { useHydrated } from "@/lib/use-hydrated";

export default function LoginPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const [bootstrapRequired, setBootstrapRequired] = useState(false);
  const [providers, setProviders] = useState({ google: false, github: false });
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

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
      router.push("/overview");
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
          description="Manage clients, policies, identities, and authorization traces."
        />
        {bootstrapRequired && (
          <div className="mb-5 border border-[var(--info-border)] bg-[var(--info-soft)] px-3 py-2.5 text-[13px]">
            This installation needs its first owner.{" "}
            <Link
              className="font-medium text-[var(--info)] underline underline-offset-2"
              href="/bootstrap"
            >
              Set up Authometry
            </Link>
          </div>
        )}
        <form className="space-y-4" method="post" onSubmit={submit}>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium">Email address</span>
            <input autoComplete="email" className={inputClass} name="email" required type="email" />
          </label>
          <label className="block">
            <span className="mb-1.5 flex items-center justify-between text-xs font-medium">
              Password
              <Link
                className="font-normal text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                href="/forgot-password"
              >
                Forgot password?
              </Link>
            </span>
            <input
              autoComplete="current-password"
              className={inputClass}
              minLength={12}
              name="password"
              required
              type="password"
            />
          </label>
          {error && (
            <p className="text-[13px] text-[var(--danger)]" role="alert">
              {error}
            </p>
          )}
          <Button
            aria-busy={loading}
            className="w-full disabled:opacity-100"
            disabled={!hydrated || loading}
            type="submit"
            variant="primary"
          >
            {loading ? (
              <>
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </Button>
        </form>
        <div className="my-6 flex items-center gap-3 text-[11px] text-[var(--text-tertiary)] before:h-px before:flex-1 before:bg-[var(--border)] after:h-px after:flex-1 after:bg-[var(--border)]">
          OR
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button asChild>
            <a
              aria-disabled={!providers.google}
              className={!providers.google ? "pointer-events-none opacity-50" : undefined}
              href={providers.google ? "/api/v1/auth/social/google" : undefined}
              title={!providers.google ? "Configure Google to enable sign-in" : undefined}
            >
              <GoogleIcon className="size-4" /> Google
            </a>
          </Button>
          <Button asChild>
            <a
              aria-disabled={!providers.github}
              className={!providers.github ? "pointer-events-none opacity-50" : undefined}
              href={providers.github ? "/api/v1/auth/social/github" : undefined}
              title={!providers.github ? "Configure GitHub to enable sign-in" : undefined}
            >
              <Github className="size-4" /> GitHub
            </a>
          </Button>
        </div>
      </div>
    </AuthShell>
  );
}
