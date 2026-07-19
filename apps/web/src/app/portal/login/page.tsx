"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, Github, KeyRound, LoaderCircle, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { AuthometryLogo, Button, GoogleIcon } from "@authometry/ui";
import { inputClass } from "@/components/auth/auth-shell";
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

  return (
    <main className="portal-surface grid min-h-dvh lg:grid-cols-[minmax(0,0.88fr)_minmax(520px,1.12fr)]">
      <section className="flex min-h-dvh flex-col bg-[var(--portal-paper)] px-5 py-5 sm:px-10 sm:py-7 lg:px-14">
        <div className="flex items-center justify-between">
          <Link
            className="rounded-md focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:outline-none"
            href="/"
          >
            <AuthometryLogo />
          </Link>
          <Link
            className="text-xs text-[var(--portal-muted)] hover:text-[var(--portal-ink)]"
            href="/login"
          >
            Workspace admin
          </Link>
        </div>
        <div className="mx-auto flex w-full max-w-[390px] flex-1 flex-col justify-center py-12">
          <p className="portal-caption mb-3">EMPLOYEE ACCESS / SIGN IN</p>
          <h1 className="text-[32px] leading-[38px] font-semibold tracking-[-0.045em] text-balance">
            Your work starts here.
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--portal-muted)]">
            Sign in once to open the services your company has assigned to you.
          </p>
          <form className="mt-8 space-y-4" method="post" onSubmit={submit}>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium">Company workspace</span>
              <div className="flex rounded-[6px] border border-[var(--border-strong)] bg-[var(--surface-raised)] focus-within:border-[var(--focus)] focus-within:ring-2 focus-within:ring-[var(--accent-soft)]">
                <span className="flex items-center border-r border-[var(--border)] px-3 text-xs text-[var(--text-tertiary)]">
                  authometry /
                </span>
                <input
                  autoCapitalize="none"
                  autoComplete="organization"
                  className="h-10 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-[var(--text-tertiary)]"
                  name="workspace"
                  onChange={(event) => setWorkspace(event.target.value)}
                  placeholder="acme"
                  required
                  spellCheck={false}
                  value={workspace}
                />
              </div>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium">Work email</span>
              <input
                autoComplete="email"
                className={`${inputClass} h-10`}
                name="email"
                required
                spellCheck={false}
                type="email"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium">Password</span>
              <input
                autoComplete="current-password"
                className={`${inputClass} h-10`}
                name="password"
                required
                type="password"
              />
            </label>
            {mfaRequired && (
              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium">
                  <ShieldCheck
                    aria-hidden="true"
                    className="size-3.5 text-[var(--portal-accent)]"
                  />
                  Authentication code
                </span>
                <input
                  autoComplete="one-time-code"
                  autoFocus
                  className={`${inputClass} h-10 font-mono tracking-[0.18em]`}
                  inputMode="numeric"
                  name="mfaCode"
                  placeholder="000000 or recovery code"
                  required
                />
              </label>
            )}
            {error && (
              <p className="text-xs leading-5 text-[var(--danger)]" role="alert">
                {error}
              </p>
            )}
            <Button
              className="h-10 w-full"
              disabled={!hydrated || loading}
              type="submit"
              variant="primary"
            >
              {loading ? (
                <>
                  <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> Checking
                  access…
                </>
              ) : mfaRequired ? (
                "Verify & Continue"
              ) : (
                <>
                  Continue <ArrowRight aria-hidden="true" className="size-4" />
                </>
              )}
            </Button>
          </form>
          {!mfaRequired && (
            <>
              <div className="my-6 flex items-center gap-3 text-[10px] tracking-[0.1em] text-[var(--portal-muted)] before:h-px before:flex-1 before:bg-[var(--portal-line)] after:h-px after:flex-1 after:bg-[var(--portal-line)]">
                OR USE A CONNECTED ACCOUNT
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button asChild>
                  <a
                    aria-disabled={!socialReady || !providers.data?.google}
                    className={
                      !socialReady || !providers.data?.google
                        ? "pointer-events-none opacity-45"
                        : undefined
                    }
                    href={socialReady && providers.data?.google ? socialHref("google") : undefined}
                    title={!socialReady ? "Enter your company workspace first" : undefined}
                  >
                    <GoogleIcon className="size-4" /> Google
                  </a>
                </Button>
                <Button asChild>
                  <a
                    aria-disabled={!socialReady || !providers.data?.github}
                    className={
                      !socialReady || !providers.data?.github
                        ? "pointer-events-none opacity-45"
                        : undefined
                    }
                    href={socialReady && providers.data?.github ? socialHref("github") : undefined}
                    title={!socialReady ? "Enter your company workspace first" : undefined}
                  >
                    <Github aria-hidden="true" className="size-4" /> GitHub
                  </a>
                </Button>
              </div>
              {!socialReady && (
                <p className="mt-2 text-center text-[11px] text-[var(--portal-muted)]">
                  Enter your workspace to use a connected account.
                </p>
              )}
            </>
          )}
        </div>
        <p className="text-[11px] text-[var(--portal-muted)]">Secured by Authometry</p>
      </section>
      <aside className="relative hidden overflow-hidden bg-[#252344] text-white lg:flex lg:items-center lg:px-14 lg:py-16">
        <div className="absolute inset-0 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:42px_42px] opacity-25" />
        <div className="relative mx-auto w-full max-w-xl">
          <div className="mb-10 flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-white/10">
              <KeyRound aria-hidden="true" className="size-4 text-[#b8b4ff]" />
            </span>
            <span className="font-mono text-[10px] tracking-[0.16em] text-white/55">
              ONE VERIFIED IDENTITY
            </span>
          </div>
          <h2 className="max-w-lg text-4xl leading-[1.12] font-semibold tracking-[-0.045em] text-balance">
            One front door for every service you use at work.
          </h2>
          <p className="mt-5 max-w-md text-sm leading-6 text-white/65">
            Your company controls access. You control your identity, sign-in methods, and security.
          </p>
          <div className="mt-12 overflow-hidden rounded-2xl border border-white/15 bg-white/[0.07] shadow-[0_28px_70px_rgba(0,0,0,.24)] backdrop-blur">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <p className="font-mono text-[9px] tracking-[0.14em] text-white/45">ACCESS PASS</p>
                <p className="mt-1 text-sm font-medium">Company applications</p>
              </div>
              <span className="flex items-center gap-1.5 text-[11px] text-[#80e0c3]">
                <span className="size-1.5 rounded-full bg-[#55d5ad]" /> Verified session
              </span>
            </div>
            {["Email & collaboration", "Reporting workspace", "Customer support"].map(
              (service, index) => (
                <div
                  className="grid grid-cols-[28px_1fr_auto] items-center border-b border-white/10 px-5 py-3.5 last:border-0"
                  key={service}
                >
                  <span className="font-mono text-[10px] text-white/35">0{index + 1}</span>
                  <span className="text-[13px] text-white/85">{service}</span>
                  <Check aria-hidden="true" className="size-3.5 text-[#65dbb7]" />
                </div>
              ),
            )}
          </div>
        </div>
      </aside>
    </main>
  );
}
