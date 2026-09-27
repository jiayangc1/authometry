"use client";

import { CheckCircle2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, Note } from "@authometry/ui";
import { AuthorizationShell } from "@/components/auth/auth-shell";
import { Field, Input } from "@/components/ui/form";
import { PasswordInput } from "@/components/ui/password-input";
import { apiFetch } from "@/lib/api";
import { useHydrated } from "@/lib/use-hydrated";

function formatCode(value: string) {
  const clean = value
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "")
    .slice(0, 8);
  return clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}

export default function DevicePage() {
  const hydrated = useHydrated();
  const params = useSearchParams();
  const [code, setCode] = useState(formatCode(params.get("user_code") ?? ""));
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(undefined);
    const data = new FormData(event.currentTarget);
    try {
      await apiFetch("/api/v1/authorize/device", {
        method: "POST",
        body: JSON.stringify({
          userCode: code,
          email: data.get("email"),
          password: data.get("password"),
          approved: true,
        }),
      });
      setComplete(true);
    } catch (caught) {
      setError(
        `${caught instanceof Error ? caught.message : "Device verification failed."} Check the code and your credentials, then try again.`,
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <AuthorizationShell>
      <div className="w-full">
        {complete ? (
          <div className="animate-enter text-center" role="status">
            <span className="animate-pop mx-auto flex size-12 items-center justify-center rounded-full bg-[var(--success-soft)] text-[var(--success)]">
              <CheckCircle2 aria-hidden="true" className="size-6" />
            </span>
            <h1 className="mt-4 text-xl font-semibold tracking-[-0.02em] text-balance">
              Device connected
            </h1>
            <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
              Return to your device. You can close this page.
            </p>
          </div>
        ) : (
          <>
            <header className="mb-6 text-center">
              <h1 className="text-2xl leading-8 font-semibold tracking-[-0.03em]">
                Connect a device
              </h1>
              <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
                Enter the code shown on your device, then sign in to approve it.
              </p>
            </header>
            <form className="space-y-4" method="post" onSubmit={submit}>
              <Field label="Device code">
                <Input
                  autoCapitalize="characters"
                  autoComplete="one-time-code"
                  autoFocus={!code}
                  className="h-12 text-center text-lg tracking-[0.3em] uppercase"
                  mono
                  name="userCode"
                  onChange={(event) => setCode(formatCode(event.target.value))}
                  placeholder="ABCD-EFGH"
                  required
                  spellCheck={false}
                  value={code}
                />
              </Field>
              <Field label="Email">
                <Input
                  autoComplete="email"
                  autoFocus={Boolean(code)}
                  className="h-10"
                  name="email"
                  required
                  spellCheck={false}
                  type="email"
                />
              </Field>
              <Field label="Password">
                <PasswordInput autoComplete="current-password" large name="password" required />
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
                {loading ? "Connecting…" : "Connect device"}
              </Button>
            </form>
          </>
        )}
      </div>
    </AuthorizationShell>
  );
}
