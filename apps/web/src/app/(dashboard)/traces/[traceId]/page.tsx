"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Download, Lightbulb, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { AuthorizationTrace } from "@authometry/domain";
import { Button, StatusBadge } from "@authometry/ui";
import { CopyButton, CopyableValue } from "@/components/data-display/copyable-value";
import { FullDateTime } from "@/components/data-display/formatted-time";
import { ErrorState, PageSkeleton } from "@/components/data-display/states";
import {
  Breadcrumbs,
  DescriptionList,
  PageContainer,
  PageHeader,
  SectionHeader,
} from "@/components/layout/page";
import { TraceTimeline } from "@/components/traces/trace-timeline";
import { apiFetch } from "@/lib/api";
import { duration } from "@/lib/format";
import { humanize, traceLabel, traceTone } from "@/lib/status";
import { toast } from "sonner";

interface TraceResponse {
  id: string;
  workspace_id: string;
  environment_id: string;
  request_id: string;
  status: AuthorizationTrace["status"];
  event_type: string;
  application_id: string;
  application_name: string;
  client_id: string;
  user_snapshot?: AuthorizationTrace["user"];
  grant_type: string;
  endpoint: string;
  method: string;
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  oauth_error?: string;
  explanation?: AuthorizationTrace["explanation"];
  steps: AuthorizationTrace["steps"];
  redacted_request: AuthorizationTrace["request"];
}

export default function TraceDetailPage() {
  const { traceId } = useParams<{ traceId: string }>();
  const trace = useQuery({
    queryKey: ["trace", traceId],
    queryFn: () => apiFetch<TraceResponse>(`/api/v1/traces/${traceId}`),
  });
  const environments = useQuery({
    queryKey: ["environments"],
    queryFn: () => apiFetch<{ data: Array<{ id: string; name: string }> }>("/api/v1/environments"),
  });
  if (trace.isLoading)
    return (
      <PageContainer size="trace">
        <PageSkeleton metrics={false} rows={8} />
      </PageContainer>
    );
  if (trace.isError || !trace.data)
    return (
      <PageContainer size="trace">
        <Breadcrumbs items={[{ label: "Traces", href: "/traces" }, { label: traceId }]} />
        <ErrorState
          title="Trace not found"
          description="This trace may have expired, been deleted, or belong to another environment. Switch environments or return to the trace list."
          onRetry={() => void trace.refetch()}
          retrying={trace.isRefetching}
        />
      </PageContainer>
    );
  const data = trace.data;
  const environmentName =
    environments.data?.data.find((environment) => environment.id === data.environment_id)?.name ??
    "—";
  function download() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${data.request_id}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Trace exported.");
  }
  const facts: Array<[string, React.ReactNode]> = [
    [
      "Application",
      data.application_id ? (
        <Link className="font-medium hover:underline" href={`/applications/${data.application_id}`}>
          {data.application_name}
        </Link>
      ) : (
        data.application_name
      ),
    ],
    ["Client ID", <CopyableValue key="client" value={data.client_id} />],
    ["User", data.user_snapshot?.email ?? "Anonymous"],
    [
      "Grant",
      <span className="technical-value" key="grant">
        {data.grant_type}
      </span>,
    ],
    [
      "Endpoint",
      <span className="technical-value" key="endpoint">
        {data.method} {data.endpoint}
      </span>,
    ],
    ["Environment", environmentName],
    ["Started", <FullDateTime key="started" value={data.started_at} />],
    [
      "Duration",
      <span className="technical-value" key="duration">
        {duration(data.duration_ms)}
      </span>,
    ],
  ];
  return (
    <PageContainer size="trace">
      <Breadcrumbs items={[{ label: "Traces", href: "/traces" }, { label: data.request_id }]} />
      <PageHeader
        actions={
          <>
            <Button onClick={download}>
              <Download aria-hidden="true" className="size-3.5" /> Export JSON
            </Button>
          </>
        }
        badges={
          <>
            <StatusBadge label={traceLabel(data.status)} tone={traceTone(data.status)} />
            {data.explanation?.securityEvent && (
              <StatusBadge label="Security event" tone="danger" />
            )}
          </>
        }
        description={
          <span className="flex min-w-0 items-center gap-1">
            <span className="technical-value truncate">{data.request_id}</span>
            <CopyButton label="Copy request ID" value={data.request_id} />
          </span>
        }
        title={humanize(data.event_type)}
      />
      <DescriptionList className="mb-6 sm:[&>div]:grid-cols-[160px_minmax(0,1fr)]" items={facts} />
      {data.explanation && (
        <section
          aria-label="What went wrong"
          className="mb-6 overflow-hidden rounded-[var(--radius-card)] border border-[var(--danger-border)]"
        >
          <div className="flex gap-3 bg-[var(--danger-soft)] p-4">
            <ShieldAlert
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-[var(--danger)]"
            />
            <div>
              <h2 className="text-sm font-semibold text-[var(--danger)]">
                {data.explanation.title}
              </h2>
              <p className="mt-1 text-[13px] leading-5 text-[var(--text-primary)]">
                {data.explanation.message}
              </p>
            </div>
          </div>
          {data.explanation.observed?.length || data.explanation.expected?.length ? (
            <div className="grid gap-5 border-t border-[var(--danger-border)] bg-[var(--surface-raised)] p-4 lg:grid-cols-2">
              {data.explanation.observed?.length ? (
                <ExplanationFields fields={data.explanation.observed} title="Observed" />
              ) : null}
              {data.explanation.expected?.length ? (
                <ExplanationFields fields={data.explanation.expected} title="Expected" />
              ) : null}
            </div>
          ) : null}
          <div className="flex flex-col items-start gap-3 border-t border-[var(--danger-border)] bg-[var(--surface-raised)] p-4 sm:flex-row sm:items-center">
            <Lightbulb aria-hidden="true" className="size-4 shrink-0 text-[var(--warning)]" />
            <div className="flex-1">
              <p className="text-[13px] font-medium">How to fix it</p>
              <p className="mt-0.5 text-[13px] leading-5 text-[var(--text-secondary)]">
                {data.explanation.resolution}
              </p>
            </div>
            {data.explanation.action && (
              <Button asChild variant="primary">
                <Link href={data.explanation.action.href}>
                  {data.explanation.action.label}{" "}
                  <ArrowRight aria-hidden="true" className="size-3.5" />
                </Link>
              </Button>
            )}
          </div>
        </section>
      )}
      <SectionHeader
        description="Select a step to inspect its inputs, decision, and output. Use the arrow keys to move between steps."
        title="Execution trace"
      />
      <TraceTimeline steps={data.steps} />
    </PageContainer>
  );
}

function ExplanationFields({
  title,
  fields,
}: {
  title: string;
  fields: NonNullable<AuthorizationTrace["explanation"]>["observed"];
}) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-medium text-[var(--text-secondary)]">{title}</h3>
      <dl className="space-y-2">
        {fields?.map((field) => (
          <div key={`${field.label}-${String(field.value)}`}>
            <dt className="text-xs text-[var(--text-secondary)]">{field.label}</dt>
            <dd className="mt-0.5">
              <CopyableValue
                value={Array.isArray(field.value) ? field.value.join(", ") : String(field.value)}
              />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
