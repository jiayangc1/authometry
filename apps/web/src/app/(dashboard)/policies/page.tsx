"use client";

import { useQuery } from "@tanstack/react-query";
import { AppWindow, ArrowRight, GitBranch, Plus, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Button, EmptyState, StatusBadge } from "@authometry/ui";
import { ErrorState, Skeleton } from "@/components/data-display/states";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { apiFetch } from "@/lib/api";

interface Policy {
  id: string;
  name: string;
  display_name: string;
  description: string;
  enabled: boolean;
  conditions: { all?: Array<{ field: string; operator: string; value: unknown }> };
  application_ids: string[];
  ownership: string;
}
export default function PoliciesPage() {
  const query = useQuery({
    queryKey: ["policies"],
    queryFn: () => apiFetch<{ data: Policy[] }>("/api/v1/policies"),
  });
  return (
    <PageContainer>
      <PageHeader
        actions={
          <Button asChild variant="primary">
            <Link href="/policies/new">
              <Plus aria-hidden="true" className="size-3.5" /> Create policy
            </Link>
          </Button>
        }
        description="Explicit, inspectable rules evaluated before Authometry issues an authorization code."
        title="Policies"
      />
      {query.isLoading ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              className="h-44 rounded-[var(--radius-card)] border border-[var(--border)] p-4"
              key={index}
            >
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-2 h-3 w-24" />
              <Skeleton className="mt-6 h-3 w-full" />
              <Skeleton className="mt-2 h-3 w-2/3" />
            </div>
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState
          description="Authometry could not load authorization policies. Check your connection, then retry."
          headingLevel="h2"
          onRetry={() => void query.refetch()}
          title="Unable to load policies"
        />
      ) : query.data?.data.length ? (
        <div className="stagger grid gap-3 lg:grid-cols-2">
          {query.data.data.map((policy) => {
            const conditions = policy.conditions.all ?? [];
            return (
              <Link
                className="lift group flex flex-col rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-raised)] p-4 focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:outline-none"
                href={`/policies/${policy.id}`}
                key={policy.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold">{policy.display_name}</h2>
                    <p className="technical-value truncate text-[var(--text-tertiary)]">
                      {policy.name}
                    </p>
                  </div>
                  <StatusBadge
                    label={policy.enabled ? "Enforced" : "Disabled"}
                    tone={policy.enabled ? "success" : "neutral"}
                  />
                </div>
                {policy.description && (
                  <p className="mt-2 line-clamp-2 text-[13px] text-[var(--text-secondary)]">
                    {policy.description}
                  </p>
                )}
                <div className="mt-3 flex-1 space-y-1 rounded-[var(--radius-control)] bg-[var(--surface-subtle)] p-2.5">
                  {conditions.slice(0, 3).map((condition, index) => (
                    <p
                      className="technical-value truncate text-[var(--text-secondary)]"
                      key={`${condition.field}-${index}`}
                    >
                      <span className="text-[var(--text-tertiary)]">
                        {index ? "AND " : "WHEN "}
                      </span>
                      {condition.field} {condition.operator.replaceAll("_", " ")}{" "}
                      <span className="text-[var(--text-primary)]">
                        {Array.isArray(condition.value)
                          ? condition.value.join(", ")
                          : String(condition.value)}
                      </span>
                    </p>
                  ))}
                  {conditions.length > 3 && (
                    <p className="technical-value text-[var(--text-tertiary)]">
                      +{conditions.length - 3} more
                    </p>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-3 text-xs text-[var(--text-tertiary)]">
                  <span className="flex items-center gap-1.5">
                    <AppWindow aria-hidden="true" className="size-3.5" />
                    {policy.application_ids.length
                      ? `${policy.application_ids.length} ${policy.application_ids.length === 1 ? "app" : "apps"}`
                      : "All apps"}
                  </span>
                  {policy.ownership === "manifest" && (
                    <span className="flex items-center gap-1.5">
                      <GitBranch aria-hidden="true" className="size-3.5" /> Git
                    </span>
                  )}
                  <ArrowRight
                    aria-hidden="true"
                    className="ml-auto size-3.5 -translate-x-1 opacity-0 transition-[opacity,transform] duration-[var(--motion-normal)] ease-[var(--ease-spring)] group-hover:translate-x-0 group-hover:opacity-100"
                  />
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState
          description="Create a policy to require group membership, restrict environments, or limit who can reach an application."
          icon={ShieldCheck}
          primaryAction={
            <Button asChild variant="primary">
              <Link href="/policies/new">Create policy</Link>
            </Button>
          }
          title="No policies yet"
        />
      )}
    </PageContainer>
  );
}
