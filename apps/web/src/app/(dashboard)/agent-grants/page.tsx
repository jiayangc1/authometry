"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Bot, Stamp, UserRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button, EmptyState, StatusBadge } from "@authometry/ui";
import { RelativeTime } from "@/components/data-display/formatted-time";
import { ErrorState, PageSkeleton } from "@/components/data-display/states";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { ConfirmDialog } from "@/components/overlays/confirm-dialog";
import { apiFetch } from "@/lib/api";

interface GrantRow {
  id: string;
  agent_name: string;
  agent_id: string;
  operator_id: string;
  subject_name: string;
  subject_email: string;
  resource: string;
  purpose: string;
  scopes: string[];
  status: "active" | "completed" | "revoked" | "expired";
  maximum_usage: number | null;
  usage_count: number;
  expires_at: string;
}

export default function AgentGrantsPage() {
  const queryClient = useQueryClient();
  const [selectedGrant, setSelectedGrant] = useState<GrantRow>();
  const grants = useQuery({
    queryKey: ["agent-grants"],
    queryFn: () => apiFetch<{ data: GrantRow[] }>("/api/v1/agent-grants"),
  });

  async function revoke(grant: GrantRow) {
    try {
      await apiFetch(`/api/v1/agent-grants/${grant.id}/revoke`, {
        method: "POST",
        body: JSON.stringify({ reason: "dashboard_revocation" }),
      });
      await queryClient.invalidateQueries({ queryKey: ["agent-grants"] });
      toast.success(`${grant.agent_name} grant revoked.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The grant could not be revoked.");
      throw error;
    }
  }

  return (
    <PageContainer>
      <PageHeader
        description="Every row is a task authorization—not a login session. Subject, actor, resource, purpose, limits, and lifetime remain independently visible."
        title="Agent Grants"
      />
      {grants.isLoading ? (
        <PageSkeleton rows={7} />
      ) : grants.isError ? (
        <ErrorState
          description="Authometry could not load agent authorization grants. Check your connection, then retry."
          headingLevel="h2"
          onRetry={() => void grants.refetch()}
          title="Unable to Load Grants"
        />
      ) : grants.data?.data.length ? (
        <div className="border-y border-[var(--border)]">
          {grants.data.data.map((grant) => (
            <article
              className="virtualized-row border-b border-[var(--border-subtle)] px-2 py-5 last:border-0"
              key={grant.id}
            >
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                <div className="min-w-0 flex-1">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <StatusBadge
                      label={grant.status}
                      tone={grant.status === "active" ? "success" : "neutral"}
                    />
                    <p className="text-sm font-semibold">{grant.purpose}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 text-[var(--text-secondary)]">
                      <UserRound aria-hidden="true" className="size-3.5" /> {grant.subject_name}
                    </span>
                    <ArrowRight aria-hidden="true" className="size-3 text-[var(--text-tertiary)]" />
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <Bot aria-hidden="true" className="size-3.5" /> {grant.agent_name}
                    </span>
                    <ArrowRight aria-hidden="true" className="size-3 text-[var(--text-tertiary)]" />
                    <span className="technical-value max-w-full truncate">{grant.resource}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {grant.scopes.length ? (
                      grant.scopes.map((scope) => (
                        <span
                          className="technical-value rounded border border-[var(--border)] bg-[var(--surface-subtle)] px-1.5 py-0.5"
                          key={scope}
                        >
                          {scope}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-[var(--text-tertiary)]">No scopes</span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-4 text-xs">
                  <div className="text-right">
                    <p className="text-[var(--text-tertiary)]">Usage</p>
                    <p className="font-medium">
                      {grant.usage_count} / {grant.maximum_usage ?? "unlimited"}
                    </p>
                  </div>
                  <div className="min-w-24 text-right">
                    <p className="text-[var(--text-tertiary)]">Expires</p>
                    <p className="font-medium">
                      <RelativeTime value={grant.expires_at} />
                    </p>
                  </div>
                  <Button
                    disabled={grant.status !== "active"}
                    onClick={() => setSelectedGrant(grant)}
                    size="compact"
                    variant="danger"
                  >
                    Revoke
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          description="Approved agent tasks will appear here with their human subject, actor, resource, constraints, and expiration."
          icon={Stamp}
          title="No Agent Grants"
        />
      )}
      <ConfirmDialog
        actionLabel="Revoke Grant"
        description="The agent will immediately lose this authorization. This action cannot be undone."
        onConfirm={() => (selectedGrant ? revoke(selectedGrant) : undefined)}
        onOpenChange={(open) => {
          if (!open) setSelectedGrant(undefined);
        }}
        open={Boolean(selectedGrant)}
        pendingLabel="Revoking…"
        title={selectedGrant ? `Revoke the ${selectedGrant.agent_name} grant?` : "Revoke grant?"}
      />
    </PageContainer>
  );
}
