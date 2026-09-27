"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, Github, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { AuthometryLogo, Button, GoogleIcon, Note } from "@authometry/ui";
import { Field, Input } from "@/components/ui/form";
import { PasswordInput } from "@/components/ui/password-input";
import { ApiClientError } from "@/lib/api";
import { portalApiFetch } from "@/lib/portal-api";
import { useHydrated } from "@/lib/use-hydrated";

export default function PortalLoginPage() {
  const params = useSearchParams();
  const hydrated = useHydrated();
  const [workspace, setWorkspace] = useState(params.get("workspace") ?? "");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(params.get("error") ?? "");
  const providers = useQuery({
    queryKey: ["portal-providers"],
    queryFn: () => portalApiFetch<{ google: boolean; github: boolean }>("/auth/providers"),
  });
  const normalizedWorkspace = workspace.trim().toLowerCase();
  const socialReady = normalizedWorkspace.length >= 3;
  const returnTo = params.get("returnTo")?.startsWith("/portal")
    ? params.get("returnTo")!
    : "/portal";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      await portalApiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          workspace: normalizedWorkspace,
          email: data.get("email"),
          password: data.get("password"),
          ...(mfaRequired ? { mfaCode: data.get("mfaCode") } : {}),
        }),
      });
      window.location.assign(returnTo);
    } catch (caught) {
      if (caught instanceof ApiClientError && caught.code === "mfa_required") {
        setMfaRequired(true);
        setError("");
      } else {
        setError(caught instanceof Error ? caught.message : "Sign-in could not be completed.");
      }
      setLoading(false);
    }
  }

  function socialHref(provider: "google" | "github") {
    const query = new URLSearchParams({ workspace: normalizedWorkspace, return_to: returnTo });
    return `/api/v1/portal/auth/social/${provider}?${query.toString()}`;
  }

  const hasSocial = Boolean(providers.data?.google || providers.data?.github);
  return (
    <main className="portal-surface grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="flex min-h-dvh flex-col bg-[var(--background)] px-6 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Link
            className="rounded-[var(--radius-control)] focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:outline-none"
            href="/"
          >
            <AuthometryLogo />
          </Link>
          <Link
            className="text-[13px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
            href="/login"
          >
            Admin sign in
          </Link>
        </div>
        <div className="mx-auto flex w-full max-w-[360px] flex-1 animate-[enter_var(--motion-slow)_var(--ease-out)] flex-col justify-center py-12">
          <h1 className="text-2xl leading-8 font-semibold tracking-[-0.03em] text-balance">
            Sign in to your apps
          </h1>
          <p className="mt-1.5 text-sm leading-6 text-[var(--text-secondary)]">
            One sign-in opens every service your company has assigned to you.
          </p>
          <form className="mt-6 space-y-4" method="post" onSubmit={submit}>
            <Field label="Company workspace">
              <span className="flex h-10 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface-raised)] transition-[border-color,box-shadow] duration-[var(--motion-fast)] focus-within:border-[var(--text-tertiary)] focus-within:shadow-[0_0_0_3px_var(--geist-gray-alpha-200)] hover:border-[var(--border-strong)]">
                <span className="technical-value flex items-center border-r border-[var(--border)] bg-[var(--surface-subtle)] px-3 text-[var(--text-tertiary)]">
                  authometry/
                </span>
                <input
                  autoCapitalize="none"
                  autoComplete="organization"
                  autoFocus={!workspace}
                  className="min-w-0 flex-1 bg-transparent px-3 font-mono text-[13px] outline-none placeholder:text-[var(--text-tertiary)]"
                  name="workspace"
                  onChange={(event) => setWorkspace(event.target.value)}
                  placeholder="acme"
                  readOnly={mfaRequired}
                  required
                  spellCheck={false}
                  value={workspace}
                />
              </span>
            </Field>
            <Field label="Work email">
              <Input
                autoComplete="email"
                autoFocus={Boolean(workspace)}
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
              className="w-full [&:hover_svg]:translate-x-0.5"
              disabled={!hydrated}
              loading={loading}
              size="large"
              type="submit"
              variant="primary"
            >
              {loading ? (
                "Checking access…"
              ) : mfaRequired ? (
                "Verify & continue"
              ) : (
                <>
                  Continue <ArrowRight aria-hidden="true" className="size-4" />
                </>
              )}
            </Button>
          </form>
          {!mfaRequired && hasSocial && (
            <>
              <div className="my-5 flex items-center gap-3 text-xs text-[var(--text-tertiary)] before:h-px before:flex-1 before:bg-[var(--border)] after:h-px after:flex-1 after:bg-[var(--border)]">
                or
              </div>
              <div className="grid gap-2">
                {providers.data?.google && (
                  <Button asChild className="w-full" size="large">
                    <a
                      aria-disabled={!socialReady}
                      className={!socialReady ? "pointer-events-none opacity-50" : undefined}
                      href={socialReady ? socialHref("google") : undefined}
                    >
                      <GoogleIcon className="size-4" /> Continue with Google
                    </a>
                  </Button>
                )}
                {providers.data?.github && (
                  <Button asChild className="w-full" size="large">
                    <a
                      aria-disabled={!socialReady}
                      className={!socialReady ? "pointer-events-none opacity-50" : undefined}
                      href={socialReady ? socialHref("github") : undefined}
                    >
                      <Github aria-hidden="true" className="size-4" /> Continue with GitHub
                    </a>
                  </Button>
                )}
              </div>
              {!socialReady && (
                <p className="mt-2 text-center text-xs text-[var(--text-tertiary)]">
                  Enter your workspace first to use a connected account.
                </p>
              )}
            </>
          )}
        </div>
        <p className="text-xs text-[var(--text-tertiary)]">Secured by Authometry</p>
      </section>
      <aside
        aria-hidden="true"
        className="dark relative hidden overflow-hidden bg-[#0a0a0a] text-[#ededed] lg:flex lg:items-center lg:justify-center lg:p-12"
      >
        <div className="pointer-events-none absolute inset-0 [background-image:radial-gradient(rgb(255_255_255/0.1)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)] [background-size:16px_16px]" />
        <div className="relative w-full max-w-md">
          <p className="technical-value mb-3 text-[#8f8f8f]">one verified identity</p>
          <h2 className="text-[28px] leading-9 font-semibold tracking-[-0.04em] text-balance">
            One front door for every service you use at work.
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#a1a1a1]">
            Your company controls access. You control your identity, sign-in methods, and security.
          </p>
          <div className="mt-8 overflow-hidden rounded-[var(--radius-panel)] border border-white/10 bg-white/[0.04] shadow-[0_24px_48px_-12px_rgb(0_0_0/0.6)]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <p className="text-[13px] font-medium">Company applications</p>
              <span className="flex items-center gap-1.5 text-[11px] text-[#62c073]">
                <span className="size-1.5 rounded-full bg-[#46a758]" /> Verified session
              </span>
            </div>
            <ul className="stagger">
              {["Email & collaboration", "Reporting workspace", "Customer support"].map(
                (service) => (
                  <li
                    className="flex items-center gap-3 border-b border-white/10 px-4 py-3 last:border-0"
                    key={service}
                  >
                    <span className="flex size-7 items-center justify-center rounded-[var(--radius-control)] bg-white/10 text-[11px] font-semibold">
                      {service.charAt(0)}
                    </span>
                    <span className="flex-1 text-[13px] text-white/85">{service}</span>
                    <Check className="size-3.5 text-[#62c073]" />
                  </li>
                ),
              )}
            </ul>
          </div>
        </div>
      </aside>
    </main>
  );
}
