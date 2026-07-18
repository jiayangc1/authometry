"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@authometry/ui";
import { AuthHeading, AuthShell, inputClass } from "@/components/auth/auth-shell";
import { apiFetch } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const data = new FormData(event.currentTarget);
    await apiFetch("/api/v1/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email: data.get("email") }),
    });
    setSent(true);
    setLoading(false);
  }
  return (
    <AuthShell>
      <div className="w-full">
        <AuthHeading
          title="Reset Your Password"
          description="Enter your email address. If an account exists, Authometry will send a reset link."
        />
        {sent ? (
          <div className="space-y-4">
            <p className="text-sm leading-6 text-[var(--text-secondary)]" role="status">
              Check your inbox. The reset link expires in 30 minutes.
            </p>
            <Button asChild className="w-full" variant="ghost">
              <Link href="/login">Return to Sign In</Link>
            </Button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={submit}>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium">Email address</span>
              <input
                autoComplete="email"
                className={inputClass}
                name="email"
                required
                spellCheck={false}
                type="email"
              />
            </label>
            <Button className="w-full" disabled={loading} type="submit" variant="primary">
              {loading ? "Sending…" : "Send Reset Link"}
            </Button>
            <Button asChild className="w-full" variant="ghost">
              <Link href="/login">Return to Sign In</Link>
            </Button>
          </form>
        )}
      </div>
    </AuthShell>
  );
}
