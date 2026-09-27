"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ListTree, SearchX } from "lucide-react";
import Link from "next/link";
import { Button, EmptyState, Spinner, StatusBadge } from "@authometry/ui";
import { RelativeTime } from "@/components/data-display/formatted-time";
import { ErrorState, ListSkeleton } from "@/components/data-display/states";
import { FilterBar, SearchInput } from "@/components/data-display/search-input";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { SegmentedControl } from "@/components/ui/tabs";
import { Table, TableFooter, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch } from "@/lib/api";
import { duration } from "@/lib/format";
import { humanize, traceLabel, traceTone, type TraceStatus } from "@/lib/status";
import { useDebouncedSearchParam } from "@/lib/use-query-params";

interface TraceRow {
  id: string;
  request_id: string;
  status: TraceStatus;
  event_type: string;
  application_name: string;
  client_id: string;
  user_snapshot?: { email?: string };
  grant_type: string;
  endpoint: string;
  duration_ms?: number;
  started_at: string;
}

const statusOptions = [
  { value: "", label: "All" },
  { value: "success", label: "Authorized" },
  { value: "denied", label: "Denied" },
  { value: "error", label: "Error" },
  { value: "warning", label: "Warning" },
  { value: "pending", label: "Pending" },
] as const;
type StatusFilter = (typeof statusOptions)[number]["value"];

const columns = "120px minmax(180px,1.4fr) minmax(140px,1fr) minmax(160px,1fr) 150px 80px 110px";

export default function TracesPage() {
  const search = useDebouncedSearchParam("q");
  const status = (search.parameters.get("status") ?? "") as StatusFilter;
  const limit = search.parameters.get("limit") === "100" ? 100 : 50;
  const traces = useQuery({
    queryKey: ["traces", status, search.query, limit],
    queryFn: () =>
      apiFetch<{ data: TraceRow[] }>(
        `/api/v1/traces?status=${encodeURIComponent(status)}&q=${encodeURIComponent(search.query)}&limit=${limit}`,
      ),
    placeholderData: keepPreviousData,
  });
  const rows = traces.data?.data ?? [];
  const filtered = Boolean(status || search.query);

  return (
    <PageContainer>
      <PageHeader
        description="Inspect every validation step and policy decision behind OAuth and OpenID Connect requests."
        title="Authorization traces"
      />
      <FilterBar>
        <SearchInput
          className="sm:w-80"
          onChange={(event) => search.setValue(event.target.value)}
          onClear={search.clear}
          placeholder="Search request ID, user, or client…"
          value={search.value}
        />
        <SegmentedControl
          className="sm:ml-auto"
          label="Filter by status"
          onChange={(value) => search.update({ status: value || undefined, limit: undefined })}
          options={statusOptions}
          size="compact"
          value={status}
        />
      </FilterBar>
      {traces.isLoading ? (
        <ListSkeleton rows={8} />
      ) : traces.isError ? (
        <ErrorState
          description="Authometry could not reach the API. Check the connection and try again."
          headingLevel="h2"
          onRetry={() => void traces.refetch()}
          retrying={traces.isRefetching}
          title="Unable to load authorization traces"
        />
      ) : rows.length === 0 ? (
        <EmptyState
          description={
            filtered
              ? "No requests match these filters. Try a different search or status."
              : "Traces appear as soon as an application starts an authorization request. Run one from the playground to see it here."
          }
          icon={filtered ? SearchX : ListTree}
          primaryAction={
            filtered ? (
              <Button
                onClick={() => {
                  search.clear();
                  search.update({ status: undefined, q: undefined });
                }}
              >
                Clear filters
              </Button>
            ) : (
              <Button asChild variant="primary">
                <Link href="/developer/playground">Open playground</Link>
              </Button>
            )
          }
          title={filtered ? "No matching traces" : "No authorization traces yet"}
        />
      ) : (
        <Table
          className={
            traces.isPlaceholderData ? "opacity-60 transition-opacity" : "transition-opacity"
          }
          columns={columns}
          label="Authorization traces"
        >
          <TableHeader>
            <span>Status</span>
            <span>Event</span>
            <span>Application</span>
            <span>User</span>
            <span>Grant</span>
            <span className="text-right">Duration</span>
            <span className="text-right">Time</span>
          </TableHeader>
          <div className="stagger">
            {rows.map((trace) => (
              <TableRow
                href={`/traces/${trace.id}`}
                key={trace.id}
                mobileColumns="minmax(0,1fr) auto"
              >
                <span className="order-2 lg:order-none">
                  <StatusBadge label={traceLabel(trace.status)} tone={traceTone(trace.status)} />
                </span>
                <div className="order-1 min-w-0 lg:order-none">
                  <p className="truncate text-[13px] font-medium">{humanize(trace.event_type)}</p>
                  <p className="technical-value truncate text-[var(--text-tertiary)]">
                    {trace.request_id}
                  </p>
                  <p className="truncate text-xs text-[var(--text-secondary)] lg:hidden">
                    {trace.application_name} · {trace.user_snapshot?.email ?? "anonymous"} ·{" "}
                    <RelativeTime value={trace.started_at} />
                  </p>
                </div>
                <span className="hidden truncate text-[13px] text-[var(--text-secondary)] lg:block">
                  {trace.application_name}
                </span>
                <span className="hidden truncate text-[13px] text-[var(--text-secondary)] lg:block">
                  {trace.user_snapshot?.email ?? "anonymous"}
                </span>
                <span className="technical-value hidden truncate text-[var(--text-secondary)] lg:block">
                  {trace.grant_type}
                </span>
                <span className="technical-value hidden text-right lg:block">
                  {duration(trace.duration_ms)}
                </span>
                <span className="hidden text-right text-[13px] text-[var(--text-secondary)] lg:block">
                  <RelativeTime value={trace.started_at} />
                </span>
              </TableRow>
            ))}
          </div>
          <TableFooter>
            <span className="flex items-center gap-2">
              {traces.isFetching && <Spinner className="size-3" />}
              Showing {rows.length} most recent {rows.length === 1 ? "trace" : "traces"}
            </span>
            {limit === 50 && rows.length === 50 && (
              <Button
                onClick={() => search.update({ limit: "100" })}
                size="compact"
                variant="ghost"
              >
                Show more
              </Button>
            )}
          </TableFooter>
        </Table>
      )}
    </PageContainer>
  );
}
