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
import { Button, StatusBadge } from "@authometry/ui";
import { AuthorizationShell } from "@/components/auth/auth-shell";
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
  const isAgentRequest = Boolean(query.data?.agent);
  const isMcpRequest = Boolean(query.data?.mcp);
  async function decide(approved: boolean) {
    setLoading(true);
    const result = await apiFetch<{ next: string }>("/api/v1/authorize/consent", {
      method: "POST",
      body: JSON.stringify({ requestId, approved }),
    });
    window.location.assign(result.next);
  }
  return (
    <AuthorizationShell>
      <div className="w-full">
        <header className="mb-8 text-center">
          <h1 className="text-[28px] leading-9 font-medium tracking-[-0.035em]">
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
          <div className="mb-5 overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--surface-subtle)]">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-4">
              <div className="min-w-0 text-center">
                <Cable className="mx-auto mb-1.5 size-4 text-[var(--accent)]" />
                <p className="text-[10px] font-semibold tracking-[0.1em] text-[var(--text-tertiary)] uppercase">
                  MCP client
                </p>
                <p className="mt-1 truncate text-xs font-medium">{query.data.application.name}</p>
                {query.data.application.clientIdSource === "dynamic" && (
                  <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">
                    Name supplied by client
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 text-[var(--text-tertiary)]">
                <span className="h-px w-4 bg-[var(--border-strong)]" />
                <ArrowRight className="size-3.5" />
                <span className="h-px w-4 bg-[var(--border-strong)]" />
              </div>
              <div className="min-w-0 text-center">
                <ServerCog className="mx-auto mb-1.5 size-4 text-[var(--accent)]" />
                <p className="text-[10px] font-semibold tracking-[0.1em] text-[var(--text-tertiary)] uppercase">
                  Protected resource
                </p>
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
            <div className="mb-5 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-3">
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
        <div className="overflow-hidden rounded-xl border border-[var(--border)] px-4">
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
        <div className="mt-7 grid grid-cols-2 gap-2.5">
          <Button
            className="h-10 rounded-full text-sm"
            disabled={loading}
            onClick={() => void decide(false)}
          >
            Deny
          </Button>
          <Button
            className="h-10 rounded-full text-sm"
            disabled={loading}
            onClick={() => void decide(true)}
            variant="primary"
          >
            {isAgentRequest ? "Approve task" : isMcpRequest ? "Connect" : "Allow access"}
          </Button>
        </div>
      </div>
    </AuthorizationShell>
  );
}
