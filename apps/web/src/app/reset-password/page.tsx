"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@authometry/ui";
import { AuthHeading, AuthShell, inputClass } from "@/components/auth/auth-shell";
import { apiFetch } from "@/lib/api";
import { useHydrated } from "@/lib/use-hydrated";

export default function ResetPasswordPage() {
  const hydrated = useHydrated();
  const token = useSearchParams().get("token") ?? "";
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(undefined);
    const data = new FormData(event.currentTarget);
    if (data.get("password") !== data.get("confirmation")) {
      setError("The passwords do not match.");
      setLoading(false);
      return;
    }
    try {
      await apiFetch("/api/v1/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password: data.get("password") }),
      });
      setMessage("Your password has been reset. You can now sign in.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The password could not be reset.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <div className="w-full">
        <AuthHeading
          title="Choose a new password"
          description="The reset link is single-use and expires after 30 minutes."
        />
        {message ? (
          <div className="space-y-4">
            <p className="text-sm text-[var(--success)]" role="status">
              {message}
            </p>
            <Button asChild className="w-full" variant="primary">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        ) : (
          <form className="space-y-4" method="post" onSubmit={submit}>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium">New password</span>
              <input
                autoComplete="new-password"
                className={inputClass}
                minLength={12}
                name="password"
                required
                type="password"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium">Confirm password</span>
              <input
                autoComplete="new-password"
                className={inputClass}
                minLength={12}
                name="confirmation"
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
              disabled={!hydrated || loading || !token}
              type="submit"
              variant="primary"
            >
              {loading ? "Resetting…" : "Reset password"}
            </Button>
          </form>
        )}
      </div>
    </AuthShell>
  );
}
