"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, GitPullRequestArrow, TriangleAlert } from "lucide-react";
import { Button, StatusBadge } from "@authometry/ui";
import { PageContainer, PageHeader, SectionHeader } from "@/components/layout/page";
import { apiFetch } from "@/lib/api";
import { relativeTime } from "@/lib/format";

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
            <a href="/docs/configuration-as-code">CLI guide</a>
          </Button>
        }
        description="Review manifest applies, deployment provenance, and configuration drift."
        title="Configuration deployments"
      />
      <section
        className={`mb-8 flex items-start gap-3 rounded-lg border p-4 ${status.data?.status === "drifted" ? "border-[var(--warning-border)] bg-[var(--warning-soft)]" : "border-[var(--success-border)] bg-[var(--success-soft)]"}`}
      >
        {status.data?.status === "drifted" ? (
          <TriangleAlert className="mt-0.5 size-4 text-[var(--warning)]" />
        ) : (
          <CheckCircle2 className="mt-0.5 size-4 text-[var(--success)]" />
        )}
        <div>
          <p className="text-[13px] font-semibold">
            {status.data?.status === "drifted"
              ? "Configuration drift detected"
              : status.data?.status === "not_applied"
                ? "No manifest has been applied"
                : "Configuration matches the last apply"}
          </p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            {status.data?.environment ?? "Production"} · {status.data?.resources.length ?? 0}{" "}
            managed resources
          </p>
        </div>
      </section>
      <SectionHeader
        description="Every atomic apply records its source revision and actor."
        title="Deployment history"
      />
      <div className="border-y border-[var(--border)]">
        {deployments.data?.data.map((deployment) => (
          <details
            className="border-b border-[var(--border-subtle)] last:border-0"
            key={deployment.id}
          >
            <summary className="grid min-h-16 cursor-pointer list-none grid-cols-[28px_1fr_auto] items-center gap-3 px-2 hover:bg-[var(--surface-hover)] sm:grid-cols-[28px_1fr_140px_150px_120px]">
              <GitPullRequestArrow className="size-4 text-[var(--text-secondary)]" />
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
                {relativeTime(deployment.applied_at)}
              </span>
              <StatusBadge
                label={deployment.status}
                tone={deployment.status === "applied" ? "success" : "danger"}
              />
            </summary>
            <div className="border-t border-[var(--border-subtle)] bg-[var(--surface)] px-10 py-3">
              {deployment.plan.map((entry) => (
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
                    {entry.operation === "create" ? "+" : entry.operation === "delete" ? "-" : "~"}
                  </span>{" "}
                  {entry.key}
                </p>
              ))}
            </div>
          </details>
        ))}
      </div>
    </PageContainer>
  );
}
