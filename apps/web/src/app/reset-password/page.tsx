"use client";

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, Note } from "@authometry/ui";
import { AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { Field } from "@/components/ui/form";
import { PasswordInput } from "@/components/ui/password-input";
import { apiFetch } from "@/lib/api";
import { useHydrated } from "@/lib/use-hydrated";

export default function ResetPasswordPage() {
  const hydrated = useHydrated();
  const token = useSearchParams().get("token") ?? "";
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string>();
  const [mismatch, setMismatch] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const data = new FormData(event.currentTarget);
    if (data.get("password") !== data.get("confirmation")) {
      setMismatch(true);
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/api/v1/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password: data.get("password") }),
      });
      setDone(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The password could not be reset.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <div className="w-full">
        {done ? (
          <div className="animate-enter" role="status">
            <span className="animate-pop mb-5 flex size-10 items-center justify-center rounded-full bg-[var(--success-soft)] text-[var(--success)]">
              <CheckCircle2 aria-hidden="true" className="size-5" />
            </span>
            <AuthHeading
              description="You can now sign in with your new password."
              title="Password updated"
            />
            <Button asChild className="w-full" size="large" variant="primary">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        ) : (
          <>
            <AuthHeading
              description="Reset links are single-use and expire after 30 minutes."
              title="Choose a new password"
            />
            {hydrated && !token ? (
              <div className="space-y-4">
                <Note tone="warning">
                  This link is missing its reset token. Open the link from your email again, or
                  request a new one.
                </Note>
                <Button asChild className="w-full" size="large">
                  <Link href="/forgot-password">Request a new link</Link>
                </Button>
              </div>
            ) : (
              <form className="space-y-4" method="post" onSubmit={submit}>
                <Field description="At least 12 characters." label="New password">
                  <PasswordInput
                    autoComplete="new-password"
                    autoFocus
                    large
                    minLength={12}
                    name="password"
                    onChange={() => setMismatch(false)}
                    required
                  />
                </Field>
                <Field
                  error={mismatch ? "The passwords do not match." : undefined}
                  label="Confirm password"
                >
                  <PasswordInput
                    autoComplete="new-password"
                    large
                    minLength={12}
                    name="confirmation"
                    onChange={() => setMismatch(false)}
                    required
                  />
                </Field>
                {error && (
                  <Note
                    action={
                      <Button asChild size="compact">
                        <Link href="/forgot-password">New link</Link>
                      </Button>
                    }
                    role="alert"
                    tone="danger"
                  >
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
                  {loading ? "Updating…" : "Update password"}
                </Button>
              </form>
            )}
          </>
        )}
      </div>
    </AuthShell>
  );
}
