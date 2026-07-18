"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { AuthorizationTrace } from "@authometry/domain";
import { Button, StatusBadge } from "@authometry/ui";
import { CopyableValue } from "@/components/data-display/copyable-value";
import { FullDateTime } from "@/components/data-display/formatted-time";
import { ErrorState, PageSkeleton } from "@/components/data-display/states";
import { PageContainer } from "@/components/layout/page";
import { TraceTimeline } from "@/components/traces/trace-timeline";
import { apiFetch } from "@/lib/api";
import { duration } from "@/lib/format";
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
  if (trace.isLoading)
    return (
      <PageContainer size="trace">
        <PageSkeleton rows={8} />
      </PageContainer>
    );
  if (trace.isError || !trace.data)
    return (
      <PageContainer size="trace">
        <ErrorState
          title="Trace Not Found"
          description="This trace may have expired, been deleted, or belong to another environment."
          onRetry={() => void trace.refetch()}
        />
      </PageContainer>
    );
  const data = trace.data;
  const tone =
    data.status === "success"
      ? "success"
      : data.status === "denied" || data.status === "warning"
        ? "warning"
        : data.status === "pending"
          ? "neutral"
          : "danger";
  function download() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${data.request_id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  return (
    <PageContainer size="trace">
      <div className="mb-4 flex items-center gap-1 text-xs text-[var(--text-secondary)]">
        <Link className="hover:text-[var(--text-primary)]" href="/traces">
          Authorization traces
        </Link>
        <ChevronRight aria-hidden="true" className="size-3" />
        <span className="technical-value">{data.request_id}</span>
      </div>
      <header className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="technical-value text-xl font-semibold text-balance break-words">
              {data.request_id}
            </h1>
            <StatusBadge
              label={
                data.status === "success"
                  ? "Authorized"
                  : data.status[0]!.toUpperCase() + data.status.slice(1)
              }
              tone={tone}
            />
            {data.explanation?.securityEvent && (
              <StatusBadge label="Security event" tone="danger" />
            )}
          </div>
          <p className="mt-2 text-xs text-[var(--text-secondary)]">
            <FullDateTime value={data.started_at} /> · completed in {duration(data.duration_ms)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              void navigator.clipboard
                .writeText(data.request_id)
                .then(() => toast.success("Request ID copied."));
            }}
          >
            <Copy aria-hidden="true" className="size-3.5" /> Copy Request ID
          </Button>
          <Button onClick={download}>
            <Download aria-hidden="true" className="size-3.5" /> Export JSON
          </Button>
        </div>
      </header>
      <section className="mb-7 grid gap-px overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--border)] sm:grid-cols-2 lg:grid-cols-6">
        {[
          ["Application", data.application_name],
          ["Client", data.client_id],
          ["User", data.user_snapshot?.email ?? "anonymous"],
          ["Grant", data.grant_type],
          ["Endpoint", `${data.method} ${data.endpoint}`],
          ["Environment", "Production"],
        ].map(([label, value]) => (
          <div className="min-w-0 bg-[var(--surface-raised)] p-3" key={label}>
            <p className="text-[11px] text-[var(--text-secondary)]">{label}</p>
            <p
              className={
                label === "Client" || label === "Endpoint"
                  ? "technical-value mt-1 truncate"
                  : "mt-1 truncate text-xs font-medium"
              }
            >
              {value}
            </p>
          </div>
        ))}
      </section>
      {data.explanation && (
        <section className="mb-7 rounded-lg border border-[var(--danger-border)] bg-[var(--danger-soft)]">
          <div className="flex gap-3 border-b border-[var(--danger-border)] p-4">
            <ShieldAlert
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-[var(--danger)]"
            />
            <div>
              <h2 className="text-sm font-semibold text-[var(--danger)]">
                {data.explanation.title}
              </h2>
              <p className="mt-1 text-[13px] leading-5 text-[var(--text-secondary)]">
                {data.explanation.message}
              </p>
            </div>
          </div>
          <div className="grid gap-5 p-4 lg:grid-cols-2">
            {data.explanation.observed?.length ? (
              <ExplanationFields fields={data.explanation.observed} title="Observed" />
            ) : null}
            {data.explanation.expected?.length ? (
              <ExplanationFields fields={data.explanation.expected} title="Expected" />
            ) : null}
          </div>
          <div className="flex flex-col items-start gap-3 border-t border-[var(--danger-border)] p-4 sm:flex-row sm:items-center">
            <AlertTriangle aria-hidden="true" className="size-4 shrink-0 text-[var(--warning)]" />
            <div className="flex-1">
              <p className="text-xs font-semibold">Suggested resolution</p>
              <p className="mt-0.5 text-xs leading-5 text-[var(--text-secondary)]">
                {data.explanation.resolution}
              </p>
            </div>
            {data.explanation.action && (
              <Button asChild>
                <Link href={data.explanation.action.href}>
                  {data.explanation.action.label}{" "}
                  <ExternalLink aria-hidden="true" className="size-3.5" />
                </Link>
              </Button>
            )}
          </div>
        </section>
      )}
      <div className="mb-4">
        <h2 className="text-base font-semibold text-balance">Execution Trace</h2>
        <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
          Select a step to inspect its inputs, decision, and output.
        </p>
      </div>
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
      <h3 className="mb-2 text-xs font-semibold">{title}</h3>
      <dl className="space-y-2">
        {fields?.map((field) => (
          <div key={`${field.label}-${String(field.value)}`}>
            <dt className="text-[11px] text-[var(--text-secondary)]">{field.label}</dt>
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
