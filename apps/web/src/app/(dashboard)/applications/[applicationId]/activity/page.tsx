"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import Link from "next/link";
import { Button, EmptyState, StatusBadge } from "@authometry/ui";
import { useApplication } from "@/components/applications/application-context";
import { RelativeTime } from "@/components/data-display/formatted-time";
import { ErrorState, ListSkeleton } from "@/components/data-display/states";
import { SectionHeader } from "@/components/layout/page";
import { Table, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch } from "@/lib/api";
import { duration } from "@/lib/format";
import { humanize, traceLabel, traceTone } from "@/lib/status";

const columns = "110px minmax(160px,1.2fr) minmax(160px,1fr) 150px 80px 110px";

export default function ApplicationActivityPage() {
  const { application } = useApplication();
  const traces = useQuery({
    queryKey: ["application-activity", application?.id],
    queryFn: () =>
      apiFetch<{
        data: Array<{
          id: string;
          request_id: string;
          status: string;
          event_type: string;
          user_snapshot?: { email?: string };
          grant_type: string;
          duration_ms?: number;
          started_at: string;
        }>;
      }>(`/api/v1/traces?application=${application?.id ?? ""}`),
    enabled: Boolean(application),
  });
  if (!application) return null;
  return (
    <section>
      <SectionHeader
        actions={
          <Button asChild size="compact" variant="ghost">
            <Link href={`/traces?q=${encodeURIComponent(application.client_id)}`}>
              Open in traces
            </Link>
          </Button>
        }
        description="The 50 most recent authorization and token requests for this application."
        title="Activity"
      />
      {traces.isLoading ? (
        <ListSkeleton rows={5} />
      ) : traces.isError ? (
        <ErrorState
          description="Authometry could not load application activity. Check your connection, then retry."
          headingLevel="h3"
          onRetry={() => void traces.refetch()}
          title="Unable to load activity"
        />
      ) : traces.data?.data.length ? (
        <Table columns={columns} label="Application activity">
          <TableHeader>
            <span>Status</span>
            <span>Event</span>
            <span>User</span>
            <span>Grant</span>
            <span className="text-right">Duration</span>
            <span className="text-right">Time</span>
          </TableHeader>
          <div className="stagger">
            {traces.data.data.map((trace) => (
              <TableRow href={`/traces/${trace.id}`} key={trace.id}>
                <span className="order-2 lg:order-none">
                  <StatusBadge label={traceLabel(trace.status)} tone={traceTone(trace.status)} />
                </span>
                <div className="order-1 min-w-0 lg:order-none">
                  <p className="truncate text-[13px] font-medium">{humanize(trace.event_type)}</p>
                  <p className="truncate text-xs text-[var(--text-secondary)] lg:hidden">
                    {trace.user_snapshot?.email ?? "anonymous"} ·{" "}
                    <RelativeTime value={trace.started_at} />
                  </p>
                </div>
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
        </Table>
      ) : (
        <EmptyState
          description="Requests from this application will appear here. Start one from the playground."
          headingLevel="h3"
          icon={Activity}
          primaryAction={
            <Button asChild variant="primary">
              <Link
                href={`/developer/playground?client_id=${encodeURIComponent(application.client_id)}`}
              >
                Test sign-in
              </Link>
            </Button>
          }
          title="No activity yet"
        />
      )}
    </section>
  );
}
