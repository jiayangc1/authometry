"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Clipboard,
  Github,
  KeyRound,
  Laptop,
  Link2,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  Smartphone,
  Unlink,
} from "lucide-react";
import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { toast } from "sonner";
import { Button, GoogleIcon, StatusBadge } from "@authometry/ui";
import { inputClass } from "@/components/auth/auth-shell";
import { RelativeTime } from "@/components/data-display/formatted-time";
import type { PortalMe } from "@/components/portal/types";
import { portalApiFetch, portalCsrfToken } from "@/lib/portal-api";

interface MfaSetup {
  secret: string;
  setupToken: string;
  uri: string;
}

export default function PortalSecurityPage() {
  const queryClient = useQueryClient();
  const me = useQuery({
    queryKey: ["portal-me"],
    queryFn: () => portalApiFetch<PortalMe>("/me"),
  });
  const providers = useQuery({
    queryKey: ["portal-providers"],
    queryFn: () => portalApiFetch<{ google: boolean; github: boolean }>("/auth/providers"),
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [mfaSetup, setMfaSetup] = useState<MfaSetup>();
  const [mfaLoading, setMfaLoading] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>();
  const [csrfToken, setCsrfToken] = useState("");

  useEffect(() => {
    if (me.data) setCsrfToken(portalCsrfToken());
  }, [me.data]);

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const newPassword = String(data.get("newPassword") ?? "");
    if (newPassword !== data.get("confirmPassword")) {
      toast.error("The new passwords do not match.");
      return;
    }
    setPasswordSaving(true);
    try {
      await portalApiFetch("/password", {
        method: "PUT",
        body: JSON.stringify({
          ...(me.data?.user.passwordEnabled
            ? { currentPassword: data.get("currentPassword") }
            : {}),
          newPassword,
        }),
      });
      form.reset();
      await queryClient.invalidateQueries({ queryKey: ["portal-me"] });
      toast.success(me.data?.user.passwordEnabled ? "Password changed" : "Password created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The password could not be changed.");
    } finally {
      setPasswordSaving(false);
    }
  }

  async function beginMfaSetup() {
    setMfaLoading(true);
    try {
      setMfaSetup(await portalApiFetch<MfaSetup>("/mfa/setup", { method: "POST" }));
      setRecoveryCodes(undefined);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "MFA setup could not be started.");
    } finally {
      setMfaLoading(false);
    }
  }

  async function enableMfa(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mfaSetup) return;
    const data = new FormData(event.currentTarget);
    setMfaLoading(true);
    try {
      const result = await portalApiFetch<{ recoveryCodes: string[] }>("/mfa/enable", {
        method: "POST",
        body: JSON.stringify({ setupToken: mfaSetup.setupToken, code: data.get("code") }),
      });
      setRecoveryCodes(result.recoveryCodes);
      setMfaSetup(undefined);
      await queryClient.invalidateQueries({ queryKey: ["portal-me"] });
      toast.success("Multi-factor authentication enabled");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The code could not be verified.");
    } finally {
      setMfaLoading(false);
    }
  }

  async function disableMfa(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setMfaLoading(true);
    try {
      await portalApiFetch("/mfa", {
        method: "DELETE",
        body: JSON.stringify({
          password: data.get("password") || undefined,
          code: data.get("code"),
        }),
      });
      form.reset();
      setRecoveryCodes(undefined);
      await queryClient.invalidateQueries({ queryKey: ["portal-me"] });
      toast.success("Multi-factor authentication disabled");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "MFA could not be disabled.");
    } finally {
      setMfaLoading(false);
    }
  }

  async function disconnect(provider: "google" | "github") {
    try {
      await portalApiFetch(`/social/${provider}`, { method: "DELETE" });
      await queryClient.invalidateQueries({ queryKey: ["portal-me"] });
      toast.success(`${provider === "github" ? "GitHub" : "Google"} disconnected`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "The account could not be disconnected.",
      );
    }
  }

  async function revokeSession(sessionId: string) {
    try {
      await portalApiFetch(`/sessions/${sessionId}`, { method: "DELETE" });
      await queryClient.invalidateQueries({ queryKey: ["portal-me"] });
      toast.success("Session signed out");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The session could not be signed out.");
    }
  }

  async function copyRecoveryCodes() {
    if (!recoveryCodes) return;
    try {
      await navigator.clipboard.writeText(recoveryCodes.join("\n"));
      toast.success("Recovery codes copied");
    } catch {
      toast.error("Recovery codes could not be copied.");
    }
  }

  const connectionMap = new Map(
    me.data?.socialConnections.map((connection) => [connection.provider, connection]) ?? [],
  );

  return (
    <div className="max-w-4xl">
      <header className="mb-8">
        <p className="portal-caption mb-1">SIGN-IN & PROTECTION</p>
        <h1 className="text-2xl font-semibold tracking-[-0.035em]">Security</h1>
        <p className="mt-2 text-sm text-[var(--portal-muted)]">
          Manage how you sign in and review the devices currently using your identity.
        </p>
      </header>

      <div className="space-y-5">
        <section className="overflow-hidden rounded-xl border border-[var(--portal-line)] bg-[var(--portal-paper)]">
          <div className="flex items-start gap-3 border-b border-[var(--portal-line)] px-5 py-4 sm:px-6">
            <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--portal-accent-soft)] text-[var(--portal-accent)]">
              <LockKeyhole aria-hidden="true" className="size-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold">
                {me.data?.user.passwordEnabled ? "Change password" : "Create a password"}
              </h2>
              <p className="mt-0.5 text-xs text-[var(--portal-muted)]">
                A new password signs out your other active sessions.
              </p>
            </div>
          </div>
          <form className="grid gap-4 px-5 py-5 sm:grid-cols-2 sm:px-6" onSubmit={changePassword}>
            {me.data?.user.passwordEnabled && (
              <label className="block sm:col-span-2 sm:max-w-[calc(50%-0.5rem)]">
                <span className="mb-1.5 block text-xs font-medium">Current password</span>
                <input
                  autoComplete="current-password"
                  className={inputClass}
                  name="currentPassword"
                  required
                  type="password"
                />
              </label>
            )}
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium">New password</span>
              <input
                autoComplete="new-password"
                className={inputClass}
                minLength={12}
                name="newPassword"
                required
                type="password"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium">Confirm new password</span>
              <input
                autoComplete="new-password"
                className={inputClass}
                minLength={12}
                name="confirmPassword"
                required
                type="password"
              />
            </label>
            <div className="flex items-center justify-between gap-3 border-t border-[var(--portal-line)] pt-4 sm:col-span-2">
              <p className="text-[11px] text-[var(--portal-muted)]">At least 12 characters</p>
              <Button disabled={passwordSaving} type="submit" variant="primary">
                {passwordSaving && (
                  <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
                )}
                {me.data?.user.passwordEnabled ? "Change password" : "Create password"}
              </Button>
            </div>
          </form>
        </section>

        <section className="overflow-hidden rounded-xl border border-[var(--portal-line)] bg-[var(--portal-paper)]">
          <div className="flex items-start gap-3 border-b border-[var(--portal-line)] px-5 py-4 sm:px-6">
            <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--portal-accent-soft)] text-[var(--portal-accent)]">
              <ShieldCheck aria-hidden="true" className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold">Multi-factor authentication</h2>
                <StatusBadge
                  label={me.data?.user.mfaEnabled ? "Enabled" : "Not enabled"}
                  tone={me.data?.user.mfaEnabled ? "success" : "neutral"}
                />
              </div>
              <p className="mt-0.5 text-xs text-[var(--portal-muted)]">
                Require an authenticator or recovery code after your password.
              </p>
            </div>
          </div>

          {recoveryCodes ? (
            <div className="px-5 py-5 sm:px-6">
              <div className="rounded-lg border border-[var(--success-border)] bg-[var(--success-soft)] p-4">
                <div className="flex items-start gap-2">
                  <Check
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-[var(--success)]"
                  />
                  <div>
                    <h3 className="text-xs font-semibold">Save your recovery codes now</h3>
                    <p className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">
                      Each code works once. They will not be shown again.
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 rounded-md bg-[var(--portal-paper)] p-3 font-mono text-xs sm:grid-cols-4">
                  {recoveryCodes.map((code) => (
                    <code key={code}>{code}</code>
                  ))}
                </div>
                <Button className="mt-3" onClick={() => void copyRecoveryCodes()} size="compact">
                  <Clipboard aria-hidden="true" className="size-3.5" /> Copy codes
                </Button>
              </div>
            </div>
          ) : mfaSetup ? (
            <form
              className="grid gap-6 px-5 py-5 sm:grid-cols-[160px_1fr] sm:px-6"
              onSubmit={enableMfa}
            >
              <div className="rounded-xl border border-[var(--portal-line)] bg-white p-3">
                <QRCode bgColor="#ffffff" fgColor="#161722" size={136} value={mfaSetup.uri} />
              </div>
              <div>
                <p className="text-xs font-semibold">Scan with your authenticator app</p>
                <p className="mt-1 text-xs leading-5 text-[var(--portal-muted)]">
                  Or enter this setup key manually:
                </p>
                <code className="mt-2 block rounded-md bg-[var(--portal-canvas)] px-3 py-2 font-mono text-xs break-all">
                  {mfaSetup.secret}
                </code>
                <label className="mt-4 block max-w-xs">
                  <span className="mb-1.5 block text-xs font-medium">6-digit code</span>
                  <input
                    autoComplete="one-time-code"
                    autoFocus
                    className={`${inputClass} font-mono tracking-[0.18em]`}
                    inputMode="numeric"
                    maxLength={6}
                    name="code"
                    pattern="[0-9]{6}"
                    required
                  />
                </label>
                <div className="mt-4 flex gap-2">
                  <Button disabled={mfaLoading} type="submit" variant="primary">
                    {mfaLoading && (
                      <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
                    )}
                    Verify & enable
                  </Button>
                  <Button onClick={() => setMfaSetup(undefined)} type="button">
                    Cancel
                  </Button>
                </div>
              </div>
            </form>
          ) : me.data?.user.mfaEnabled ? (
            <form className="grid gap-4 px-5 py-5 sm:grid-cols-2 sm:px-6" onSubmit={disableMfa}>
              {me.data.user.passwordEnabled && (
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium">Current password</span>
                  <input
                    autoComplete="current-password"
                    className={inputClass}
                    name="password"
                    required
                    type="password"
                  />
                </label>
              )}
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium">
                  Authenticator or recovery code
                </span>
                <input autoComplete="one-time-code" className={inputClass} name="code" required />
              </label>
              <div className="flex justify-end border-t border-[var(--portal-line)] pt-4 sm:col-span-2">
                <Button disabled={mfaLoading} type="submit" variant="danger">
                  Disable MFA
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="flex items-center gap-3 text-xs text-[var(--portal-muted)]">
                <Smartphone aria-hidden="true" className="size-5" />
                Works with any standards-based TOTP authenticator.
              </div>
              <Button disabled={mfaLoading} onClick={() => void beginMfaSetup()} variant="primary">
                {mfaLoading && (
                  <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
                )}
                Set up MFA
              </Button>
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border border-[var(--portal-line)] bg-[var(--portal-paper)]">
          <div className="flex items-start gap-3 border-b border-[var(--portal-line)] px-5 py-4 sm:px-6">
            <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--portal-accent-soft)] text-[var(--portal-accent)]">
              <Link2 aria-hidden="true" className="size-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold">Connected accounts</h2>
              <p className="mt-0.5 text-xs text-[var(--portal-muted)]">
                Use Google or GitHub as another way to sign in.
              </p>
            </div>
          </div>
          <div className="divide-y divide-[var(--portal-line)]">
            {(["google", "github"] as const).map((provider) => {
              const connected = connectionMap.get(provider);
              const label = provider === "github" ? "GitHub" : "Google";
              const Icon = provider === "github" ? Github : GoogleIcon;
              return (
                <div className="flex items-center gap-3 px-5 py-4 sm:px-6" key={provider}>
                  <span className="flex size-9 items-center justify-center rounded-lg border border-[var(--portal-line)] bg-[var(--portal-canvas)]">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold">{label}</p>
                    <p className="truncate text-[11px] text-[var(--portal-muted)]">
                      {connected?.provider_email ?? (connected ? "Connected" : "Not connected")}
                    </p>
                  </div>
                  {connected ? (
                    <Button onClick={() => void disconnect(provider)} size="compact">
                      <Unlink aria-hidden="true" className="size-3.5" /> Disconnect
                    </Button>
                  ) : (
                    <Button asChild size="compact">
                      <a
                        aria-disabled={!providers.data?.[provider] || !csrfToken}
                        className={
                          !providers.data?.[provider] || !csrfToken
                            ? "pointer-events-none opacity-45"
                            : undefined
                        }
                        href={
                          providers.data?.[provider] && csrfToken
                            ? `/api/v1/portal/auth/social/${provider}?intent=link&return_to=${encodeURIComponent("/portal/security")}&csrf=${encodeURIComponent(csrfToken)}`
                            : undefined
                        }
                      >
                        Connect
                      </a>
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-[var(--portal-line)] bg-[var(--portal-paper)]">
          <div className="flex items-start gap-3 border-b border-[var(--portal-line)] px-5 py-4 sm:px-6">
            <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--portal-accent-soft)] text-[var(--portal-accent)]">
              <Laptop aria-hidden="true" className="size-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold">Active sessions</h2>
              <p className="mt-0.5 text-xs text-[var(--portal-muted)]">
                Devices and application sign-ins using your account.
              </p>
            </div>
          </div>
          <div className="divide-y divide-[var(--portal-line)]">
            {me.data?.sessions.map((session) => (
              <div className="flex items-center gap-3 px-5 py-4 sm:px-6" key={session.id}>
                <KeyRound aria-hidden="true" className="size-4 text-[var(--portal-muted)]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">
                    {session.application_name ?? "Employee portal"}
                  </p>
                  <p className="text-[11px] text-[var(--portal-muted)]">
                    Active <RelativeTime value={session.last_active_at} />
                  </p>
                </div>
                {session.current ? (
                  <StatusBadge label="This session" tone="success" />
                ) : (
                  <Button onClick={() => void revokeSession(session.id)} size="compact">
                    Sign out
                  </Button>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
