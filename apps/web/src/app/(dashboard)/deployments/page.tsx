"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  CheckCircle2,
  CircleDashed,
  GitCommitHorizontal,
  GitPullRequestArrow,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { Button, EmptyState, Note, StatusBadge } from "@authometry/ui";
import { RelativeTime } from "@/components/data-display/formatted-time";
import { ErrorState, ListSkeleton } from "@/components/data-display/states";
import { PageContainer, PageHeader, SectionHeader } from "@/components/layout/page";
import { DisclosureRow } from "@/components/ui/disclosure-row";
import { apiFetch } from "@/lib/api";
import { humanize } from "@/lib/status";
import { useQueryParams } from "@/lib/use-query-params";

interface Deployment {
  id: string;
  revision?: string;
  repository?: string;
  actor: string;
  status: string;
  applied_at: string;
  plan: Array<{ key: string; operation: string }>;
}
export default function DeploymentsPage() {
  const [parameters, update] = useQueryParams();
  const expandedDeployment = parameters.get("deployment");
  const status = useQuery({
    queryKey: ["config-status"],
    queryFn: () =>
      apiFetch<{
        environment: string;
        status: string;
        resources: Array<{ key: string; status: string }>;
      }>("/api/v1/config/status"),
  });
  const deployments = useQuery({
    queryKey: ["deployments"],
    queryFn: () => apiFetch<{ data: Deployment[] }>("/api/v1/config/deployments"),
  });
  const state = status.isLoading
    ? "loading"
    : status.isError
      ? "error"
      : (status.data?.status ?? "not_applied");
  const summary = {
    loading: { tone: "neutral", title: "Checking configuration…", icon: CircleDashed },
    error: { tone: "warning", title: "Configuration status is unavailable", icon: TriangleAlert },
    drifted: { tone: "warning", title: "Configuration drift detected", icon: TriangleAlert },
    not_applied: { tone: "neutral", title: "No manifest has been applied yet", icon: CircleDashed },
    in_sync: { tone: "success", title: "In sync with the last apply", icon: CheckCircle2 },
  }[state] ?? { tone: "neutral", title: humanize(state), icon: CircleDashed };
  const drifted = (status.data?.resources ?? []).filter(
    (resource) => resource.status !== "in_sync",
  );
  return (
    <PageContainer>
      <PageHeader
        actions={
          <Button asChild>
            <Link href="/docs/configuration-as-code">
              <BookOpen aria-hidden="true" className="size-3.5" /> CLI guide
            </Link>
          </Button>
        }
        description="Manifest applies from Git, where they came from, and whether the live configuration still matches."
        title="Deployments"
      />
      <Note
        className="mb-8"
        icon={summary.icon}
        role="status"
        tone={summary.tone as "neutral" | "warning" | "success"}
      >
        <p className="font-medium">{summary.title}</p>
        <p className="mt-0.5 text-[var(--text-secondary)]">
          {status.isError
            ? "Check your connection, then reload this page."
            : `${status.data?.environment ?? "—"} · ${status.data?.resources.length ?? 0} managed resources`}
        </p>
        {state === "drifted" && drifted.length > 0 && (
          <ul className="mt-2 space-y-0.5">
            {drifted.slice(0, 6).map((resource) => (
              <li className="technical-value text-[var(--text-primary)]" key={resource.key}>
                ~ {resource.key}{" "}
                <span className="text-[var(--text-tertiary)]">{resource.status}</span>
              </li>
            ))}
          </ul>
        )}
      </Note>
      <SectionHeader
        description="Every atomic apply records its source revision and actor."
        title="History"
      />
      {deployments.isLoading ? (
        <ListSkeleton rows={5} />
      ) : deployments.isError ? (
        <ErrorState
          description="Authometry could not load deployment history. Check your connection, then retry."
          headingLevel="h2"
          onRetry={() => void deployments.refetch()}
          title="Unable to load deployments"
        />
      ) : deployments.data?.data.length ? (
        <div className="stagger overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-raised)]">
          {deployments.data.data.map((deployment) => (
            <DisclosureRow
              key={deployment.id}
              onOpenChange={(open) => update({ deployment: open ? deployment.id : undefined })}
              open={expandedDeployment === deployment.id}
              summary={
                <div className="grid items-center gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,1fr)_140px_120px_100px]">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium">
                      {deployment.repository ?? "Local manifests"}
                    </p>
                    <p className="technical-value flex items-center gap-1.5 text-[var(--text-tertiary)]">
                      <GitCommitHorizontal aria-hidden="true" className="size-3.5" />
                      {deployment.revision?.slice(0, 12) ?? deployment.id.slice(0, 12)} ·{" "}
                      {deployment.plan.length} {deployment.plan.length === 1 ? "change" : "changes"}
                    </p>
                  </div>
                  <span className="truncate text-[13px] text-[var(--text-secondary)]">
                    {deployment.actor}
                  </span>
                  <span className="text-[13px] text-[var(--text-secondary)]">
                    <RelativeTime value={deployment.applied_at} />
                  </span>
                  <span className="sm:text-right">
                    <StatusBadge
                      label={humanize(deployment.status)}
                      tone={deployment.status === "applied" ? "success" : "danger"}
                    />
                  </span>
                </div>
              }
            >
              {deployment.plan.length ? (
                <ul className="space-y-0.5">
                  {deployment.plan.map((entry) => (
                    <li className="technical-value" key={entry.key}>
                      <span
                        className={
                          entry.operation === "create"
                            ? "text-[var(--success)]"
                            : entry.operation === "delete"
                              ? "text-[var(--danger)]"
                              : "text-[var(--warning)]"
                        }
                      >
                        {entry.operation === "create"
                          ? "+"
                          : entry.operation === "delete"
                            ? "−"
                            : "~"}
                      </span>{" "}
                      {entry.key}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-[var(--text-secondary)]">No resource changes.</p>
              )}
            </DisclosureRow>
          ))}
        </div>
      ) : (
        <EmptyState
          description="Apply a manifest with the Authometry CLI to record the first deployment."
          icon={GitPullRequestArrow}
          primaryAction={
            <Button asChild>
              <Link href="/docs/configuration-as-code">Read the CLI guide</Link>
            </Button>
          }
          title="No deployments yet"
        />
      )}
    </PageContainer>
  );
}
