"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Bot, KeyRound, Power, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useState } from "react";
import { Button, EmptyState, StatusBadge } from "@authometry/ui";
import { ErrorState, ListSkeleton } from "@/components/data-display/states";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { ConfirmDialog } from "@/components/overlays/confirm-dialog";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/form";
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

  let jwkError: string | undefined;
  if (jwk.trim()) {
    try {
      const parsed = JSON.parse(jwk) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        jwkError = "Paste a single JWK object.";
      else if (!("kty" in parsed)) jwkError = "The JWK needs a “kty” member.";
      else if ("d" in parsed) jwkError = "This is a private key. Paste the public JWK only.";
    } catch {
      jwkError = "This is not valid JSON.";
    }
  }

  async function rotateKey() {
    if (!rotating || jwkError || !jwk.trim()) return;
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
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The key could not be rotated.");
    } finally {
      setRotatingKey(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        actions={
          <Button asChild>
            <Link href="/developer/playground">
              <BookOpen aria-hidden="true" className="size-3.5" /> API reference
            </Link>
          </Button>
        }
        description="Agents have their own identity. Their registration caps what they may request before a person or policy approves a task."
        title="Agents"
      />
      {agents.isLoading ? (
        <ListSkeleton rows={4} />
      ) : agents.isError ? (
        <ErrorState
          description="Authometry could not load registered agents. Check your connection, then retry."
          headingLevel="h2"
          onRetry={() => void agents.refetch()}
          title="Unable to load agents"
        />
      ) : agents.data?.data.length ? (
        <div className="stagger space-y-3">
          {agents.data.data.map((agent) => (
            <Card className="overflow-hidden" key={agent.id}>
              <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface-subtle)]">
                    <Bot aria-hidden="true" className="size-4 text-[var(--text-secondary)]" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-sm font-semibold">{agent.display_name}</h2>
                      <StatusBadge
                        label={agent.status === "active" ? "Active" : "Disabled"}
                        tone={agent.status === "active" ? "success" : "neutral"}
                      />
                    </div>
                    <p className="technical-value truncate text-[var(--text-tertiary)]">
                      {agent.agent_id}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                      Operated by {agent.operator_id}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button onClick={() => setRotating(agent)} size="compact" variant="ghost">
                    <KeyRound aria-hidden="true" className="size-3.5" /> Rotate key
                  </Button>
                  <Button
                    className={agent.status === "active" ? "hover:text-[var(--danger)]" : undefined}
                    onClick={() => {
                      if (agent.status === "active") setDisabling(agent);
                      else void setEnabled(agent, true);
                    }}
                    size="compact"
                    variant={agent.status === "active" ? "ghost" : "secondary"}
                  >
                    {agent.status === "active" ? (
                      <Power aria-hidden="true" className="size-3.5" />
                    ) : (
                      <ShieldCheck aria-hidden="true" className="size-3.5" />
                    )}
                    {agent.status === "active" ? "Disable" : "Enable"}
                  </Button>
                </div>
              </div>
              <div className="grid gap-px border-t border-[var(--border)] bg-[var(--border)] sm:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
                <div className="bg-[var(--surface-subtle)] px-4 py-3">
                  <p className="text-xs text-[var(--text-secondary)]">Maximum capabilities</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {agent.capabilities.length ? (
                      agent.capabilities.map((capability) => (
                        <span
                          className="technical-value rounded-[4px] bg-[var(--geist-gray-100)] px-1.5 py-0.5 text-[11px]"
                          key={capability}
                        >
                          {capability}
                        </span>
                      ))
                    ) : (
                      <span className="text-[13px] text-[var(--text-tertiary)]">None</span>
                    )}
                  </div>
                </div>
                {[
                  ["Active grants", String(agent.active_grants)],
                  ["Max duration", minutesFromSeconds(agent.maximum_authorization_seconds)],
                  [
                    "Delegation",
                    agent.may_delegate
                      ? `Up to depth ${agent.maximum_delegation_depth}`
                      : "Not allowed",
                  ],
                ].map(([label, value]) => (
                  <div className="bg-[var(--surface-subtle)] px-4 py-3" key={label}>
                    <p className="text-xs text-[var(--text-secondary)]">{label}</p>
                    <p className="mt-1 text-[13px] font-medium tabular-nums">{value}</p>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          description="Register agents through the management API with a public signing key, operator, capabilities, resources, and delegation limits."
          icon={Bot}
          primaryAction={
            <Button asChild>
              <Link href="/developer/playground">Open API reference</Link>
            </Button>
          }
          title="No registered agents"
        />
      )}
      <ConfirmDialog
        actionLabel="Disable agent"
        description="New authorizations for this agent are blocked. Existing grants keep their current limits and expiry."
        onConfirm={() => (disabling ? setEnabled(disabling, false) : undefined)}
        onOpenChange={(open) => {
          if (!open) setDisabling(undefined);
        }}
        open={Boolean(disabling)}
        pendingLabel="Disabling…"
        title={disabling ? `Disable ${disabling.display_name}?` : "Disable agent?"}
      />
      <Modal
        description="Paste the new public RSA or EC signing JWK. New assertions must use this key immediately."
        footer={
          <>
            <Button
              disabled={rotatingKey}
              onClick={() => {
                setRotating(undefined);
                setJwk("");
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={!jwk.trim() || Boolean(jwkError)}
              form="rotate-agent-key-form"
              loading={rotatingKey}
              type="submit"
              variant="primary"
            >
              {rotatingKey ? "Rotating…" : "Rotate key"}
            </Button>
          </>
        }
        onOpenChange={(open) => {
          if (!open) {
            setRotating(undefined);
            setJwk("");
          }
        }}
        open={Boolean(rotating)}
        preventClose={rotatingKey}
        title={rotating ? `Rotate ${rotating.display_name} key` : "Rotate key"}
      >
        <form
          autoComplete="off"
          id="rotate-agent-key-form"
          onSubmit={(event) => {
            event.preventDefault();
            void rotateKey();
          }}
        >
          <Field
            description={jwk.trim() && !jwkError ? "Looks like a valid public JWK." : undefined}
            error={jwkError}
            label="Public JWK"
          >
            <Textarea
              className="min-h-40"
              mono
              name="publicJwk"
              onChange={(event) => setJwk(event.target.value)}
              placeholder={'{"kty":"EC","crv":"P-256","x":"…","y":"…","alg":"ES256"}'}
              required
              spellCheck={false}
              value={jwk}
            />
          </Field>
        </form>
      </Modal>
    </PageContainer>
  );
}
