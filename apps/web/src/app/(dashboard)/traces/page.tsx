"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  CircleX,
  Clock3,
  ListTree,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { StatusBadge } from "@authometry/ui";
import { RelativeTime } from "@/components/data-display/formatted-time";
import { ErrorState, PageSkeleton } from "@/components/data-display/states";
import { SearchInput, selectClass } from "@/components/data-display/search-input";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { apiFetch } from "@/lib/api";
import { duration } from "@/lib/format";

interface TraceRow {
  id: string;
  request_id: string;
  status: "success" | "denied" | "error" | "warning" | "pending";
  event_type: string;
  application_name: string;
  client_id: string;
  user_snapshot?: { email?: string };
  grant_type: string;
  endpoint: string;
  duration_ms?: number;
  started_at: string;
}

export default function TracesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const parameters = useSearchParams();
  const status = parameters.get("status") ?? "";
  const q = parameters.get("q") ?? "";
  const traces = useQuery({
    queryKey: ["traces", status, q],
    queryFn: () =>
      apiFetch<{ data: TraceRow[] }>(
        `/api/v1/traces?status=${encodeURIComponent(status)}&q=${encodeURIComponent(q)}`,
      ),
  });
  function update(key: string, value: string) {
    const next = new URLSearchParams(parameters);
    if (value) next.set(key, value);
    else next.delete(key);
    const queryString = next.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname);
  }
  if (traces.isLoading)
    return (
      <PageContainer>
        <PageSkeleton rows={8} />
      </PageContainer>
    );
  if (traces.isError)
    return (
      <PageContainer>
        <ErrorState
          description="Authometry could not reach the API. Check the connection and try again."
          onRetry={() => void traces.refetch()}
          title="Unable to Load Authorization Traces"
        />
      </PageContainer>
    );
  const rows = traces.data?.data ?? [];
  const counts = {
    requests: rows.length,
    successful: rows.filter((row) => row.status === "success").length,
    denied: rows.filter((row) => row.status === "denied").length,
    errors: rows.filter((row) => row.status === "error").length,
  };
  const summary: Array<[string, number, LucideIcon, string]> = [
    ["Requests", counts.requests, ListTree, "neutral"],
    ["Successful", counts.successful, CheckCircle2, "success"],
    ["Denied", counts.denied, AlertTriangle, "warning"],
    ["Errors", counts.errors, CircleX, "danger"],
  ];
  return (
    <PageContainer>
      <PageHeader
        description="Inspect each validation and policy decision in OAuth and OpenID Connect requests."
        title="Authorization Traces"
      />
      <section className="mb-5 grid grid-cols-2 divide-x divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] sm:grid-cols-4 sm:divide-y-0">
        {summary.map(([label, value, Icon, tone]) => (
          <div className="flex items-center gap-3 p-3.5" key={label}>
            <Icon
              aria-hidden="true"
              className={`size-4 text-[var(--${tone === "neutral" ? "text-secondary" : tone})]`}
            />
            <div>
              <p className="text-[11px] text-[var(--text-secondary)]">{label}</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
            </div>
          </div>
        ))}
      </section>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <SearchInput
          className="sm:w-80"
          defaultValue={q}
          key={q}
          onChange={(event) => update("q", event.target.value)}
          placeholder="Request ID, user, client, IP address…"
        />
        <select
          aria-label="Trace status"
          className={selectClass}
          name="status"
          onChange={(event) => update("status", event.target.value)}
          value={status}
        >
          <option value="">All statuses</option>
          <option value="success">Success</option>
          <option value="denied">Denied</option>
          <option value="error">Error</option>
          <option value="warning">Warning</option>
          <option value="pending">Pending</option>
        </select>
      </div>
      <div className="border-y border-[var(--border)]">
        <div className="hidden grid-cols-[100px_minmax(160px,1.4fr)_minmax(130px,1fr)_minmax(150px,1fr)_140px_80px_120px] gap-3 border-b border-[var(--border)] px-2 py-2 text-[11px] font-medium text-[var(--text-tertiary)] lg:grid">
          <span>Status</span>
          <span>Event</span>
          <span>Application</span>
          <span>User</span>
          <span>Grant</span>
          <span>Duration</span>
          <span>Time</span>
        </div>
        {rows.length ? (
          rows.map((trace) => (
            <Link
              className="virtualized-row grid min-h-16 grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-[var(--border-subtle)] px-2 py-2.5 last:border-0 hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none focus-visible:ring-inset lg:grid-cols-[100px_minmax(160px,1.4fr)_minmax(130px,1fr)_minmax(150px,1fr)_140px_80px_120px]"
              href={`/traces/${trace.id}`}
              key={trace.id}
            >
              <StatusBadge
                label={trace.status[0]!.toUpperCase() + trace.status.slice(1)}
                tone={
                  trace.status === "success"
                    ? "success"
                    : trace.status === "denied" || trace.status === "warning"
                      ? "warning"
                      : trace.status === "pending"
                        ? "neutral"
                        : "danger"
                }
              />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium">
                  {trace.event_type.replaceAll("_", " ")}
                </p>
                <p className="technical-value truncate text-[var(--text-tertiary)] lg:hidden">
                  {trace.request_id}
                </p>
              </div>
              <span className="text-xs text-[var(--text-tertiary)] lg:hidden">
                <RelativeTime value={trace.started_at} />
              </span>
              <span className="hidden truncate text-xs text-[var(--text-secondary)] lg:block">
                {trace.application_name}
              </span>
              <span className="hidden truncate text-xs text-[var(--text-secondary)] lg:block">
                {trace.user_snapshot?.email ?? "anonymous"}
              </span>
              <span className="hidden truncate text-xs text-[var(--text-secondary)] lg:block">
                {trace.grant_type}
              </span>
              <span className="technical-value hidden lg:block">{duration(trace.duration_ms)}</span>
              <span className="hidden text-xs text-[var(--text-tertiary)] lg:block">
                <RelativeTime value={trace.started_at} />
              </span>
            </Link>
          ))
        ) : (
          <div className="flex min-h-60 flex-col items-center justify-center text-center">
            <Clock3 aria-hidden="true" className="mb-3 size-5 text-[var(--text-tertiary)]" />
            <h2 className="text-sm font-medium text-balance">No Authorization Traces Found</h2>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              No requests match the selected filters.
            </p>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
