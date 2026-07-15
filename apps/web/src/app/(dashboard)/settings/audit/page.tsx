"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@authometry/ui";
import { inputClass } from "@/components/auth/auth-shell";
import { SettingsSection } from "@/components/settings/settings-section";
import { apiFetch } from "@/lib/api";

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
  const save = useMutation({
    mutationFn: () =>
      apiFetch("/api/v1/settings/general", {
        method: "PATCH",
        body: JSON.stringify({ traceRetentionDays: traceDays, auditRetentionDays: auditDays }),
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["settings-general"] });
      toast.success("Retention settings saved");
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <SettingsSection
      description="Control how long audit and authorization records remain available."
      footer={
        <Button disabled={save.isPending} onClick={() => save.mutate()} variant="primary">
          Save changes
        </Button>
      }
      title="Retention"
    >
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium">Authorization traces</span>
        <select
          className={inputClass}
          onChange={(event) => setTraceDays(Number(event.target.value))}
          value={traceDays}
        >
          <option value="7">7 days</option>
          <option value="30">30 days</option>
          <option value="90">90 days</option>
          <option value="365">1 year</option>
        </select>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium">Audit events</span>
        <select
          className={inputClass}
          onChange={(event) => setAuditDays(Number(event.target.value))}
          value={auditDays}
        >
          <option value="30">30 days</option>
          <option value="90">90 days</option>
          <option value="365">1 year</option>
          <option value="730">2 years</option>
        </select>
      </label>
      <p className="text-xs leading-5 text-[var(--text-secondary)]">
        Retention jobs remove expired records without exporting secrets, tokens, or private key
        material.
      </p>
    </SettingsSection>
  );
}
