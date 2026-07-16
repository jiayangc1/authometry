"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Bot, Stamp, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button, EmptyState, StatusBadge } from "@authometry/ui";
import { ErrorState, PageSkeleton } from "@/components/data-display/states";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { apiFetch } from "@/lib/api";
import { relativeTime } from "@/lib/format";

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
  const grants = useQuery({
    queryKey: ["agent-grants"],
    queryFn: () => apiFetch<{ data: GrantRow[] }>("/api/v1/agent-grants"),
  });

  async function revoke(grant: GrantRow) {
    await apiFetch(`/api/v1/agent-grants/${grant.id}/revoke`, {
      method: "POST",
      body: JSON.stringify({ reason: "dashboard_revocation" }),
    });
    await queryClient.invalidateQueries({ queryKey: ["agent-grants"] });
    toast.success(`${grant.agent_name} grant revoked.`);
  }

  return (
    <PageContainer>
      <PageHeader
        description="Every row is a task authorization—not a login session. Subject, actor, resource, purpose, limits, and lifetime remain independently visible."
        title="Agent grants"
      />
      {grants.isLoading ? (
        <PageSkeleton rows={7} />
      ) : grants.isError ? (
        <ErrorState
          description="Authometry could not load agent authorization grants."
          onRetry={() => void grants.refetch()}
          title="Unable to load grants"
        />
      ) : grants.data?.data.length ? (
        <div className="border-y border-[var(--border)]">
          {grants.data.data.map((grant) => (
            <article
              className="border-b border-[var(--border-subtle)] px-2 py-5 last:border-0"
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
                      <UserRound className="size-3.5" /> {grant.subject_name}
                    </span>
                    <ArrowRight className="size-3 text-[var(--text-tertiary)]" />
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <Bot className="size-3.5" /> {grant.agent_name}
                    </span>
                    <ArrowRight className="size-3 text-[var(--text-tertiary)]" />
                    <span className="technical-value max-w-full truncate">{grant.resource}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {grant.scopes.map((scope) => (
                      <span
                        className="technical-value rounded border border-[var(--border)] bg-[var(--surface-subtle)] px-1.5 py-0.5"
                        key={scope}
                      >
                        {scope}
                      </span>
                    ))}
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
                    <p className="font-medium">{relativeTime(grant.expires_at)}</p>
                  </div>
                  <Button
                    disabled={grant.status !== "active"}
                    onClick={() => void revoke(grant)}
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
          title="No agent grants"
        />
      )}
    </PageContainer>
  );
}
