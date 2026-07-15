"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AppWindow,
  ArrowRight,
  BookOpen,
  Boxes,
  MonitorSmartphone,
  Plus,
  Server,
  Smartphone,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDeferredValue, type ComponentType } from "react";
import { Button, EmptyState, StatusBadge } from "@authometry/ui";
import { ErrorState, PageSkeleton } from "@/components/data-display/states";
import { SearchInput, selectClass } from "@/components/data-display/search-input";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { apiFetch } from "@/lib/api";
import { relativeTime } from "@/lib/format";

interface ApplicationRow {
  id: string;
  name: string;
  slug: string;
  client_id: string;
  type: "web" | "spa" | "native" | "machine" | "device";
  status: "active" | "disabled";
  redirect_uris: string[];
  last_used_at?: string;
  ownership: "dashboard" | "manifest";
}

const typeLabels: Record<ApplicationRow["type"], string> = {
  web: "Web application",
  spa: "Single-page application",
  native: "Native application",
  machine: "Machine-to-machine",
  device: "Device application",
};
const typeIcons: Record<ApplicationRow["type"], ComponentType<{ className?: string }>> = {
  web: AppWindow,
  spa: MonitorSmartphone,
  native: Smartphone,
  machine: Server,
  device: Workflow,
};

export default function ApplicationsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const parameters = useSearchParams();
  const query = useDeferredValue(parameters.get("q") ?? "");
  const type = parameters.get("type") ?? "";
  const status = parameters.get("status") ?? "";
  const applications = useQuery({
    queryKey: ["applications", query, type, status],
    queryFn: () =>
      apiFetch<{ data: ApplicationRow[] }>(
        `/api/v1/applications?q=${encodeURIComponent(query)}&type=${encodeURIComponent(type)}&status=${encodeURIComponent(status)}`,
      ),
  });
  function update(key: string, value: string) {
    const next = new URLSearchParams(parameters);
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`);
  }
  return (
    <PageContainer>
      <PageHeader
        actions={
          <>
            <Button asChild>
              <a href="/docs/applications">
                <BookOpen className="size-3.5" /> Documentation
              </a>
            </Button>
            <Button asChild variant="primary">
              <Link href="/applications/new">
                <Plus className="size-3.5" /> Add application
              </Link>
            </Button>
          </>
        }
        description="Applications connect websites, mobile apps, APIs, and services to your Authometry authorization server."
        title="Applications"
      />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <SearchInput
          className="sm:w-72"
          defaultValue={query}
          key={query}
          onChange={(event) => update("q", event.target.value)}
          placeholder="Search applications"
        />
        <select
          aria-label="Application type"
          className={selectClass}
          onChange={(event) => update("type", event.target.value)}
          value={type}
        >
          <option value="">All types</option>
          {Object.entries(typeLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Status"
          className={selectClass}
          onChange={(event) => update("status", event.target.value)}
          value={status}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>
      {applications.isLoading ? (
        <PageSkeleton rows={6} />
      ) : applications.isError ? (
        <ErrorState
          title="Unable to load applications"
          description="Authometry could not reach the API. Check the connection and try again."
          onRetry={() => void applications.refetch()}
        />
      ) : applications.data?.data.length ? (
        <div className="border-y border-[var(--border)]">
          {applications.data.data.map((application) => {
            const Icon = typeIcons[application.type];
            return (
              <Link
                className="group grid min-h-[76px] grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3 border-b border-[var(--border-subtle)] px-2 py-3 transition-colors last:border-0 hover:bg-[var(--surface-hover)] sm:grid-cols-[36px_minmax(180px,1fr)_minmax(180px,1fr)_150px_130px_20px]"
                href={`/applications/${application.id}`}
                key={application.id}
              >
                <span className="flex size-9 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-raised)]">
                  <Icon className="size-4 text-[var(--text-secondary)]" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium">{application.name}</p>
                  <p className="technical-value truncate text-[var(--text-tertiary)]">
                    {application.slug}
                  </p>
                </div>
                <div className="hidden min-w-0 sm:block">
                  <p className="text-xs text-[var(--text-secondary)]">
                    {typeLabels[application.type]}
                  </p>
                  <p className="technical-value mt-0.5 truncate text-[var(--text-tertiary)]">
                    {application.redirect_uris[0] ?? "No redirect URI"}
                  </p>
                </div>
                <div className="hidden sm:block">
                  <StatusBadge
                    label={application.status === "active" ? "Active" : "Disabled"}
                    tone={application.status === "active" ? "success" : "neutral"}
                  />
                  {application.ownership === "manifest" && (
                    <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">Managed by Git</p>
                  )}
                </div>
                <p className="hidden text-xs text-[var(--text-tertiary)] sm:block">
                  {application.last_used_at ? relativeTime(application.last_used_at) : "Never used"}
                </p>
                <ArrowRight className="size-3.5 text-[var(--text-tertiary)] opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState
          description={
            query
              ? `No applications match “${query}.”`
              : "Applications represent websites, mobile apps, APIs, and services that use Authometry for authorization."
          }
          icon={query ? Boxes : AppWindow}
          primaryAction={
            <Button asChild variant="primary">
              <Link href="/applications/new">Add application</Link>
            </Button>
          }
          secondaryAction={
            query ? (
              <Button onClick={() => update("q", "")}>Clear filters</Button>
            ) : (
              <Button asChild>
                <a href="/docs/applications">Read the application guide</a>
              </Button>
            )
          }
          title={query ? "No search results" : "Create your first application"}
        />
      )}
    </PageContainer>
  );
}
