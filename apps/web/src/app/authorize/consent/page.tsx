"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  Bot,
  Cable,
  Clock3,
  MapPin,
  ServerCog,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Button, Note, StatusBadge } from "@authometry/ui";
import { AuthorizationShell } from "@/components/auth/auth-shell";
import { ErrorState, Skeleton } from "@/components/data-display/states";
import { apiFetch } from "@/lib/api";

interface ConsentRequest {
  application: { name: string; clientIdSource: "auto" | "manifest" | "dynamic" };
  agent?: {
    id: string;
    displayName: string;
    operator: string;
    mayDelegate: boolean;
    maximumDelegationDepth: number;
    maximumAuthorizationSeconds: number;
  };
  resource?: string;
  mcp?: { serverName: string; resource: string };
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
  const [decision, setDecision] = useState<"approve" | "deny">();
  const [error, setError] = useState<string>();
  const isAgentRequest = Boolean(query.data?.agent);
  const isMcpRequest = Boolean(query.data?.mcp);
  async function decide(approved: boolean) {
    setLoading(true);
    setDecision(approved ? "approve" : "deny");
    setError(undefined);
    try {
      const result = await apiFetch<{ next: string }>("/api/v1/authorize/consent", {
        method: "POST",
        body: JSON.stringify({ requestId, approved }),
      });
      window.location.assign(result.next);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "The consent decision could not be saved.",
      );
      setLoading(false);
      setDecision(undefined);
    }
  }
  if (query.isLoading)
    return (
      <AuthorizationShell>
        <div className="space-y-3" role="status" aria-label="Loading…">
          <Skeleton className="mx-auto h-7 w-48" />
          <Skeleton className="mx-auto h-4 w-64" />
          <Skeleton className="mt-6 h-32 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </AuthorizationShell>
    );
  if (!requestId || query.isError || !query.data)
    return (
      <AuthorizationShell>
        <ErrorState
          description="The authorization request is missing, expired, or unavailable. Return to the application and start again."
          {...(requestId ? { onRetry: () => void query.refetch() } : {})}
          title="This request is no longer available"
        />
      </AuthorizationShell>
    );
  return (
    <AuthorizationShell>
      <div className="w-full">
        <header className="mb-6 text-center">
          <h1 className="text-2xl leading-8 font-semibold tracking-[-0.03em] text-balance">
            {isAgentRequest
              ? "Authorize this task"
              : isMcpRequest
                ? "Connect to Authometry MCP"
                : "Review access"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            {isAgentRequest ? (
              <>
                <span className="font-medium text-[var(--text-primary)]">
                  {query.data?.agent?.displayName}
                </span>{" "}
                wants to perform one approved task
              </>
            ) : isMcpRequest ? (
              <>
                <span className="font-medium text-[var(--text-primary)]">
                  {query.data?.application.name ?? "This MCP client"}
                </span>{" "}
                is asking to use the Authometry MCP server
              </>
            ) : (
              <>
                <span className="font-medium text-[var(--text-primary)]">
                  {query.data?.application.name ?? "This application"}
                </span>{" "}
                wants access to your account
              </>
            )}
          </p>
        </header>
        {query.data?.mcp && (
          <div className="mb-5 overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-subtle)]">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-4">
              <div className="min-w-0 text-center">
                <Cable
                  aria-hidden="true"
                  className="mx-auto mb-1.5 size-4 text-[var(--text-secondary)]"
                />
                <p className="text-[11px] text-[var(--text-tertiary)]">MCP client</p>
                <p className="mt-1 truncate text-xs font-medium">{query.data.application.name}</p>
                {query.data.application.clientIdSource === "dynamic" && (
                  <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                    Name supplied by client
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 text-[var(--text-tertiary)]">
                <span className="h-px w-4 bg-[var(--border-strong)]" />
                <ArrowRight aria-hidden="true" className="size-3.5" />
                <span className="h-px w-4 bg-[var(--border-strong)]" />
              </div>
              <div className="min-w-0 text-center">
                <ServerCog
                  aria-hidden="true"
                  className="mx-auto mb-1.5 size-4 text-[var(--text-secondary)]"
                />
                <p className="text-[11px] text-[var(--text-tertiary)]">Protected resource</p>
                <p className="mt-1 text-xs leading-4 font-medium break-words">
                  {query.data.mcp.serverName}
                </p>
              </div>
            </div>
            <div className="border-t border-[var(--border)] px-3 py-2 text-center">
              <p className="technical-value truncate text-[var(--text-tertiary)]">
                {query.data.mcp.resource}
              </p>
            </div>
          </div>
        )}
        {query.data?.agent && (
          <>
            <div className="mb-5 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-subtle)] p-3">
              <div className="min-w-0 text-center">
                <UserRound
                  aria-hidden="true"
                  className="mx-auto mb-1 size-4 text-[var(--text-secondary)]"
                />
                <p className="text-[11px] text-[var(--text-tertiary)]">Authority owner</p>
                <p className="truncate text-xs font-medium">You</p>
              </div>
              <ArrowRight aria-hidden="true" className="size-3.5 text-[var(--text-tertiary)]" />
              <div className="min-w-0 text-center">
                <Bot
                  aria-hidden="true"
                  className="mx-auto mb-1 size-4 text-[var(--text-secondary)]"
                />
                <p className="text-[11px] text-[var(--text-tertiary)]">Actor</p>
                <p className="truncate text-xs font-medium">{query.data.agent.displayName}</p>
              </div>
              <ArrowRight aria-hidden="true" className="size-3.5 text-[var(--text-tertiary)]" />
              <div className="min-w-0 text-center">
                <MapPin
                  aria-hidden="true"
                  className="mx-auto mb-1 size-4 text-[var(--text-secondary)]"
                />
                <p className="text-[11px] text-[var(--text-tertiary)]">Resource</p>
                <p className="technical-value truncate">{query.data.resource}</p>
              </div>
            </div>
            <div className="mb-5 rounded-[var(--radius-card)] border border-[var(--border)] p-3">
              <p className="text-xs text-[var(--text-secondary)]">Approved purpose</p>
              <p className="mt-1 text-sm font-semibold">{query.data.purpose}</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                Operated by {query.data.agent.operator}
              </p>
            </div>
          </>
        )}
        <div className="stagger overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] px-4">
          {query.data?.authorizationDetails?.map((detail, index) => (
            <div
              className="border-b border-[var(--border)] py-3"
              key={`${detail.locations.join(":")}-${index}`}
            >
              <div className="flex items-start gap-3">
                <ShieldCheck
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-[var(--success)]"
                />
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
                          className="rounded-[4px] bg-[var(--geist-gray-100)] px-1.5 py-0.5 text-[11px] text-[var(--text-secondary)]"
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
                className="flex gap-3 border-b border-[var(--border)] py-3 last:border-0"
                key={scope.name}
              >
                <ShieldCheck
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-[var(--success)]"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-medium">{scope.display_name}</p>
                    {scope.sensitivity !== "standard" && (
                      <StatusBadge
                        label={
                          scope.sensitivity.charAt(0).toUpperCase() + scope.sensitivity.slice(1)
                        }
                        tone={scope.sensitivity === "restricted" ? "danger" : "warning"}
                      />
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
            <Clock3 aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            <p>
              Expires {Math.round(query.data.agent.maximumAuthorizationSeconds / 60)} minutes after
              approval. The agent cannot use this grant for another resource or purpose, and cannot
              expand it without another approval.
              {query.data.agent.mayDelegate
                ? ` It may delegate a reduced subset up to depth ${query.data.agent.maximumDelegationDepth}.`
                : " It cannot delegate this authority to another agent."}
            </p>
          </div>
        ) : isMcpRequest ? (
          <p className="mt-4 text-xs leading-5 text-[var(--text-secondary)]">
            Access is limited to this MCP server and the permissions shown above. You can disable
            this client later from Applications.
          </p>
        ) : (
          <p className="mt-4 text-xs leading-5 text-[var(--text-secondary)]">
            You can revoke this access later from your account sessions.
          </p>
        )}
        {error && (
          <Note className="mt-4" role="alert" tone="danger">
            {error} Try again or return to the requesting application.
          </Note>
        )}
        <div className="mt-6 grid grid-cols-2 gap-2">
          <Button
            disabled={loading}
            loading={loading && decision === "deny"}
            onClick={() => void decide(false)}
            size="large"
          >
            {loading && decision === "deny" ? "Denying…" : "Deny"}
          </Button>
          <Button
            disabled={loading}
            loading={loading && decision === "approve"}
            onClick={() => void decide(true)}
            size="large"
            variant="primary"
          >
            {loading && decision === "approve"
              ? "Saving…"
              : isAgentRequest
                ? "Approve task"
                : isMcpRequest
                  ? "Connect"
                  : "Allow access"}
          </Button>
        </div>
      </div>
    </AuthorizationShell>
  );
}
