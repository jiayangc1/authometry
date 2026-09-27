"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, SearchX } from "lucide-react";
import { Button, EmptyState, StatusBadge, type StatusTone } from "@authometry/ui";
import { RelativeTime } from "@/components/data-display/formatted-time";
import { ErrorState, ListSkeleton } from "@/components/data-display/states";
import { FilterBar, SearchInput } from "@/components/data-display/search-input";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { DisclosureRow } from "@/components/ui/disclosure-row";
import { Select } from "@/components/ui/form";
import { apiFetch } from "@/lib/api";
import { humanize } from "@/lib/status";
import { useDebouncedSearchParam } from "@/lib/use-query-params";

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

const severityTone: Record<string, StatusTone> = {
  high: "danger",
  critical: "danger",
  warning: "warning",
  info: "neutral",
};

function format(value: unknown) {
  return value === undefined ? "—" : JSON.stringify(value);
}

export default function EventsPage() {
  const search = useDebouncedSearchParam("q", 150);
  const category = search.parameters.get("category") ?? "";
  const severity = search.parameters.get("severity") ?? "";
  const expandedEvent = search.parameters.get("event");
  const query = useQuery({
    queryKey: ["events"],
    queryFn: () => apiFetch<{ data: EventRow[] }>("/api/v1/events"),
  });
  const all = query.data?.data ?? [];
  const needle = search.query.toLowerCase();
  const events = all.filter(
    (event) =>
      (!category || event.category === category) &&
      (!severity || event.severity === severity) &&
      (!needle ||
        event.summary.toLowerCase().includes(needle) ||
        event.event_type.toLowerCase().includes(needle) ||
        (event.actor_name ?? "").toLowerCase().includes(needle)),
  );
  const categories = [...new Set(all.map((event) => event.category))];
  const severities = [...new Set(all.map((event) => event.severity))];
  const filtered = Boolean(category || severity || search.query);
  function clearFilters() {
    search.clear();
    search.update({ q: undefined, category: undefined, severity: undefined });
  }
  return (
    <PageContainer>
      <PageHeader
        description="An audit trail of configuration, security, and system activity in this environment."
        title="Events"
      />
      <FilterBar>
        <SearchInput
          className="sm:w-72"
          onChange={(event) => search.setValue(event.target.value)}
          onClear={search.clear}
          placeholder="Search events or people…"
          value={search.value}
        />
        <Select
          aria-label="Event category"
          compact
          onChange={(event) => search.update({ category: event.target.value || undefined })}
          value={category}
          wrapperClassName="sm:w-44"
        >
          <option value="">All categories</option>
          {categories.map((value) => (
            <option key={value} value={value}>
              {humanize(value)}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Event severity"
          compact
          onChange={(event) => search.update({ severity: event.target.value || undefined })}
          value={severity}
          wrapperClassName="sm:w-40"
        >
          <option value="">All severities</option>
          {severities.map((value) => (
            <option key={value} value={value}>
              {humanize(value)}
            </option>
          ))}
        </Select>
        {filtered && (
          <Button className="sm:ml-auto" onClick={clearFilters} size="compact" variant="ghost">
            Clear filters
          </Button>
        )}
      </FilterBar>
      {query.isLoading ? (
        <ListSkeleton rows={8} />
      ) : query.isError ? (
        <ErrorState
          description="Authometry could not load events. Check your connection, then retry."
          headingLevel="h2"
          onRetry={() => void query.refetch()}
          title="Unable to load events"
        />
      ) : events.length ? (
        <div className="stagger overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-raised)]">
          {events.map((event) => (
            <DisclosureRow
              key={event.id}
              onOpenChange={(open) => search.update({ event: open ? event.id : undefined })}
              open={expandedEvent === event.id}
              summary={
                <div className="grid items-center gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,1fr)_140px_110px_110px]">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium">{event.summary}</p>
                    <p className="technical-value truncate text-[var(--text-tertiary)]">
                      {event.event_type}
                    </p>
                  </div>
                  <span className="truncate text-[13px] text-[var(--text-secondary)]">
                    {event.actor_name ?? "System"}
                  </span>
                  <span>
                    <StatusBadge
                      label={humanize(event.category)}
                      tone={severityTone[event.severity] ?? "neutral"}
                    />
                  </span>
                  <span className="text-[13px] text-[var(--text-secondary)] sm:text-right">
                    <RelativeTime value={event.created_at} />
                  </span>
                </div>
              }
            >
              {event.changes?.length ? (
                <div className="space-y-2">
                  {event.changes.map((change) => (
                    <div
                      className="technical-value grid gap-1 sm:grid-cols-[160px_minmax(0,1fr)]"
                      key={change.path}
                    >
                      <span className="text-[var(--text-secondary)]">{change.path}</span>
                      <span className="min-w-0 overflow-hidden rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface-raised)]">
                        <span className="block bg-[var(--danger-soft)] px-2 py-0.5 break-all text-[var(--danger)]">
                          − {format(change.before)}
                        </span>
                        <span className="block bg-[var(--success-soft)] px-2 py-0.5 break-all text-[var(--success)]">
                          + {format(change.after)}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-[var(--text-secondary)]">
                  No field-level changes were recorded for this event.
                </p>
              )}
            </DisclosureRow>
          ))}
        </div>
      ) : (
        <EmptyState
          description={
            filtered
              ? "Try a different search, category, or severity."
              : "Configuration, security, and system events will appear here."
          }
          icon={filtered ? SearchX : Activity}
          primaryAction={
            filtered ? <Button onClick={clearFilters}>Clear filters</Button> : undefined
          }
          title={filtered ? "No matching events" : "No events yet"}
        />
      )}
    </PageContainer>
  );
}
