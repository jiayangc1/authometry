"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, StatusBadge } from "@authometry/ui";
import { AuthHeading, AuthShell, inputClass } from "@/components/auth/auth-shell";
import { apiFetch } from "@/lib/api";

interface Invitation {
  email: string;
  name: string;
  workspace_name: string;
  role: string;
}
export default function AcceptInvitePage() {
  const token = useSearchParams().get("token") ?? "";
  const [error, setError] = useState<string>();
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
    setLoading(true);
    const data = new FormData(event.currentTarget);
    if (data.get("password") !== data.get("confirmation")) {
      setError("The passwords do not match.");
      setLoading(false);
      return;
    }
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
  return (
    <AuthShell>
      <div className="w-full">
        <AuthHeading
          description={
            query.data
              ? `${query.data.name}, join ${query.data.workspace_name} as ${query.data.role}.`
              : "Confirm your workspace membership and choose a password."
          }
          title="Accept invitation"
        />
        {query.data && (
          <div className="mb-5 flex items-center justify-between border-y border-[var(--border)] py-3">
            <span className="text-[13px]">{query.data.email}</span>
            <StatusBadge label={query.data.role} tone="info" />
          </div>
        )}
        {query.isError ? (
          <p className="text-sm text-[var(--danger)]">This invitation is invalid or expired.</p>
        ) : (
          <form className="space-y-4" onSubmit={submit}>
            <label>
              <span className="mb-1.5 block text-xs font-medium">Password</span>
              <input
                autoComplete="new-password"
                className={inputClass}
                minLength={12}
                name="password"
                required
                type="password"
              />
            </label>
            <label>
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
              disabled={loading || !query.data}
              type="submit"
              variant="primary"
            >
              {loading ? "Joining…" : "Join workspace"}
            </Button>
          </form>
        )}
      </div>
    </AuthShell>
  );
}
