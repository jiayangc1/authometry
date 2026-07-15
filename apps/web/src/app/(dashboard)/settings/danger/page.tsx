"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button, StatusBadge } from "@authometry/ui";
import { inputClass } from "@/components/auth/auth-shell";
import { SettingsSection } from "@/components/settings/settings-section";
import { apiFetch } from "@/lib/api";

interface DangerState {
  workspace_name: string;
  environment_status: "active" | "disabled";
}
export default function DangerPage() {
  const client = useQueryClient();
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const query = useQuery({
    queryKey: ["danger-settings"],
    queryFn: () => apiFetch<DangerState>("/api/v1/settings/danger"),
  });
  const status = useMutation({
    mutationFn: (value: "active" | "disabled") =>
      apiFetch("/api/v1/settings/danger/status", {
        method: "POST",
        body: JSON.stringify({ status: value }),
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["danger-settings"] });
      toast.success("Environment status updated");
    },
    onError: (error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: () =>
      apiFetch("/api/v1/settings/danger/workspace", {
        method: "DELETE",
        body: JSON.stringify({ confirmation }),
      }),
    onSuccess: () => {
      toast.success("Workspace deleted");
      router.push("/login");
    },
    onError: (error) => toast.error(error.message),
  });
  const disabled = query.data?.environment_status === "disabled";
  return (
    <div className="rounded-lg border border-[var(--danger-border)] px-5">
      <SettingsSection
        description="Stop authorization and token issuance while preserving configuration and audit data."
        footer={
          <Button
            disabled={status.isPending}
            onClick={() => status.mutate(disabled ? "active" : "disabled")}
            variant={disabled ? "primary" : "danger"}
          >
            {disabled ? "Enable environment" : "Disable environment"}
          </Button>
        }
        title="Environment status"
      >
        <div className="flex items-center gap-2">
          <StatusBadge
            label={disabled ? "Disabled" : "Active"}
            tone={disabled ? "danger" : "success"}
          />
          <p className="text-[13px] text-[var(--text-secondary)]">
            Existing access tokens remain valid until they expire.
          </p>
        </div>
      </SettingsSection>
      <SettingsSection
        description="Permanently remove this workspace, identities, applications, tokens, traces, and configuration."
        footer={
          <Button
            disabled={!query.data || confirmation !== query.data.workspace_name || remove.isPending}
            onClick={() => remove.mutate()}
            variant="danger"
          >
            Delete workspace
          </Button>
        }
        title="Delete workspace"
      >
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium">
            Type <strong>{query.data?.workspace_name ?? "the workspace name"}</strong> to confirm
          </span>
          <input
            className={inputClass}
            onChange={(event) => setConfirmation(event.target.value)}
            value={confirmation}
          />
        </label>
        <p className="text-xs text-[var(--danger)]">This action is irreversible.</p>
      </SettingsSection>
    </div>
  );
}
