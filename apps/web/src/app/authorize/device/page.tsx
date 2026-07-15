"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@authometry/ui";
import { AuthHeading, AuthShell, inputClass } from "@/components/auth/auth-shell";
import { apiFetch } from "@/lib/api";

export default function DevicePage() {
  const params = useSearchParams();
  const [code, setCode] = useState(params.get("user_code") ?? "");
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string>();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
    }
  }
  return (
    <AuthShell>
      <div className="w-full">
        {complete ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto size-8 text-[var(--success)]" />
            <h1 className="mt-4 text-xl font-semibold">Device connected</h1>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Return to your device. You can close this page.
            </p>
          </div>
        ) : (
          <>
            <AuthHeading
              description="Enter the code shown on your device, then authenticate to approve access."
              title="Connect a device"
            />
            <form className="space-y-4" onSubmit={submit}>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium">Device code</span>
                <input
                  autoCapitalize="characters"
                  className={`${inputClass} technical-value text-center tracking-[0.2em] uppercase`}
                  onChange={(event) => setCode(event.target.value)}
                  value={code}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium">Email address</span>
                <input className={inputClass} name="email" required type="email" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium">Password</span>
                <input className={inputClass} name="password" required type="password" />
              </label>
              {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
              <Button className="w-full" type="submit" variant="primary">
                Connect device
              </Button>
            </form>
          </>
        )}
      </div>
    </AuthShell>
  );
}
