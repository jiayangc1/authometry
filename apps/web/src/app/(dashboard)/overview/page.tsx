"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AppWindow,
  ArrowRight,
  ArrowUpRight,
  Check,
  FlaskConical,
  History,
  ListTree,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { Button, StatusBadge, cn } from "@authometry/ui";
import { RequestChart } from "@/components/dashboard/request-chart";
import { RelativeTime } from "@/components/data-display/formatted-time";
import { ErrorState, PageSkeleton } from "@/components/data-display/states";
import { PageContainer, PageHeader, SectionHeader } from "@/components/layout/page";
import { Card } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import { compactNumber, duration, hourLabel, percentage } from "@/lib/format";
import { humanize, traceLabel, traceTone } from "@/lib/status";

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

function GettingStarted({
  hasApplications,
  hasTraffic,
}: {
  hasApplications: boolean;
  hasTraffic: boolean;
}) {
  const steps = [
    {
      done: hasApplications,
      title: "Create an application",
      description: "Register the website, app, or service that will sign users in.",
      href: "/applications/new",
      icon: AppWindow,
      action: "Create application",
    },
    {
      done: false,
      title: "Add a user",
      description: "Invite a teammate or create a test identity to sign in with.",
      href: "/users/new",
      icon: UserPlus,
      action: "Add user",
    },
    {
      done: hasTraffic,
      title: "Run your first authorization",
      description: "Use the playground to send a request and inspect the trace.",
      href: "/developer/playground",
      icon: FlaskConical,
      action: "Open playground",
    },
  ];
  return (
    <Card className="mb-8 overflow-hidden">
      <div className="border-b border-[var(--border)] px-5 py-4">
        <h2 className="text-base font-semibold">Get started with Authometry</h2>
        <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
          Three steps to your first traced sign-in.
        </p>
      </div>
      <ol className="stagger grid divide-y divide-[var(--border)] md:grid-cols-3 md:divide-x md:divide-y-0">
        {steps.map((step, index) => (
          <li className="flex flex-col p-5" key={step.title}>
            <span
              className={cn(
                "mb-3 flex size-7 items-center justify-center rounded-full border text-xs font-medium",
                step.done
                  ? "animate-pop border-transparent bg-[var(--success-solid)] text-white"
                  : "border-[var(--border-strong)] text-[var(--text-secondary)]",
              )}
            >
              {step.done ? <Check aria-label="Done" className="size-3.5" /> : index + 1}
            </span>
            <h3
              className={cn(
                "text-sm font-medium",
                step.done && "text-[var(--text-secondary)] line-through",
              )}
            >
              {step.title}
            </h3>
            <p className="mt-1 flex-1 text-[13px] text-[var(--text-secondary)]">
              {step.description}
            </p>
            {!step.done && (
              <Button
                asChild
                className="mt-4 self-start [&:hover_svg]:translate-x-0.5"
                size="compact"
              >
                <Link href={step.href}>
                  {step.action} <ArrowRight aria-hidden="true" className="size-3" />
                </Link>
              </Button>
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
}

export default function OverviewPage() {
  const overview = useQuery({
    queryKey: ["overview"],
    queryFn: () => apiFetch<OverviewResponse>("/api/v1/overview"),
  });
  const applications = useQuery({
    queryKey: ["applications", "", "", ""],
    queryFn: () => apiFetch<{ data: unknown[] }>("/api/v1/applications?q=&type=&status="),
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
          retrying={overview.isRefetching}
          title="Unable to load authentication activity"
        />
      </PageContainer>
    );
  const data = overview.data;
  const hasApplications = (applications.data?.data.length ?? 0) > 0;
  const hasTraffic = data.metrics.authorizationRequests > 0 || data.recentTraces.length > 0;
  const metrics = [
    {
      label: "Authorization requests",
      value: compactNumber(data.metrics.authorizationRequests),
      support: "Last 24 hours",
      href: "/traces",
    },
    {
      label: "Success rate",
      value: data.metrics.authorizationRequests ? percentage(data.metrics.successRate, 1) : "—",
      support: "Last 24 hours",
      href: "/traces?status=success",
    },
    {
      label: "Active sessions",
      value: compactNumber(data.metrics.activeSessions),
      support: "Currently valid",
      href: "/sessions",
    },
    {
      label: "Failed requests",
      value: compactNumber(data.metrics.failedRequests),
      support: data.metrics.authorizationRequests
        ? `${percentage((data.metrics.failedRequests / data.metrics.authorizationRequests) * 100, 2)} of requests`
        : "No requests yet",
      href: "/traces?status=error",
      tone: data.metrics.failedRequests > 0 ? "danger" : undefined,
    },
  ];
  return (
    <PageContainer>
      <PageHeader
        actions={
          <>
            <Button asChild>
              <Link href="/docs">Documentation</Link>
            </Button>
            <Button asChild variant="primary">
              <Link href="/developer/playground">
                <FlaskConical aria-hidden="true" className="size-3.5" /> Open playground
              </Link>
            </Button>
          </>
        }
        description="Monitor authorization activity across this environment."
        title="Overview"
      />
      {(!hasApplications || !hasTraffic) && !applications.isLoading && (
        <GettingStarted hasApplications={hasApplications} hasTraffic={hasTraffic} />
      )}
      <section
        aria-label="Key metrics"
        className="stagger mb-8 grid gap-px overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--border)] sm:grid-cols-2 xl:grid-cols-4"
      >
        {metrics.map((metric) => (
          <Link
            className="group relative bg-[var(--surface-raised)] p-5 transition-colors duration-[var(--motion-fast)] hover:bg-[var(--surface-subtle)] focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:outline-none focus-visible:ring-inset"
            href={metric.href}
            key={metric.label}
          >
            <p className="flex items-center justify-between text-[13px] text-[var(--text-secondary)]">
              {metric.label}
              <ArrowUpRight
                aria-hidden="true"
                className="size-3.5 -translate-x-0.5 translate-y-0.5 text-[var(--text-tertiary)] opacity-0 transition-[opacity,transform] duration-[var(--motion-normal)] ease-[var(--ease-spring)] group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100"
              />
            </p>
            <p
              className={cn(
                "mt-2 text-[28px] leading-9 font-semibold tracking-[-0.04em] tabular-nums",
                metric.tone === "danger" && "text-[var(--danger)]",
              )}
            >
              {metric.value}
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">{metric.support}</p>
          </Link>
        ))}
      </section>
      <section className="mb-8">
        <SectionHeader
          actions={
            <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
              {[
                ["Successful", "bg-[var(--chart-1)]"],
                ["Denied", "bg-[var(--warning-solid)]"],
                ["Failed", "bg-[var(--danger-solid)]"],
              ].map(([label, color]) => (
                <span className="flex items-center gap-1.5" key={label}>
                  <i
                    aria-hidden="true"
                    className={cn("inline-block size-2 rounded-[2px]", color)}
                  />
                  {label}
                </span>
              ))}
            </div>
          }
          description="Successful, denied, and failed requests over the last 24 hours."
          title="Authorization requests"
        />
        <Card className="px-2 pt-4 pb-2">
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
        </Card>
      </section>
      <div className="grid gap-8 xl:grid-cols-[1.4fr_1fr]">
        <section>
          <SectionHeader
            actions={
              <Button
                asChild
                className="[&:hover_svg]:translate-x-0.5"
                size="compact"
                variant="ghost"
              >
                <Link href="/traces">
                  View all <ArrowRight aria-hidden="true" className="size-3" />
                </Link>
              </Button>
            }
            title="Recent activity"
          />
          <Card className="overflow-hidden">
            {data.recentTraces.length ? (
              <ul className="stagger divide-y divide-[var(--border)]">
                {data.recentTraces.map((trace) => (
                  <li key={trace.id}>
                    <Link
                      className="row-link grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:outline-none focus-visible:ring-inset"
                      href={`/traces/${trace.id}`}
                    >
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-[13px] font-medium">
                          <span className="truncate">{humanize(trace.event_type)}</span>
                          <StatusBadge
                            label={traceLabel(trace.status)}
                            tone={traceTone(trace.status)}
                          />
                        </p>
                        <p className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">
                          {trace.application_name} · {trace.user_snapshot?.email ?? "anonymous"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="technical-value">{duration(trace.duration_ms)}</p>
                        <p className="text-xs text-[var(--text-tertiary)]">
                          <RelativeTime value={trace.started_at} />
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center px-4 py-12 text-center">
                <ListTree aria-hidden="true" className="mb-3 size-5 text-[var(--text-tertiary)]" />
                <p className="text-[13px] font-medium">No authorization activity yet</p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  Requests appear here as soon as an application starts signing users in.
                </p>
              </div>
            )}
          </Card>
        </section>
        <section>
          <SectionHeader
            actions={
              <Button
                asChild
                className="[&:hover_svg]:translate-x-0.5"
                size="compact"
                variant="ghost"
              >
                <Link href="/events">
                  View all <ArrowRight aria-hidden="true" className="size-3" />
                </Link>
              </Button>
            }
            title="Configuration changes"
          />
          <Card className="overflow-hidden">
            {data.recentEvents.length ? (
              <ol className="stagger px-4 py-2">
                {data.recentEvents.map((event, index) => (
                  <li className="relative flex gap-3 py-2.5" key={event.id}>
                    {index < data.recentEvents.length - 1 && (
                      <span
                        aria-hidden="true"
                        className="absolute top-6 bottom-[-6px] left-[3px] w-px bg-[var(--border)]"
                      />
                    )}
                    <span
                      aria-hidden="true"
                      className="mt-1.5 size-[7px] shrink-0 rounded-full border border-[var(--border-strong)] bg-[var(--surface-raised)]"
                    />
                    <div className="min-w-0">
                      <p className="text-[13px]">{event.summary}</p>
                      <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                        {event.actor_name ?? "System"} · <RelativeTime value={event.created_at} />
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="flex flex-col items-center px-4 py-12 text-center">
                <History aria-hidden="true" className="mb-3 size-5 text-[var(--text-tertiary)]" />
                <p className="text-[13px] font-medium">No changes yet</p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  Edits to applications, policies, and settings are recorded here.
                </p>
              </div>
            )}
          </Card>
        </section>
      </div>
    </PageContainer>
  );
}
