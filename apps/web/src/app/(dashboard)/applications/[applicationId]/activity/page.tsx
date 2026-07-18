"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import Link from "next/link";
import { EmptyState, StatusBadge } from "@authometry/ui";
import { useApplication } from "@/components/applications/application-context";
import { RelativeTime } from "@/components/data-display/formatted-time";
import { ErrorState, PageSkeleton } from "@/components/data-display/states";
import { SectionHeader } from "@/components/layout/page";
import { apiFetch } from "@/lib/api";
import { duration } from "@/lib/format";

export default function ApplicationActivityPage() {
  const { application } = useApplication();
  const traces = useQuery({
    queryKey: ["application-activity", application?.id],
    queryFn: () =>
      apiFetch<{
        data: Array<{
          id: string;
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
        description="Authorization and token requests for this application."
        title="Activity"
      />
      {traces.isLoading ? (
        <PageSkeleton rows={5} />
      ) : traces.isError ? (
        <ErrorState
          description="Authometry could not load application activity. Check your connection, then retry."
          headingLevel="h3"
          onRetry={() => void traces.refetch()}
          title="Unable to Load Activity"
        />
      ) : traces.data?.data.length ? (
        <div className="overflow-x-auto border-y border-[var(--border)]">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[var(--border)] text-[11px] font-medium text-[var(--text-tertiary)]">
                <th className="px-2 py-2" scope="col">
                  Status
                </th>
                <th className="px-2 py-2" scope="col">
                  Event
                </th>
                <th className="px-2 py-2" scope="col">
                  User
                </th>
                <th className="px-2 py-2" scope="col">
                  Grant
                </th>
                <th className="px-2 py-2" scope="col">
                  Duration
                </th>
                <th className="px-2 py-2" scope="col">
                  Time
                </th>
              </tr>
            </thead>
            <tbody>
              {traces.data.data.map((trace) => (
                <tr className="border-b border-[var(--border-subtle)] last:border-0" key={trace.id}>
                  <td className="px-2 py-3">
                    <StatusBadge
                      label={trace.status}
                      tone={
                        trace.status === "success"
                          ? "success"
                          : trace.status === "denied"
                            ? "warning"
                            : "danger"
                      }
                    />
                  </td>
                  <th className="px-2 py-3 text-[13px] font-medium" scope="row">
                    <Link
                      className="rounded hover:underline focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none"
                      href={`/traces/${trace.id}`}
                    >
                      {trace.event_type.replaceAll("_", " ")}
                    </Link>
                  </th>
                  <td className="max-w-48 truncate px-2 py-3 text-xs text-[var(--text-secondary)]">
                    {trace.user_snapshot?.email ?? "anonymous"}
                  </td>
                  <td className="px-2 py-3 text-xs text-[var(--text-secondary)]">
                    {trace.grant_type}
                  </td>
                  <td className="technical-value px-2 py-3">{duration(trace.duration_ms)}</td>
                  <td className="px-2 py-3 text-xs text-[var(--text-tertiary)]">
                    <RelativeTime value={trace.started_at} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          description="Authorization and token requests for this application will appear here."
          headingLevel="h3"
          icon={Activity}
          title="No Application Activity"
        />
      )}
    </section>
  );
}
