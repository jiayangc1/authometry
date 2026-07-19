"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, KeyRound, Power, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Button, EmptyState, StatusBadge } from "@authometry/ui";
import { ErrorState, PageSkeleton } from "@/components/data-display/states";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { ConfirmDialog } from "@/components/overlays/confirm-dialog";
import { apiFetch } from "@/lib/api";
import { minutesFromSeconds } from "@/lib/format";

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
  const [rotatingKey, setRotatingKey] = useState(false);
  const [disabling, setDisabling] = useState<AgentRow>();
  const agents = useQuery({
    queryKey: ["agents"],
    queryFn: () => apiFetch<{ data: AgentRow[] }>("/api/v1/agents"),
  });

  async function setEnabled(agent: AgentRow, enabled: boolean) {
    try {
      await apiFetch(`/api/v1/agents/${agent.id}/${enabled ? "enable" : "disable"}`, {
        method: "POST",
      });
      await queryClient.invalidateQueries({ queryKey: ["agents"] });
      toast.success(`${agent.display_name} ${enabled ? "enabled" : "disabled"}.`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "The agent status could not be updated.",
      );
      throw error;
    }
  }

  async function rotateKey() {
    if (!rotating) return;
    setRotatingKey(true);
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
    } finally {
      setRotatingKey(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        description="Agents have their own identity. Their registrations cap what they may request before a person or policy can approve a task."
        title="Agent Registry"
      />
      {agents.isLoading ? (
        <PageSkeleton rows={6} />
      ) : agents.isError ? (
        <ErrorState
          description="Authometry could not load registered agent identities. Check your connection, then retry."
          headingLevel="h2"
          onRetry={() => void agents.refetch()}
          title="Unable to Load Agents"
        />
      ) : agents.data?.data.length ? (
        <div className="border-y border-[var(--border)]">
          {agents.data.data.map((agent) => (
            <article
              className="virtualized-row grid gap-4 border-b border-[var(--border-subtle)] px-2 py-5 last:border-0 lg:grid-cols-[minmax(220px,1fr)_minmax(260px,1.4fr)_180px_auto] lg:items-center"
              key={agent.id}
            >
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-raised)]">
                  <Bot aria-hidden="true" className="size-4 text-[var(--text-secondary)]" />
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
                  {agent.capabilities.length ? (
                    agent.capabilities.map((capability) => (
                      <span
                        className="technical-value rounded border border-[var(--border)] bg-[var(--surface-subtle)] px-1.5 py-0.5"
                        key={capability}
                      >
                        {capability}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-[var(--text-tertiary)]">No capabilities</span>
                  )}
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
                    {minutesFromSeconds(agent.maximum_authorization_seconds)}
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
                  <KeyRound aria-hidden="true" className="size-3.5" />
                </Button>
                <Button
                  onClick={() => {
                    if (agent.status === "active") setDisabling(agent);
                    else void setEnabled(agent, true);
                  }}
                  size="compact"
                  variant={agent.status === "active" ? "danger" : "secondary"}
                >
                  {agent.status === "active" ? (
                    <Power aria-hidden="true" className="size-3.5" />
                  ) : (
                    <ShieldCheck aria-hidden="true" className="size-3.5" />
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
          title="No Registered Agents"
        />
      )}
      <ConfirmDialog
        actionLabel="Disable Agent"
        description="New authorizations for this agent will be blocked. Existing grants remain subject to their current limits and expiration."
        onConfirm={() => (disabling ? setEnabled(disabling, false) : undefined)}
        onOpenChange={(open) => {
          if (!open) setDisabling(undefined);
        }}
        open={Boolean(disabling)}
        pendingLabel="Disabling…"
        title={disabling ? `Disable ${disabling.display_name}?` : "Disable agent?"}
      />
      <Dialog.Root
        onOpenChange={(open) => {
          if (!open && !rotatingKey) {
            setRotating(undefined);
            setJwk("");
          }
        }}
        open={Boolean(rotating)}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45" />
          {rotating && (
            <Dialog.Content
              aria-describedby="rotate-agent-key-description"
              className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-24px)] w-[calc(100%-24px)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-lg border border-[var(--border)] bg-[var(--background)] p-5 shadow-2xl"
              onOpenAutoFocus={(event) => {
                if (window.matchMedia("(max-width: 767px)").matches) event.preventDefault();
              }}
            >
              <form
                autoComplete="off"
                onSubmit={(event) => {
                  event.preventDefault();
                  void rotateKey();
                }}
              >
                <Dialog.Title className="text-base font-semibold text-balance">
                  Rotate {rotating.display_name} Key
                </Dialog.Title>
                <Dialog.Description
                  className="mt-1 text-[13px] leading-5 text-[var(--text-secondary)]"
                  id="rotate-agent-key-description"
                >
                  Paste the new public RSA or EC signing JWK. Private key fields are rejected. New
                  assertions must use this key immediately.
                </Dialog.Description>
                <label className="mt-4 block text-xs font-medium" htmlFor="agent-public-jwk">
                  Public JWK
                </label>
                <textarea
                  autoComplete="off"
                  className="technical-value mt-1 min-h-40 w-full resize-y rounded-md border border-[var(--border)] bg-[var(--surface-subtle)] p-3 focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none"
                  id="agent-public-jwk"
                  name="publicJwk"
                  onChange={(event) => setJwk(event.target.value)}
                  placeholder={'{"kty":"EC","crv":"P-256","x":"…","y":"…","alg":"ES256"}'}
                  required
                  spellCheck={false}
                  value={jwk}
                />
                <div className="mt-4 flex justify-end gap-2">
                  <Dialog.Close asChild>
                    <Button disabled={rotatingKey} type="button">
                      Cancel
                    </Button>
                  </Dialog.Close>
                  <Button disabled={rotatingKey} type="submit" variant="primary">
                    {rotatingKey ? "Rotating…" : "Rotate Key"}
                  </Button>
                </div>
              </form>
            </Dialog.Content>
          )}
        </Dialog.Portal>
      </Dialog.Root>
    </PageContainer>
  );
}
