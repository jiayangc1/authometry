"use client";

import { useQuery } from "@tanstack/react-query";
import { Braces, Plus, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Button, EmptyState, StatusBadge } from "@authometry/ui";
import { ErrorState, PageSkeleton } from "@/components/data-display/states";
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
          <Button asChild>
            <Link href="/policies/new">
              <Plus aria-hidden="true" className="size-3.5" /> New Policy
            </Link>
          </Button>
        }
        description="Control authorization using explicit, inspectable rules."
        title="Policies"
      />
      {query.isLoading ? (
        <PageSkeleton />
      ) : query.isError ? (
        <ErrorState
          description="Authometry could not load authorization policies. Check your connection, then retry."
          headingLevel="h2"
          onRetry={() => void query.refetch()}
          title="Unable to Load Policies"
        />
      ) : query.data?.data.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {query.data.data.map((policy) => (
            <Link
              className="virtualized-row rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-4 transition-colors hover:border-[var(--border-strong)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none"
              href={`/policies/${policy.id}`}
              key={policy.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold">{policy.display_name}</h2>
                  <p className="technical-value mt-0.5 text-[var(--text-tertiary)]">
                    {policy.name}
                  </p>
                </div>
                <StatusBadge
                  label={policy.enabled ? "Enabled" : "Disabled"}
                  tone={policy.enabled ? "success" : "neutral"}
                />
              </div>
              <p className="mt-3 text-xs leading-5 text-[var(--text-secondary)]">
                {policy.description}
              </p>
              <div className="mt-4 border-t border-[var(--border-subtle)] pt-3">
                {policy.conditions.all?.length ? (
                  policy.conditions.all.slice(0, 2).map((condition, index) => (
                    <p
                      className="technical-value mt-1 text-[var(--text-secondary)]"
                      key={`${condition.field}-${index}`}
                    >
                      {index ? "AND " : "WHEN "}
                      {condition.field} {condition.operator.replaceAll("_", " ")}{" "}
                      {String(condition.value)}
                    </p>
                  ))
                ) : (
                  <p className="text-xs text-[var(--text-tertiary)]">No conditions</p>
                )}
              </div>
              <div className="mt-4 flex items-center gap-2 text-[11px] text-[var(--text-tertiary)]">
                <Braces aria-hidden="true" className="size-3" />
                {policy.ownership === "manifest" ? "Managed by Git" : "Dashboard managed"}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          description="Create a policy to make authorization rules explicit and inspectable."
          icon={ShieldCheck}
          title="No Authorization Policies"
        />
      )}
    </PageContainer>
  );
}
