"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  AppWindow,
  BookOpen,
  MonitorSmartphone,
  Plus,
  SearchX,
  Server,
  Smartphone,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import type { ComponentType } from "react";
import { Button, EmptyState, StatusBadge, cn } from "@authometry/ui";
import { RelativeTime } from "@/components/data-display/formatted-time";
import { ErrorState, ListSkeleton } from "@/components/data-display/states";
import { FilterBar, SearchInput } from "@/components/data-display/search-input";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { Select } from "@/components/ui/form";
import { Table, TableFooter, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch } from "@/lib/api";
import { useDebouncedSearchParam } from "@/lib/use-query-params";

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

const columns = "minmax(220px,1.4fr) minmax(180px,1fr) 150px 120px";

export default function ApplicationsPage() {
  const search = useDebouncedSearchParam("q");
  const type = search.parameters.get("type") ?? "";
  const status = search.parameters.get("status") ?? "";
  const applications = useQuery({
    queryKey: ["applications", search.query, type, status],
    queryFn: () =>
      apiFetch<{ data: ApplicationRow[] }>(
        `/api/v1/applications?q=${encodeURIComponent(search.query)}&type=${encodeURIComponent(type)}&status=${encodeURIComponent(status)}`,
      ),
    placeholderData: keepPreviousData,
  });
  const rows = applications.data?.data ?? [];
  const filtered = Boolean(search.query || type || status);
  function clearFilters() {
    search.clear();
    search.update({ q: undefined, type: undefined, status: undefined });
  }
  return (
    <PageContainer>
      <PageHeader
        actions={
          <>
            <Button asChild>
              <Link href="/docs/applications">
                <BookOpen aria-hidden="true" className="size-3.5" /> Docs
              </Link>
            </Button>
            <Button asChild variant="primary">
              <Link href="/applications/new">
                <Plus aria-hidden="true" className="size-3.5" /> Create application
              </Link>
            </Button>
          </>
        }
        description="Websites, mobile apps, APIs, and services that use Authometry to sign people in."
        title="Applications"
      />
      <FilterBar>
        <SearchInput
          className="sm:w-72"
          onChange={(event) => search.setValue(event.target.value)}
          onClear={search.clear}
          placeholder="Search by name or ID…"
          value={search.value}
        />
        <Select
          aria-label="Application type"
          compact
          name="type"
          onChange={(event) => search.update({ type: event.target.value || undefined })}
          value={type}
          wrapperClassName="sm:w-52"
        >
          <option value="">All types</option>
          {Object.entries(typeLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Status"
          compact
          name="status"
          onChange={(event) => search.update({ status: event.target.value || undefined })}
          value={status}
          wrapperClassName="sm:w-40"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </Select>
        {filtered && (
          <Button className="sm:ml-auto" onClick={clearFilters} size="compact" variant="ghost">
            Clear filters
          </Button>
        )}
      </FilterBar>
      {applications.isLoading ? (
        <ListSkeleton rows={6} />
      ) : applications.isError ? (
        <ErrorState
          description="Authometry could not reach the API. Check the connection and try again."
          headingLevel="h2"
          onRetry={() => void applications.refetch()}
          retrying={applications.isRefetching}
          title="Unable to load applications"
        />
      ) : rows.length ? (
        <Table
          className={cn("transition-opacity", applications.isPlaceholderData && "opacity-60")}
          columns={columns}
          label="Applications"
        >
          <TableHeader>
            <span>Name</span>
            <span>Type</span>
            <span>Status</span>
            <span className="text-right">Last used</span>
          </TableHeader>
          <div className="stagger">
            {rows.map((application) => {
              const Icon = typeIcons[application.type];
              return (
                <TableRow
                  href={`/applications/${application.id}`}
                  key={application.id}
                  mobileColumns="minmax(0,1fr) auto"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface-subtle)] transition-transform duration-[var(--motion-normal)] ease-[var(--ease-spring)] group-hover:scale-105">
                      <Icon aria-hidden="true" className="size-4 text-[var(--text-secondary)]" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium">{application.name}</p>
                      <p className="technical-value truncate text-[var(--text-tertiary)]">
                        {application.slug}
                      </p>
                    </div>
                  </div>
                  <div className="hidden min-w-0 lg:block">
                    <p className="truncate text-[13px] text-[var(--text-secondary)]">
                      {typeLabels[application.type]}
                    </p>
                    <p className="technical-value truncate text-[var(--text-tertiary)]">
                      {application.redirect_uris[0] ?? "No callback URL"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-1.5 lg:justify-start">
                    <StatusBadge
                      label={application.status === "active" ? "Active" : "Disabled"}
                      tone={application.status === "active" ? "success" : "neutral"}
                    />
                    {application.ownership === "manifest" && (
                      <span className="hidden text-[11px] text-[var(--text-tertiary)] lg:inline">
                        Git
                      </span>
                    )}
                  </div>
                  <p className="hidden text-right text-[13px] text-[var(--text-secondary)] lg:block">
                    {application.last_used_at ? (
                      <RelativeTime value={application.last_used_at} />
                    ) : (
                      "Never"
                    )}
                  </p>
                </TableRow>
              );
            })}
          </div>
          <TableFooter>
            <span>
              {rows.length} {rows.length === 1 ? "application" : "applications"}
            </span>
          </TableFooter>
        </Table>
      ) : (
        <EmptyState
          description={
            filtered
              ? "No applications match these filters."
              : "Applications represent websites, mobile apps, APIs, and services that use Authometry for authorization."
          }
          icon={filtered ? SearchX : AppWindow}
          primaryAction={
            filtered ? (
              <Button onClick={clearFilters}>Clear filters</Button>
            ) : (
              <Button asChild variant="primary">
                <Link href="/applications/new">Create application</Link>
              </Button>
            )
          }
          secondaryAction={
            filtered ? undefined : (
              <Button asChild>
                <Link href="/docs/applications">Read the guide</Link>
              </Button>
            )
          }
          title={filtered ? "No matching applications" : "Create your first application"}
        />
      )}
    </PageContainer>
  );
}
