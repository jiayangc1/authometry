"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, GitCommitHorizontal } from "lucide-react";
import { StatusBadge } from "@authometry/ui";
import { PageSkeleton } from "@/components/data-display/states";
import { selectClass } from "@/components/data-display/search-input";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { apiFetch } from "@/lib/api";
import { relativeTime } from "@/lib/format";

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
  const query = useQuery({
    queryKey: ["events"],
    queryFn: () => apiFetch<{ data: EventRow[] }>("/api/v1/events"),
  });
  return (
    <PageContainer>
      <PageHeader
        description="Review configuration, security, and system activity."
        title="Events"
      />
      <div className="mb-4 flex gap-2">
        <select className={selectClass}>
          <option>All categories</option>
        </select>
        <select className={selectClass}>
          <option>All severities</option>
        </select>
      </div>
      {query.isLoading ? (
        <PageSkeleton />
      ) : (
        <div className="border-y border-[var(--border)]">
          {query.data?.data.map((event) => (
            <details
              className="group border-b border-[var(--border-subtle)] last:border-0"
              key={event.id}
            >
              <summary className="grid min-h-14 cursor-pointer list-none grid-cols-[24px_1fr_auto] items-center gap-3 px-2 py-2.5 hover:bg-[var(--surface-hover)] sm:grid-cols-[24px_minmax(200px,1fr)_140px_110px_140px]">
                <Activity className="size-4 text-[var(--text-secondary)]" />
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
                  {relativeTime(event.created_at)}
                </span>
              </summary>
              {event.changes?.length ? (
                <div className="border-t border-[var(--border-subtle)] bg-[var(--surface)] px-10 py-4">
                  <p className="mb-2 flex items-center gap-2 text-xs font-semibold">
                    <GitCommitHorizontal className="size-3.5" />
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
      )}
    </PageContainer>
  );
}
