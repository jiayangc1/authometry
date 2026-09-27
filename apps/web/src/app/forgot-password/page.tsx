"use client";

import { ArrowLeft, MailCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button, Note } from "@authometry/ui";
import { AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { Field, Input } from "@/components/ui/form";
import { apiFetch } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(undefined);
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    try {
      await apiFetch("/api/v1/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setSentTo(email);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The reset email could not be sent.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <AuthShell>
      <div className="w-full">
        {sentTo ? (
          <div className="animate-enter" role="status">
            <span className="animate-pop mb-5 flex size-10 items-center justify-center rounded-full bg-[var(--success-soft)] text-[var(--success)]">
              <MailCheck aria-hidden="true" className="size-5" />
            </span>
            <AuthHeading
              description={
                <>
                  If an account exists for{" "}
                  <span className="font-medium text-[var(--text-primary)]">{sentTo}</span>, a reset
                  link is on its way. It expires in 30 minutes.
                </>
              }
              title="Check your email"
            />
            <div className="space-y-2">
              <Button asChild className="w-full" size="large">
                <Link href="/login">Back to sign in</Link>
              </Button>
              <Button className="w-full" onClick={() => setSentTo(undefined)} variant="ghost">
                Use a different email
              </Button>
            </div>
          </div>
        ) : (
          <>
            <AuthHeading
              description="Enter your email and we’ll send a link to choose a new password."
              title="Reset your password"
            />
            <form className="space-y-4" onSubmit={submit}>
              <Field label="Email">
                <Input
                  autoComplete="email"
                  autoFocus
                  className="h-10"
                  name="email"
                  required
                  spellCheck={false}
                  type="email"
                />
              </Field>
              {error && (
                <Note role="alert" tone="danger">
                  {error}
                </Note>
              )}
              <Button
                className="w-full"
                loading={loading}
                size="large"
                type="submit"
                variant="primary"
              >
                {loading ? "Sending…" : "Send reset link"}
              </Button>
              <Button asChild className="w-full [&:hover_svg]:-translate-x-0.5" variant="ghost">
                <Link href="/login">
                  <ArrowLeft aria-hidden="true" className="size-3.5" /> Back to sign in
                </Link>
              </Button>
            </form>
          </>
        )}
      </div>
    </AuthShell>
  );
}
