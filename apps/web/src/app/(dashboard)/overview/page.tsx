"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ExternalLink, Play, ShieldCheck, TriangleAlert, XCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@authometry/ui";
import { RequestChart } from "@/components/dashboard/request-chart";
import { RelativeTime } from "@/components/data-display/formatted-time";
import { ErrorState, PageSkeleton } from "@/components/data-display/states";
import { PageContainer, PageHeader, SectionHeader } from "@/components/layout/page";
import { apiFetch } from "@/lib/api";
import { compactNumber, duration, hourLabel, percentage } from "@/lib/format";

interface OverviewResponse {
  metrics: {
    authorizationRequests: number;
    successRate: number;
    activeSessions: number;
    failedRequests: number;
  };
  chart?: Array<{ time: string; successful: number; denied: number; failed: number }>;
  recentTraces: Array<{
    id: string;
    request_id: string;
    status: string;
    event_type: string;
    application_name: string;
    user_snapshot?: { email?: string };
    duration_ms?: number;
    started_at: string;
  }>;
  recentEvents: Array<{ id: string; summary: string; actor_name?: string; created_at: string }>;
}

export default function OverviewPage() {
  const overview = useQuery({
    queryKey: ["overview"],
    queryFn: () => apiFetch<OverviewResponse>("/api/v1/overview"),
  });
  if (overview.isLoading)
    return (
      <PageContainer>
        <PageSkeleton />
      </PageContainer>
    );
  if (overview.isError || !overview.data)
    return (
      <PageContainer>
        <ErrorState
          description="Authometry could not reach the API. Check the connection and try again."
          onRetry={() => void overview.refetch()}
          title="Unable to Load Authentication Activity"
        />
      </PageContainer>
    );
  const data = overview.data;
  const metrics = [
    ["Authorization requests", compactNumber(data.metrics.authorizationRequests), "Last 24 hours"],
    ["Success rate", percentage(data.metrics.successRate, 1), "Last 24 hours"],
    ["Active sessions", compactNumber(data.metrics.activeSessions), "Currently valid"],
    [
      "Failed requests",
      compactNumber(data.metrics.failedRequests),
      data.metrics.authorizationRequests
        ? `${percentage((data.metrics.failedRequests / data.metrics.authorizationRequests) * 100, 2)} of requests`
        : "No failed requests",
    ],
  ];
  return (
    <PageContainer>
      <PageHeader
        actions={
          <>
            <Button asChild>
              <Link href="/docs">
                View Documentation <ExternalLink aria-hidden="true" className="size-3.5" />
              </Link>
            </Button>
            <Button asChild variant="primary">
              <Link href="/developer/playground">
                <Play aria-hidden="true" className="size-3.5" /> Open Playground
              </Link>
            </Button>
          </>
        }
        description="Monitor authorization activity across your Authometry instance."
        title="Overview"
      />
      <section className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value, support]) => (
          <div
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-4"
            key={label}
          >
            <p className="text-xs font-medium text-[var(--text-secondary)]">{label}</p>
            <p className="mt-3 text-[26px] leading-8 font-semibold tracking-[-0.035em] tabular-nums">
              {value}
            </p>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">{support}</p>
          </div>
        ))}
      </section>
      <section className="mb-9 border-t border-[var(--border)] pt-7">
        <SectionHeader
          actions={
            <div className="flex items-center gap-3 text-[11px] text-[var(--text-secondary)]">
              <span>
                <i className="mr-1.5 inline-block size-1.5 rounded-full bg-[var(--chart-1)]" />
                Successful
              </span>
              <span>
                <i className="mr-1.5 inline-block size-1.5 rounded-full bg-[var(--warning)]" />
                Denied
              </span>
              <span>
                <i className="mr-1.5 inline-block size-1.5 rounded-full bg-[var(--danger)]" />
                Failed
              </span>
            </div>
          }
          description="Successful, denied, and failed requests during the last 24 hours."
          title="Authorization Requests"
        />
        <RequestChart
          data={
            data.chart ??
            Array.from({ length: 12 }, (_, index) => ({
              time: hourLabel(index * 2),
              successful: 0,
              denied: 0,
              failed: 0,
            }))
          }
        />
      </section>
      <div className="grid gap-10 border-t border-[var(--border)] pt-7 xl:grid-cols-[1.35fr_0.65fr]">
        <section>
          <SectionHeader
            actions={
              <Button asChild size="compact" variant="ghost">
                <Link href="/traces">
                  View All <ArrowRight aria-hidden="true" className="size-3" />
                </Link>
              </Button>
            }
            title="Recent Authorization Activity"
          />
          <div className="border-y border-[var(--border)]">
            {data.recentTraces.length ? (
              data.recentTraces.map((trace) => {
                const Icon =
                  trace.status === "success"
                    ? ShieldCheck
                    : trace.status === "denied"
                      ? TriangleAlert
                      : XCircle;
                return (
                  <Link
                    className="grid min-h-14 grid-cols-[20px_1fr_auto] items-center gap-3 border-b border-[var(--border-subtle)] px-2 py-2.5 transition-colors last:border-0 hover:bg-[var(--surface-hover)]"
                    href={`/traces/${trace.id}`}
                    key={trace.id}
                  >
                    <Icon
                      aria-hidden="true"
                      className={`size-4 ${trace.status === "success" ? "text-[var(--success)]" : trace.status === "denied" ? "text-[var(--warning)]" : "text-[var(--danger)]"}`}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium">
                        {trace.event_type.replaceAll("_", " ")}
                      </p>
                      <p className="truncate text-xs text-[var(--text-secondary)]">
                        {trace.application_name} · {trace.user_snapshot?.email ?? "anonymous"} ·{" "}
                        {duration(trace.duration_ms)}
                      </p>
                    </div>
                    <span className="text-xs text-[var(--text-tertiary)]">
                      <RelativeTime value={trace.started_at} />
                    </span>
                  </Link>
                );
              })
            ) : (
              <p className="px-3 py-10 text-center text-[13px] text-[var(--text-secondary)]">
                Authorization activity will appear here.
              </p>
            )}
          </div>
        </section>
        <section>
          <SectionHeader title="Configuration Changes" />
          <div className="border-y border-[var(--border)]">
            {data.recentEvents.length ? (
              data.recentEvents.map((event) => (
                <div
                  className="border-b border-[var(--border-subtle)] px-2 py-3 last:border-0"
                  key={event.id}
                >
                  <p className="text-[13px] font-medium">{event.summary}</p>
                  <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                    {event.actor_name ?? "System"} · <RelativeTime value={event.created_at} />
                  </p>
                </div>
              ))
            ) : (
              <p className="px-3 py-10 text-center text-[13px] text-[var(--text-secondary)]">
                Configuration changes will appear here.
              </p>
            )}
          </div>
        </section>
      </div>
    </PageContainer>
  );
}
