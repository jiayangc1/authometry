"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button, StatusBadge } from "@authometry/ui";
import { AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { apiFetch } from "@/lib/api";

interface ConsentRequest {
  application: { name: string };
  scopes: Array<{
    name: string;
    display_name: string;
    consent_description: string;
    sensitivity: string;
  }>;
}
export default function ConsentPage() {
  const requestId = useSearchParams().get("request_id") ?? "";
  const query = useQuery({
    queryKey: ["consent", requestId],
    queryFn: () => apiFetch<ConsentRequest>(`/api/v1/authorize/requests/${requestId}`),
    enabled: Boolean(requestId),
  });
  const [loading, setLoading] = useState(false);
  async function decide(approved: boolean) {
    setLoading(true);
    const result = await apiFetch<{ next: string }>("/api/v1/authorize/consent", {
      method: "POST",
      body: JSON.stringify({ requestId, approved }),
    });
    window.location.assign(result.next);
  }
  return (
    <AuthShell>
      <div className="w-full">
        <AuthHeading
          description={`${query.data?.application.name ?? "This application"} is requesting permission to access your account.`}
          title="Review access"
        />
        <div className="border-y border-[var(--border)]">
          {query.data?.scopes.map((scope) => (
            <div
              className="flex gap-3 border-b border-[var(--border-subtle)] py-3 last:border-0"
              key={scope.name}
            >
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--text-secondary)]" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-medium">{scope.display_name}</p>
                  {scope.sensitivity !== "standard" && (
                    <StatusBadge label={scope.sensitivity} tone="warning" />
                  )}
                </div>
                <p className="mt-0.5 text-xs leading-5 text-[var(--text-secondary)]">
                  {scope.consent_description}
                </p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs leading-5 text-[var(--text-secondary)]">
          You can revoke this access later from your account sessions.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button disabled={loading} onClick={() => void decide(false)}>
            Deny
          </Button>
          <Button disabled={loading} onClick={() => void decide(true)} variant="primary">
            Allow access
          </Button>
        </div>
      </div>
    </AuthShell>
  );
}
