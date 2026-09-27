"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Bot, Stamp, UserRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button, EmptyState, StatusBadge, cn } from "@authometry/ui";
import { RelativeTime } from "@/components/data-display/formatted-time";
import { FilterBar } from "@/components/data-display/search-input";
import { ErrorState, ListSkeleton } from "@/components/data-display/states";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { ConfirmDialog } from "@/components/overlays/confirm-dialog";
import { SegmentedControl } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api";
import { humanize } from "@/lib/status";

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
  const [status, setStatus] = useState<GrantRow["status"] | "all">("active");
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

  const all = grants.data?.data ?? [];
  const rows = all.filter((grant) => status === "all" || grant.status === status);
  const counts = {
    active: all.filter((grant) => grant.status === "active").length,
  };
  return (
    <PageContainer>
      <PageHeader
        description="Each grant is a task authorization, not a login session: who approved it, which agent acts, on what, why, and for how long."
        title="Agent grants"
      />
      <FilterBar>
        <SegmentedControl
          label="Grant status"
          onChange={setStatus}
          options={[
            { value: "active", label: `Active (${counts.active})` },
            { value: "completed", label: "Completed" },
            { value: "revoked", label: "Revoked" },
            { value: "expired", label: "Expired" },
            { value: "all", label: "All" },
          ]}
          size="compact"
          value={status}
        />
      </FilterBar>
      {grants.isLoading ? (
        <ListSkeleton rows={5} />
      ) : grants.isError ? (
        <ErrorState
          description="Authometry could not load agent grants. Check your connection, then retry."
          headingLevel="h2"
          onRetry={() => void grants.refetch()}
          title="Unable to load grants"
        />
      ) : rows.length ? (
        <div className="stagger overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-raised)]">
          {rows.map((grant) => {
            const usage = grant.maximum_usage
              ? Math.min(grant.usage_count / grant.maximum_usage, 1)
              : 0;
            return (
              <article
                className="virtualized-row border-b border-[var(--border)] px-4 py-4 last:border-0"
                key={grant.id}
              >
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">{grant.purpose}</p>
                      <StatusBadge
                        label={humanize(grant.status)}
                        tone={
                          grant.status === "active"
                            ? "success"
                            : grant.status === "revoked"
                              ? "danger"
                              : "neutral"
                        }
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[13px]">
                      <span className="inline-flex items-center gap-1.5 text-[var(--text-secondary)]">
                        <UserRound aria-hidden="true" className="size-3.5" /> {grant.subject_name}
                      </span>
                      <ArrowRight
                        aria-hidden="true"
                        className="size-3 text-[var(--text-tertiary)]"
                      />
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <Bot aria-hidden="true" className="size-3.5" /> {grant.agent_name}
                      </span>
                      <ArrowRight
                        aria-hidden="true"
                        className="size-3 text-[var(--text-tertiary)]"
                      />
                      <span className="technical-value max-w-full truncate">{grant.resource}</span>
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-1">
                      {grant.scopes.length ? (
                        grant.scopes.map((scope) => (
                          <span
                            className="technical-value rounded-[4px] bg-[var(--geist-gray-100)] px-1.5 py-0.5 text-[11px]"
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
                  <div className="flex shrink-0 items-center gap-5 text-xs">
                    <div className="w-28">
                      <p className="text-[var(--text-secondary)]">Usage</p>
                      <p className="mt-0.5 font-medium tabular-nums">
                        {grant.usage_count} / {grant.maximum_usage ?? "∞"}
                      </p>
                      {grant.maximum_usage ? (
                        <span className="mt-1 block h-1 overflow-hidden rounded-full bg-[var(--geist-gray-100)]">
                          <span
                            className={cn(
                              "block h-full rounded-full transition-[width] duration-[var(--motion-slow)]",
                              usage >= 0.9
                                ? "bg-[var(--warning-solid)]"
                                : "bg-[var(--text-primary)]",
                            )}
                            style={{ width: `${usage * 100}%` }}
                          />
                        </span>
                      ) : null}
                    </div>
                    <div className="min-w-24">
                      <p className="text-[var(--text-secondary)]">
                        {grant.status === "active" ? "Expires" : "Expired"}
                      </p>
                      <p className="mt-0.5 font-medium">
                        <RelativeTime value={grant.expires_at} />
                      </p>
                    </div>
                    {grant.status === "active" && (
                      <Button
                        className="hover:text-[var(--danger)]"
                        onClick={() => setSelectedGrant(grant)}
                        size="compact"
                        variant="ghost"
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          description={
            all.length
              ? "No grants have this status."
              : "Approved agent tasks appear here with their subject, agent, resource, limits, and expiry."
          }
          icon={Stamp}
          primaryAction={
            all.length && status !== "all" ? (
              <Button onClick={() => setStatus("all")}>Show all grants</Button>
            ) : undefined
          }
          title={all.length ? `No ${status} grants` : "No agent grants"}
        />
      )}
      <ConfirmDialog
        actionLabel="Revoke grant"
        description="The agent immediately loses this authorization. This cannot be undone."
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
