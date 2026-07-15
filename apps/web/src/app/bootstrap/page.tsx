"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@authometry/ui";
import { AuthHeading, AuthShell, inputClass } from "@/components/auth/auth-shell";

export default function BootstrapPage() {
  const router = useRouter();
  const search = useSearchParams();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(undefined);
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/v1/auth/bootstrap", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-bootstrap-token": search.get("token") ?? "",
        },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          password: data.get("password"),
          workspaceName: data.get("workspaceName"),
        }),
      });
      const result = (await response.json().catch(() => undefined)) as
        { error?: { message?: string } } | undefined;
      if (!response.ok) throw new Error(result?.error?.message ?? "Setup failed.");
      router.push("/overview");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Setup failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <div className="w-full">
        <AuthHeading
          title="Set up Authometry"
          description="Create the first owner and workspace for this installation."
        />
        <form className="space-y-4" onSubmit={submit}>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium">Your name</span>
            <input autoComplete="name" className={inputClass} name="name" required />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium">Email address</span>
            <input autoComplete="email" className={inputClass} name="email" required type="email" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium">Workspace name</span>
            <input className={inputClass} defaultValue="Acme" name="workspaceName" required />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium">Password</span>
            <input
              autoComplete="new-password"
              className={inputClass}
              minLength={12}
              name="password"
              required
              type="password"
            />
            <span className="mt-1 block text-xs text-[var(--text-tertiary)]">
              Use at least 12 characters.
            </span>
          </label>
          {error && (
            <p className="text-[13px] text-[var(--danger)]" role="alert">
              {error}
            </p>
          )}
          <Button className="w-full" disabled={loading} type="submit" variant="primary">
            {loading ? "Creating workspace…" : "Create workspace"}
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}
