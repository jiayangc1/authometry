"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { Button } from "@authometry/ui";
import { AuthHeading, AuthShell, inputClass } from "@/components/auth/auth-shell";
import { apiFetch } from "@/lib/api";
import { useHydrated } from "@/lib/use-hydrated";

export default function DevicePage() {
  const hydrated = useHydrated();
  const params = useSearchParams();
  const [code, setCode] = useState(params.get("user_code") ?? "");
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
      setError(caught instanceof Error ? caught.message : "Device verification failed.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <AuthShell>
      <div className="w-full">
        {complete ? (
          <div className="text-center">
            <CheckCircle2 aria-hidden="true" className="mx-auto size-8 text-[var(--success)]" />
            <h1 className="mt-4 text-xl font-semibold text-balance">Device Connected</h1>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Return to your device. You can close this page.
            </p>
          </div>
        ) : (
          <>
            <AuthHeading
              description="Enter the code shown on your device, then authenticate to approve access."
              title="Connect a Device"
            />
            <form className="space-y-4" method="post" onSubmit={submit}>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium">Device code</span>
                <input
                  autoCapitalize="characters"
                  autoComplete="one-time-code"
                  className={`${inputClass} technical-value text-center tracking-[0.2em] uppercase`}
                  inputMode="text"
                  name="userCode"
                  onChange={(event) => setCode(event.target.value)}
                  spellCheck={false}
                  value={code}
                />
              </label>
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
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium">Password</span>
                <input
                  autoComplete="current-password"
                  className={inputClass}
                  name="password"
                  required
                  type="password"
                />
              </label>
              {error && (
                <p className="text-xs text-[var(--danger)]" role="alert">
                  {error} Check the code and credentials, then try again.
                </p>
              )}
              <Button
                aria-busy={loading}
                className="w-full"
                disabled={!hydrated || loading}
                type="submit"
                variant="primary"
              >
                {loading ? (
                  <>
                    <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> Connecting…
                  </>
                ) : (
                  "Connect Device"
                )}
              </Button>
            </form>
          </>
        )}
      </div>
    </AuthShell>
  );
}
