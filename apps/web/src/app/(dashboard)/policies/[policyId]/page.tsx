"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Braces, Play } from "lucide-react";
import { Button, StatusBadge } from "@authometry/ui";
import { PageSkeleton } from "@/components/data-display/states";
import { PageContainer, PageHeader, SectionHeader } from "@/components/layout/page";
import { inputClass } from "@/components/auth/auth-shell";
import { apiFetch } from "@/lib/api";

interface Policy {
  id: string;
  display_name: string;
  description: string;
  enabled: boolean;
  conditions: {
    all: Array<{
      field: string;
      operator: "equals" | "not_equals" | "contains" | "in";
      value: string;
    }>;
  };
  decision: { otherwise: { deny: { message: string } } };
  ownership: string;
  manifest_path?: string;
  version: number;
}
export default function PolicyDetailPage() {
  const id = String(useParams().policyId);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["policy", id],
    queryFn: () => apiFetch<Policy>(`/api/v1/policies/${id}`),
  });
  const [condition, setCondition] = useState<Policy["conditions"]["all"][number]>({
    field: "user.groups",
    operator: "contains",
    value: "admin",
  });
  const [message, setMessage] = useState("Administrator access is required.");
  const [testValue, setTestValue] = useState("engineering");
  useEffect(() => {
    const current = query.data?.conditions.all[0];
    if (current) setCondition(current);
    setMessage(query.data?.decision.otherwise.deny.message ?? "Administrator access is required.");
  }, [query.data]);
  const save = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/policies/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          version: query.data!.version,
          conditions: { all: [condition] },
          otherwise: { deny: { code: "policy_denied", message } },
        }),
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["policy", id] });
      toast.success("Policy saved");
    },
    onError: (error) => toast.error(error.message),
  });
  if (query.isLoading)
    return (
      <PageContainer size="settings">
        <PageSkeleton />
      </PageContainer>
    );
  if (!query.data)
    return (
      <PageContainer size="settings">
        <PageHeader title="Policy not found" />
      </PageContainer>
    );
  const managed = query.data.ownership === "manifest";
  const passed =
    condition.operator === "contains"
      ? testValue
          .split(",")
          .map((item) => item.trim())
          .includes(condition.value)
      : condition.operator === "equals"
        ? testValue === condition.value
        : condition.operator === "not_equals"
          ? testValue !== condition.value
          : condition.value
              .split(",")
              .map((item) => item.trim())
              .includes(testValue);
  return (
    <PageContainer size="settings">
      <PageHeader
        actions={
          <Button
            disabled={managed || save.isPending}
            onClick={() => save.mutate()}
            variant="primary"
          >
            {save.isPending ? "Saving…" : "Save policy"}
          </Button>
        }
        description={query.data.description}
        title={query.data.display_name}
      />
      <div className="mb-8 flex items-center gap-2">
        <StatusBadge
          label={query.data.enabled ? "Enabled" : "Disabled"}
          tone={query.data.enabled ? "success" : "neutral"}
        />
        <StatusBadge label={managed ? "Managed by Git" : "Dashboard managed"} tone="neutral" />
        {managed && (
          <span className="technical-value text-[var(--text-tertiary)]">
            {query.data.manifest_path}
          </span>
        )}
      </div>
      <section>
        <SectionHeader
          description="All conditions must match before authorization is allowed."
          title="Policy builder"
        />
        <fieldset className="space-y-3 border-y border-[var(--border)] py-4" disabled={managed}>
          <p className="text-xs font-semibold text-[var(--text-secondary)]">WHEN</p>
          <div className="grid items-center gap-2 sm:grid-cols-[80px_1fr_140px_1fr]">
            <span className="text-xs text-[var(--text-tertiary)]" />
            <select
              className={inputClass}
              onChange={(event) => setCondition({ ...condition, field: event.target.value })}
              value={condition.field}
            >
              <option value="user.groups">User groups</option>
              <option value="user.email">User email</option>
              <option value="environment">Environment</option>
              <option value="application.type">Application type</option>
            </select>
            <select
              className={inputClass}
              onChange={(event) =>
                setCondition({
                  ...condition,
                  operator: event.target.value as typeof condition.operator,
                })
              }
              value={condition.operator}
            >
              <option value="equals">equals</option>
              <option value="not_equals">does not equal</option>
              <option value="contains">contains</option>
              <option value="in">is in</option>
            </select>
            <input
              className={inputClass}
              onChange={(event) => setCondition({ ...condition, value: event.target.value })}
              value={condition.value}
            />
          </div>
          <div className="grid items-center gap-2 pt-3 sm:grid-cols-[80px_1fr]">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">THEN</span>
            <div className="rounded border border-[var(--success-border)] bg-[var(--success-soft)] px-3 py-2 text-[13px] text-[var(--success)]">
              Allow authorization
            </div>
          </div>
          <div className="grid items-center gap-2 sm:grid-cols-[80px_1fr]">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">OTHERWISE</span>
            <input
              className={inputClass}
              onChange={(event) => setMessage(event.target.value)}
              value={message}
            />
          </div>
        </fieldset>
      </section>
      <section className="mt-8 border-t border-[var(--border)] pt-7">
        <SectionHeader
          actions={
            <Button
              onClick={() => toast.info(passed ? "Test context allowed" : "Test context denied")}
            >
              <Play className="size-3.5" /> Run test
            </Button>
          }
          description="Evaluate the first condition against a representative value without saving changes."
          title="Test policy"
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)]">
            <div className="flex h-9 items-center border-b border-[var(--border)] px-3 text-xs text-[var(--text-secondary)]">
              <Braces className="mr-2 size-3.5" />
              Observed value
            </div>
            <div className="p-4">
              <input
                className={inputClass}
                onChange={(event) => setTestValue(event.target.value)}
                value={testValue}
              />
              <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                Use comma-separated values for group tests.
              </p>
            </div>
          </div>
          <div
            className={`rounded-lg border p-4 ${passed ? "border-[var(--success-border)] bg-[var(--success-soft)]" : "border-[var(--danger-border)] bg-[var(--danger-soft)]"}`}
          >
            <StatusBadge
              label={passed ? "Allowed" : "Denied"}
              tone={passed ? "success" : "danger"}
            />
            <p className="mt-3 text-[13px] font-medium">
              {condition.field} {condition.operator.replaceAll("_", " ")} {condition.value}
            </p>
            {!passed && <p className="mt-1 text-xs text-[var(--text-secondary)]">{message}</p>}
          </div>
        </div>
      </section>
    </PageContainer>
  );
}
