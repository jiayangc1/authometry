"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@authometry/ui";
import { ErrorState, ListSkeleton } from "@/components/data-display/states";
import { SettingsSection } from "@/components/settings/settings-section";
import { Field, Select } from "@/components/ui/form";
import { apiFetch } from "@/lib/api";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";

interface Retention {
  trace_retention_days: number;
  audit_retention_days: number;
}
export default function AuditSettingsPage() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["settings-general"],
    queryFn: () => apiFetch<Retention>("/api/v1/settings/general"),
  });
  const [traceDays, setTraceDays] = useState(30);
  const [auditDays, setAuditDays] = useState(365);
  useEffect(() => {
    setTraceDays(query.data?.trace_retention_days ?? 30);
    setAuditDays(query.data?.audit_retention_days ?? 365);
  }, [query.data]);
  const isDirty = Boolean(
    query.data &&
    (traceDays !== query.data.trace_retention_days ||
      auditDays !== query.data.audit_retention_days),
  );
  useUnsavedChanges(isDirty);
  const save = useMutation({
    mutationFn: () =>
      apiFetch("/api/v1/settings/general", {
        method: "PATCH",
        body: JSON.stringify({ traceRetentionDays: traceDays, auditRetentionDays: auditDays }),
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["settings-general"] });
      toast.success("Retention saved.");
    },
    onError: (error) => toast.error(error.message),
  });
  if (query.isLoading) return <ListSkeleton rows={3} />;
  if (query.isError)
    return (
      <ErrorState
        description="Authometry could not load retention settings. Check your connection, then retry."
        headingLevel="h2"
        onRetry={() => void query.refetch()}
        title="Unable to load retention settings"
      />
    );
  const traceOptions = withCurrent([7, 30, 90, 365], traceDays);
  const auditOptions = withCurrent([30, 90, 365, 730], auditDays);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (isDirty) save.mutate();
      }}
    >
      <SettingsSection
        description="How long authorization traces and audit events stay available in this workspace."
        footer={
          <Button disabled={!isDirty} loading={save.isPending} type="submit" variant="primary">
            Save
          </Button>
        }
        footerHint="Expired records are deleted by a background job. Secrets are never exported."
        title="Retention"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field description="Detailed step-by-step request traces." label="Authorization traces">
            <Select
              name="traceRetentionDays"
              onChange={(event) => setTraceDays(Number(event.target.value))}
              value={traceDays}
            >
              {traceOptions.map((days) => (
                <option key={days} value={days}>
                  {label(days)}
                </option>
              ))}
            </Select>
          </Field>
          <Field description="Configuration, security, and member changes." label="Audit events">
            <Select
              name="auditRetentionDays"
              onChange={(event) => setAuditDays(Number(event.target.value))}
              value={auditDays}
            >
              {auditOptions.map((days) => (
                <option key={days} value={days}>
                  {label(days)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </SettingsSection>
    </form>
  );
}

function withCurrent(options: number[], current: number) {
  return options.includes(current) ? options : [...options, current].sort((a, b) => a - b);
}

function label(days: number) {
  if (days % 365 === 0) return days === 365 ? "1 year" : `${days / 365} years`;
  return `${days} days`;
}
