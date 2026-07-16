"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, KeyRound, Power, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Button, EmptyState, StatusBadge } from "@authometry/ui";
import { ErrorState, PageSkeleton } from "@/components/data-display/states";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { apiFetch } from "@/lib/api";

interface AgentRow {
  id: string;
  agent_id: string;
  display_name: string;
  operator_id: string;
  client_id: string;
  capabilities: string[];
  allowed_resources: string[];
  may_receive_delegation: boolean;
  may_delegate: boolean;
  maximum_delegation_depth: number;
  maximum_authorization_seconds: number;
  active_grants: number;
  status: "active" | "disabled";
}

export default function AgentsPage() {
  const queryClient = useQueryClient();
  const [rotating, setRotating] = useState<AgentRow>();
  const [jwk, setJwk] = useState("");
  const agents = useQuery({
    queryKey: ["agents"],
    queryFn: () => apiFetch<{ data: AgentRow[] }>("/api/v1/agents"),
  });

  async function setEnabled(agent: AgentRow, enabled: boolean) {
    await apiFetch(`/api/v1/agents/${agent.id}/${enabled ? "enable" : "disable"}`, {
      method: "POST",
    });
    await queryClient.invalidateQueries({ queryKey: ["agents"] });
    toast.success(`${agent.display_name} ${enabled ? "enabled" : "disabled"}.`);
  }

  async function rotateKey() {
    if (!rotating) return;
    try {
      const publicJwk = JSON.parse(jwk) as Record<string, unknown>;
      await apiFetch(`/api/v1/agents/${rotating.id}/rotate-key`, {
        method: "POST",
        body: JSON.stringify({ publicJwk }),
      });
      toast.success(`${rotating.display_name} signing key rotated.`);
      setRotating(undefined);
      setJwk("");
    } catch {
      toast.error("The public JWK is invalid or could not be saved.");
    }
  }

  return (
    <PageContainer>
      <PageHeader
        description="Agents have their own identity. Their registrations cap what they may request before a person or policy can approve a task."
        title="Agent registry"
      />
      {agents.isLoading ? (
        <PageSkeleton rows={6} />
      ) : agents.isError ? (
        <ErrorState
          description="Authometry could not load registered agent identities."
          onRetry={() => void agents.refetch()}
          title="Unable to load agents"
        />
      ) : agents.data?.data.length ? (
        <div className="border-y border-[var(--border)]">
          {agents.data.data.map((agent) => (
            <article
              className="grid gap-4 border-b border-[var(--border-subtle)] px-2 py-5 last:border-0 lg:grid-cols-[minmax(220px,1fr)_minmax(260px,1.4fr)_180px_auto] lg:items-center"
              key={agent.id}
            >
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-raised)]">
                  <Bot className="size-4 text-[var(--text-secondary)]" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-[13px] font-semibold">{agent.display_name}</h2>
                    <StatusBadge
                      label={agent.status === "active" ? "Active" : "Disabled"}
                      tone={agent.status === "active" ? "success" : "neutral"}
                    />
                  </div>
                  <p className="technical-value mt-1 truncate text-[var(--text-tertiary)]">
                    {agent.agent_id}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    Operated by {agent.operator_id}
                  </p>
                </div>
              </div>
              <div>
                <p className="mb-2 text-[11px] font-medium tracking-wide text-[var(--text-tertiary)] uppercase">
                  Maximum capabilities
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {agent.capabilities.map((capability) => (
                    <span
                      className="technical-value rounded border border-[var(--border)] bg-[var(--surface-subtle)] px-1.5 py-0.5"
                      key={capability}
                    >
                      {capability}
                    </span>
                  ))}
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-xs lg:grid-cols-1 lg:gap-1.5">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[var(--text-tertiary)]">Active grants</dt>
                  <dd className="font-medium">{agent.active_grants}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[var(--text-tertiary)]">Max duration</dt>
                  <dd className="font-medium">
                    {Math.round(agent.maximum_authorization_seconds / 60)}m
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[var(--text-tertiary)]">Delegation</dt>
                  <dd className="font-medium">
                    {agent.may_delegate ? `Depth ${agent.maximum_delegation_depth}` : "No onward"}
                  </dd>
                </div>
              </dl>
              <div className="flex items-center gap-1 lg:justify-end">
                <Button
                  aria-label={`Rotate ${agent.display_name} key`}
                  onClick={() => setRotating(agent)}
                  size="icon"
                  variant="ghost"
                >
                  <KeyRound className="size-3.5" />
                </Button>
                <Button
                  onClick={() => void setEnabled(agent, agent.status !== "active")}
                  size="compact"
                  variant={agent.status === "active" ? "danger" : "secondary"}
                >
                  {agent.status === "active" ? (
                    <Power className="size-3.5" />
                  ) : (
                    <ShieldCheck className="size-3.5" />
                  )}
                  {agent.status === "active" ? "Disable" : "Enable"}
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          description="Register agents through the management API with a public signing key, operator, capabilities, resources, and delegation limits."
          icon={Bot}
          title="No registered agents"
        />
      )}
      {rotating && (
        <div
          aria-labelledby="rotate-agent-key-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          role="dialog"
        >
          <form
            className="w-full max-w-lg rounded-lg border border-[var(--border)] bg-[var(--background)] p-5 shadow-2xl"
            onSubmit={(event) => {
              event.preventDefault();
              void rotateKey();
            }}
          >
            <h2 className="text-base font-semibold" id="rotate-agent-key-title">
              Rotate {rotating.display_name} key
            </h2>
            <p className="mt-1 text-[13px] leading-5 text-[var(--text-secondary)]">
              Paste the new public RSA or EC signing JWK. Private key fields are rejected. New
              assertions must use this key immediately.
            </p>
            <label className="mt-4 block text-xs font-medium" htmlFor="agent-public-jwk">
              Public JWK
            </label>
            <textarea
              autoFocus
              className="technical-value mt-1 min-h-40 w-full resize-y rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] p-3 outline-none focus:border-[var(--focus)] focus:ring-2 focus:ring-[var(--focus)]/20"
              id="agent-public-jwk"
              onChange={(event) => setJwk(event.target.value)}
              placeholder={'{"kty":"EC","crv":"P-256","x":"...","y":"...","alg":"ES256"}'}
              required
              value={jwk}
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button
                onClick={() => {
                  setRotating(undefined);
                  setJwk("");
                }}
                type="button"
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Rotate key
              </Button>
            </div>
          </form>
        </div>
      )}
    </PageContainer>
  );
}
