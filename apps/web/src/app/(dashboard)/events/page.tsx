"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, GitCommitHorizontal } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { EmptyState, StatusBadge } from "@authometry/ui";
import { RelativeTime } from "@/components/data-display/formatted-time";
import { ErrorState, PageSkeleton } from "@/components/data-display/states";
import { selectClass } from "@/components/data-display/search-input";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { apiFetch } from "@/lib/api";

interface EventRow {
  id: string;
  category: string;
  severity: string;
  event_type: string;
  summary: string;
  actor_name?: string;
  resource_type?: string;
  changes?: Array<{ path: string; before?: unknown; after?: unknown }>;
  created_at: string;
}
export default function EventsPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const category = searchParams.get("category") ?? "all";
  const severity = searchParams.get("severity") ?? "all";
  const expandedEvent = searchParams.get("event");
  const query = useQuery({
    queryKey: ["events"],
    queryFn: () => apiFetch<{ data: EventRow[] }>("/api/v1/events"),
  });
  const events = (query.data?.data ?? []).filter(
    (event) =>
      (category === "all" || event.category === category) &&
      (severity === "all" || event.severity === severity),
  );
  const categories = [...new Set((query.data?.data ?? []).map((event) => event.category))];
  const severities = [...new Set((query.data?.data ?? []).map((event) => event.severity))];
  function updateParam(name: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value === "all") next.delete(name);
    else next.set(name, value);
    const queryString = next.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname);
  }
  return (
    <PageContainer>
      <PageHeader
        description="Review configuration, security, and system activity."
        title="Events"
      />
      <div className="mb-4 flex gap-2">
        <label>
          <span className="sr-only">Event category</span>
          <select
            className={selectClass}
            name="category"
            onChange={(event) => updateParam("category", event.target.value)}
            value={category}
          >
            <option value="all">All categories</option>
            {categories.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Event severity</span>
          <select
            className={selectClass}
            name="severity"
            onChange={(event) => updateParam("severity", event.target.value)}
            value={severity}
          >
            <option value="all">All severities</option>
            {severities.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>
      {query.isLoading ? (
        <PageSkeleton />
      ) : query.isError ? (
        <ErrorState
          description="Authometry could not load events. Check your connection, then retry."
          headingLevel="h2"
          onRetry={() => void query.refetch()}
          title="Unable to Load Events"
        />
      ) : events.length ? (
        <div className="border-y border-[var(--border)]">
          {events.map((event) => (
            <details
              className="virtualized-row group border-b border-[var(--border-subtle)] last:border-0"
              key={event.id}
              onToggle={(toggleEvent) => {
                const next = new URLSearchParams(searchParams);
                if (toggleEvent.currentTarget.open) next.set("event", event.id);
                else if (next.get("event") === event.id) next.delete("event");
                const queryString = next.toString();
                router.replace(queryString ? `${pathname}?${queryString}` : pathname);
              }}
              open={expandedEvent === event.id}
            >
              <summary className="grid min-h-14 cursor-pointer list-none grid-cols-[24px_1fr_auto] items-center gap-3 px-2 py-2.5 hover:bg-[var(--surface-hover)] sm:grid-cols-[24px_minmax(200px,1fr)_140px_110px_140px]">
                <Activity aria-hidden="true" className="size-4 text-[var(--text-secondary)]" />
                <div>
                  <p className="text-[13px] font-medium">{event.summary}</p>
                  <p className="technical-value text-[var(--text-tertiary)]">{event.event_type}</p>
                </div>
                <span className="hidden text-xs text-[var(--text-secondary)] capitalize sm:block">
                  {event.actor_name ?? "System"}
                </span>
                <StatusBadge
                  label={event.category}
                  tone={
                    event.severity === "high"
                      ? "danger"
                      : event.severity === "warning"
                        ? "warning"
                        : "neutral"
                  }
                />
                <span className="hidden text-xs text-[var(--text-tertiary)] sm:block">
                  <RelativeTime value={event.created_at} />
                </span>
              </summary>
              {event.changes?.length ? (
                <div className="border-t border-[var(--border-subtle)] bg-[var(--surface)] px-10 py-4">
                  <p className="mb-2 flex items-center gap-2 text-xs font-semibold">
                    <GitCommitHorizontal aria-hidden="true" className="size-3.5" />
                    Changes
                  </p>
                  {event.changes.map((change) => (
                    <div
                      className="technical-value grid grid-cols-[140px_1fr] gap-3 py-1"
                      key={change.path}
                    >
                      <span>{change.path}</span>
                      <span>
                        <span className="text-[var(--danger)]">
                          - {JSON.stringify(change.before)}
                        </span>
                        <br />
                        <span className="text-[var(--success)]">
                          + {JSON.stringify(change.after)}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </details>
          ))}
        </div>
      ) : (
        <EmptyState
          description={
            category === "all" && severity === "all"
              ? "Configuration, security, and system events will appear here."
              : "Try a different category or severity filter."
          }
          icon={Activity}
          title={category === "all" && severity === "all" ? "No Events Yet" : "No Matching Events"}
        />
      )}
    </PageContainer>
  );
}
