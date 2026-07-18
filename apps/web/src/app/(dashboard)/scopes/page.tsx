"use client";

import { useQuery } from "@tanstack/react-query";
import { KeyRound, Plus } from "lucide-react";
import Link from "next/link";
import { Button, EmptyState, StatusBadge } from "@authometry/ui";
import { ErrorState, PageSkeleton } from "@/components/data-display/states";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { apiFetch } from "@/lib/api";

interface Scope {
  id: string;
  name: string;
  display_name: string;
  description: string;
  sensitivity: string;
  is_system: boolean;
  application_count: number;
  ownership: string;
}
export default function ScopesPage() {
  const query = useQuery({
    queryKey: ["scopes"],
    queryFn: () => apiFetch<{ data: Scope[] }>("/api/v1/scopes"),
  });
  return (
    <PageContainer>
      <PageHeader
        actions={
          <Button asChild>
            <Link href="/scopes/new">
              <Plus aria-hidden="true" className="size-3.5" /> New Scope
            </Link>
          </Button>
        }
        description="Define the permissions applications can request."
        title="Scopes"
      />
      {query.isLoading ? (
        <PageSkeleton />
      ) : query.isError ? (
        <ErrorState
          description="Authometry could not load scopes. Check your connection, then retry."
          headingLevel="h2"
          onRetry={() => void query.refetch()}
          title="Unable to Load Scopes"
        />
      ) : query.data?.data.length ? (
        <div className="border-y border-[var(--border)]">
          {query.data.data.map((scope) => (
            <div
              className="virtualized-row grid min-h-16 grid-cols-[1fr_auto] items-center gap-3 border-b border-[var(--border-subtle)] px-2 py-2.5 last:border-0 sm:grid-cols-[minmax(160px,.8fr)_minmax(220px,1.3fr)_110px_110px_120px]"
              key={scope.id}
            >
              <div className="flex items-center gap-2">
                <code className="technical-value font-medium">{scope.name}</code>
                {scope.is_system && <StatusBadge label="System" tone="info" />}
              </div>
              <span className="text-xs text-[var(--text-tertiary)] sm:hidden">
                {scope.application_count} apps
              </span>
              <p className="hidden text-xs text-[var(--text-secondary)] sm:block">
                {scope.description}
              </p>
              <span className="hidden text-xs text-[var(--text-secondary)] capitalize sm:block">
                {scope.sensitivity}
              </span>
              <span className="hidden text-xs text-[var(--text-secondary)] sm:block">
                {scope.application_count} applications
              </span>
              <span className="hidden text-xs text-[var(--text-tertiary)] sm:block">
                {scope.ownership === "manifest" ? "Managed by Git" : "Dashboard"}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          description="Create a custom scope when your API requires permissions beyond the standard OpenID Connect scopes."
          icon={KeyRound}
          title="No Custom Scopes"
        />
      )}
    </PageContainer>
  );
}
