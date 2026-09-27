"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, Note } from "@authometry/ui";
import { AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { Field, Input } from "@/components/ui/form";
import { PasswordInput } from "@/components/ui/password-input";
import { useHydrated } from "@/lib/use-hydrated";

export default function BootstrapPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const search = useSearchParams();
  const urlToken = search.get("token") ?? "";
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
          "x-bootstrap-token": urlToken || String(data.get("token") ?? "").trim(),
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
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <div className="w-full">
        <AuthHeading
          title="Set up Authometry"
          description="Create the first owner account and workspace for this installation."
        />
        <form className="space-y-4" method="post" onSubmit={submit}>
          {!urlToken && (
            <Field
              description="Printed in the server logs or set as BOOTSTRAP_TOKEN."
              label="Setup token"
            >
              <Input autoComplete="off" mono name="token" required spellCheck={false} />
            </Field>
          )}
          <Field label="Your name">
            <Input autoComplete="name" autoFocus name="name" required />
          </Field>
          <Field label="Email">
            <Input autoComplete="email" name="email" required spellCheck={false} type="email" />
          </Field>
          <Field label="Workspace name">
            <Input autoComplete="organization" name="workspaceName" placeholder="Acme" required />
          </Field>
          <Field description="At least 12 characters." label="Password">
            <PasswordInput autoComplete="new-password" minLength={12} name="password" required />
          </Field>
          {error && (
            <Note role="alert" tone="danger">
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
            {loading ? "Creating workspace…" : "Create workspace"}
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}
