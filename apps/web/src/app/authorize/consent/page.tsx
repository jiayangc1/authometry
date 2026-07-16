"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Bot, Clock3, MapPin, ShieldCheck, UserRound } from "lucide-react";
import { Button, StatusBadge } from "@authometry/ui";
import { AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { apiFetch } from "@/lib/api";

interface ConsentRequest {
  application: { name: string };
  agent?: {
    id: string;
    displayName: string;
    operator: string;
    mayDelegate: boolean;
    maximumDelegationDepth: number;
    maximumAuthorizationSeconds: number;
  };
  resource?: string;
  purpose?: string;
  taskId?: string;
  authorizationDetails?: Array<{
    type: "agent_action";
    actions: string[];
    locations: string[];
    constraints?: Record<string, unknown>;
  }>;
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
  const isAgentRequest = Boolean(query.data?.agent);
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
          description={
            isAgentRequest
              ? `${query.data?.agent?.displayName} is asking to perform one approved task—not to sign in as you.`
              : `${query.data?.application.name ?? "This application"} is requesting permission to access your account.`
          }
          title={isAgentRequest ? "Authorize this task" : "Review access"}
        />
        {query.data?.agent && (
          <>
            <div className="mb-5 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] p-3">
              <div className="min-w-0 text-center">
                <UserRound className="mx-auto mb-1 size-4 text-[var(--text-secondary)]" />
                <p className="text-[11px] text-[var(--text-tertiary)]">Authority owner</p>
                <p className="truncate text-xs font-medium">You</p>
              </div>
              <ArrowRight className="size-3.5 text-[var(--text-tertiary)]" />
              <div className="min-w-0 text-center">
                <Bot className="mx-auto mb-1 size-4 text-[var(--text-secondary)]" />
                <p className="text-[11px] text-[var(--text-tertiary)]">Actor</p>
                <p className="truncate text-xs font-medium">{query.data.agent.displayName}</p>
              </div>
              <ArrowRight className="size-3.5 text-[var(--text-tertiary)]" />
              <div className="min-w-0 text-center">
                <MapPin className="mx-auto mb-1 size-4 text-[var(--text-secondary)]" />
                <p className="text-[11px] text-[var(--text-tertiary)]">Resource</p>
                <p className="technical-value truncate">{query.data.resource}</p>
              </div>
            </div>
            <div className="mb-5 border-l-2 border-[var(--accent)] pl-3">
              <p className="text-[11px] font-medium tracking-wide text-[var(--text-tertiary)] uppercase">
                Approved purpose
              </p>
              <p className="mt-1 text-sm font-semibold">{query.data.purpose}</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                Operated by {query.data.agent.operator}
              </p>
            </div>
          </>
        )}
        <div className="border-y border-[var(--border)]">
          {query.data?.authorizationDetails?.map((detail, index) => (
            <div
              className="border-b border-[var(--border-subtle)] py-3"
              key={`${detail.locations.join(":")}-${index}`}
            >
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--text-secondary)]" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium">
                    {detail.actions
                      .map((action) => `${action[0]?.toUpperCase()}${action.slice(1)}`)
                      .join(", ")}
                  </p>
                  {detail.locations.map((location) => (
                    <p
                      className="technical-value mt-1 truncate text-[var(--text-tertiary)]"
                      key={location}
                    >
                      {location}
                    </p>
                  ))}
                  {detail.constraints && Object.keys(detail.constraints).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {Object.entries(detail.constraints).map(([name, value]) => (
                        <span
                          className="rounded border border-[var(--border)] bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[11px] text-[var(--text-secondary)]"
                          key={name}
                        >
                          {name.replaceAll("_", " ")}:{" "}
                          {typeof value === "object" ? JSON.stringify(value) : String(value)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {!isAgentRequest &&
            query.data?.scopes.map((scope) => (
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
        {query.data?.agent ? (
          <div className="mt-4 flex items-start gap-2 text-xs leading-5 text-[var(--text-secondary)]">
            <Clock3 className="mt-0.5 size-3.5 shrink-0" />
            <p>
              Expires {Math.round(query.data.agent.maximumAuthorizationSeconds / 60)} minutes after
              approval. The agent cannot use this grant for another resource or purpose, and cannot
              expand it without another approval.
              {query.data.agent.mayDelegate
                ? ` It may delegate a reduced subset up to depth ${query.data.agent.maximumDelegationDepth}.`
                : " It cannot delegate this authority to another agent."}
            </p>
          </div>
        ) : (
          <p className="mt-4 text-xs leading-5 text-[var(--text-secondary)]">
            You can revoke this access later from your account sessions.
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <Button disabled={loading} onClick={() => void decide(false)}>
            Deny
          </Button>
          <Button disabled={loading} onClick={() => void decide(true)} variant="primary">
            {isAgentRequest ? "Approve task" : "Allow access"}
          </Button>
        </div>
      </div>
    </AuthShell>
  );
}
