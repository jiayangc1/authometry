"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, Note, Spinner, StatusBadge } from "@authometry/ui";
import { AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { Field } from "@/components/ui/form";
import { PasswordInput } from "@/components/ui/password-input";
import { apiFetch } from "@/lib/api";
import { humanize } from "@/lib/status";
import { useHydrated } from "@/lib/use-hydrated";

interface Invitation {
  email: string;
  name: string;
  workspace_name: string;
  role: string;
}
export default function AcceptInvitePage() {
  const hydrated = useHydrated();
  const token = useSearchParams().get("token") ?? "";
  const [error, setError] = useState<string>();
  const [mismatch, setMismatch] = useState(false);
  const [loading, setLoading] = useState(false);
  const query = useQuery({
    queryKey: ["invitation", token],
    queryFn: () =>
      apiFetch<Invitation>(`/api/v1/auth/invitation?token=${encodeURIComponent(token)}`),
    enabled: Boolean(token),
    retry: false,
  });
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (data.get("password") !== data.get("confirmation")) {
      setMismatch(true);
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      await apiFetch("/api/v1/auth/invitation", {
        method: "POST",
        body: JSON.stringify({ token, password: data.get("password") }),
      });
      window.location.assign("/overview");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The invitation could not be accepted.");
      setLoading(false);
    }
  }
  const invalid = (hydrated && !token) || query.isError;
  return (
    <AuthShell>
      <div className="w-full">
        <AuthHeading
          description={
            query.data
              ? `${query.data.name}, you’ve been invited to join ${query.data.workspace_name}. Choose a password to finish.`
              : "Confirm your workspace membership and choose a password."
          }
          title={query.data ? `Join ${query.data.workspace_name}` : "Accept invitation"}
        />
        {invalid ? (
          <div className="space-y-4">
            <Note tone="danger">
              This invitation link is invalid or has expired. Ask a workspace admin to send a new
              one.
            </Note>
            <Button asChild className="w-full" size="large">
              <Link href="/login">Go to sign in</Link>
            </Button>
          </div>
        ) : query.isLoading ? (
          <div
            className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)]"
            role="status"
          >
            <Spinner className="size-3.5" /> Checking your invitation…
          </div>
        ) : (
          <>
            {query.data && (
              <div className="mb-5 flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2.5">
                <span className="min-w-0 truncate text-[13px]">{query.data.email}</span>
                <StatusBadge label={humanize(query.data.role)} tone="info" />
              </div>
            )}
            <form className="space-y-4" method="post" onSubmit={submit}>
              <Field description="At least 12 characters." label="Password">
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
                <Note role="alert" tone="danger">
                  {error}
                </Note>
              )}
              <Button
                className="w-full"
                disabled={!hydrated || !query.data}
                loading={loading}
                size="large"
                type="submit"
                variant="primary"
              >
                {loading ? "Joining…" : "Join workspace"}
              </Button>
            </form>
          </>
        )}
      </div>
    </AuthShell>
  );
}
