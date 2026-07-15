"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { StatusBadge } from "@authometry/ui";
import { useApplication } from "@/components/applications/application-context";
import { SectionHeader } from "@/components/layout/page";
import { apiFetch } from "@/lib/api";
import { duration, relativeTime } from "@/lib/format";

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
      <div className="border-y border-[var(--border)]">
        <div className="hidden grid-cols-[100px_1fr_1fr_1fr_90px_120px] gap-3 border-b border-[var(--border)] px-2 py-2 text-[11px] font-medium text-[var(--text-tertiary)] sm:grid">
          <span>Status</span>
          <span>Event</span>
          <span>User</span>
          <span>Grant</span>
          <span>Duration</span>
          <span>Time</span>
        </div>
        {traces.data?.data.map((trace) => (
          <Link
            className="grid min-h-14 grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-[var(--border-subtle)] px-2 py-2.5 last:border-0 hover:bg-[var(--surface-hover)] sm:grid-cols-[100px_1fr_1fr_1fr_90px_120px]"
            href={`/traces/${trace.id}`}
            key={trace.id}
          >
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
            <span className="truncate text-[13px] font-medium">
              {trace.event_type.replaceAll("_", " ")}
            </span>
            <span className="hidden truncate text-xs text-[var(--text-secondary)] sm:block">
              {trace.user_snapshot?.email ?? "anonymous"}
            </span>
            <span className="hidden truncate text-xs text-[var(--text-secondary)] sm:block">
              {trace.grant_type}
            </span>
            <span className="technical-value hidden sm:block">{duration(trace.duration_ms)}</span>
            <span className="text-xs text-[var(--text-tertiary)]">
              {relativeTime(trace.started_at)}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
