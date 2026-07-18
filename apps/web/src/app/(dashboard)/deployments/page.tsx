"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, CircleDashed, GitPullRequestArrow, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button, StatusBadge } from "@authometry/ui";
import { RelativeTime } from "@/components/data-display/formatted-time";
import { ErrorState, PageSkeleton } from "@/components/data-display/states";
import { PageContainer, PageHeader, SectionHeader } from "@/components/layout/page";
import { apiFetch } from "@/lib/api";

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
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const expandedDeployment = searchParams.get("deployment");
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
  return (
    <PageContainer>
      <PageHeader
        actions={
          <Button asChild>
            <Link href="/docs/configuration-as-code">CLI Guide</Link>
          </Button>
        }
        description="Review manifest applies, deployment provenance, and configuration drift."
        title="Configuration Deployments"
      />
      <section
        aria-live="polite"
        className={`mb-8 flex items-start gap-3 rounded-lg border p-4 ${status.isLoading || status.isError || status.data?.status === "not_applied" ? "border-[var(--border)] bg-[var(--surface-subtle)]" : status.data?.status === "drifted" ? "border-[var(--warning-border)] bg-[var(--warning-soft)]" : "border-[var(--success-border)] bg-[var(--success-soft)]"}`}
      >
        {status.isLoading ? null : status.isError || status.data?.status === "drifted" ? (
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 text-[var(--warning)]" />
        ) : status.data?.status === "applied" ? (
          <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 text-[var(--success)]" />
        ) : (
          <CircleDashed aria-hidden="true" className="mt-0.5 size-4 text-[var(--text-secondary)]" />
        )}
        <div>
          <p className="text-[13px] font-semibold">
            {status.isLoading
              ? "Loading configuration status…"
              : status.isError
                ? "Configuration status is unavailable"
                : status.data?.status === "drifted"
                  ? "Configuration drift detected"
                  : status.data?.status === "not_applied"
                    ? "No manifest has been applied"
                    : "Configuration matches the last apply"}
          </p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            {status.isError
              ? "Check your connection, then reload this page."
              : `${status.data?.environment ?? "Production"} · ${status.data?.resources.length ?? 0} managed resources`}
          </p>
        </div>
      </section>
      <SectionHeader
        description="Every atomic apply records its source revision and actor."
        title="Deployment History"
      />
      {deployments.isLoading ? (
        <PageSkeleton rows={6} />
      ) : deployments.isError ? (
        <ErrorState
          description="Authometry could not load deployment history. Check your connection, then retry."
          headingLevel="h2"
          onRetry={() => void deployments.refetch()}
          title="Unable to Load Deployments"
        />
      ) : deployments.data?.data.length ? (
        <div className="border-y border-[var(--border)]">
          {deployments.data.data.map((deployment) => (
            <details
              className="virtualized-row border-b border-[var(--border-subtle)] last:border-0"
              key={deployment.id}
              onToggle={(event) => {
                const next = new URLSearchParams(searchParams);
                if (event.currentTarget.open) next.set("deployment", deployment.id);
                else if (next.get("deployment") === deployment.id) next.delete("deployment");
                router.replace(`${pathname}?${next}`);
              }}
              open={expandedDeployment === deployment.id}
            >
              <summary className="grid min-h-16 cursor-pointer list-none grid-cols-[28px_1fr_auto] items-center gap-3 px-2 hover:bg-[var(--surface-hover)] sm:grid-cols-[28px_1fr_140px_150px_120px]">
                <GitPullRequestArrow
                  aria-hidden="true"
                  className="size-4 text-[var(--text-secondary)]"
                />
                <div>
                  <p className="text-[13px] font-medium">
                    {deployment.repository ?? "Local manifests"}
                  </p>
                  <p className="technical-value text-[var(--text-tertiary)]">
                    {deployment.revision?.slice(0, 12) ?? deployment.id.slice(0, 12)}
                  </p>
                </div>
                <span className="hidden text-xs text-[var(--text-secondary)] sm:block">
                  {deployment.actor}
                </span>
                <span className="hidden text-xs text-[var(--text-tertiary)] sm:block">
                  <RelativeTime value={deployment.applied_at} />
                </span>
                <StatusBadge
                  label={deployment.status}
                  tone={deployment.status === "applied" ? "success" : "danger"}
                />
              </summary>
              <div className="border-t border-[var(--border-subtle)] bg-[var(--surface)] px-10 py-3">
                {deployment.plan.length ? (
                  deployment.plan.map((entry) => (
                    <p className="technical-value py-1" key={entry.key}>
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
                            ? "-"
                            : "~"}
                      </span>{" "}
                      {entry.key}
                    </p>
                  ))
                ) : (
                  <p className="text-xs text-[var(--text-secondary)]">No resource changes.</p>
                )}
              </div>
            </details>
          ))}
        </div>
      ) : (
        <div className="border-y border-[var(--border)] py-12 text-center">
          <h2 className="text-sm font-semibold text-balance">No Deployments</h2>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Apply a manifest with the CLI to create the first deployment record.
          </p>
        </div>
      )}
    </PageContainer>
  );
}
