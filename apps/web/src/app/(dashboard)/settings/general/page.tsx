"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, StatusBadge } from "@authometry/ui";
import { inputClass } from "@/components/auth/auth-shell";
import { ErrorState, PageSkeleton } from "@/components/data-display/states";
import { SettingsSection } from "@/components/settings/settings-section";
import { apiFetch } from "@/lib/api";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";

interface GeneralSettings {
  name: string;
  environment_name: string;
  issuer: string;
}

export default function GeneralSettingsPage() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["settings-general"],
    queryFn: () => apiFetch<GeneralSettings>("/api/v1/settings/general"),
  });
  const providers = useQuery({
    queryKey: ["settings-providers"],
    queryFn: () => apiFetch<Record<string, { enabled: boolean }>>("/api/v1/settings/providers"),
  });
  const [workspaceName, setWorkspaceName] = useState("");
  const [environmentName, setEnvironmentName] = useState("");
  useEffect(() => {
    setWorkspaceName(query.data?.name ?? "");
    setEnvironmentName(query.data?.environment_name ?? "");
  }, [query.data]);
  const isDirty = Boolean(
    query.data &&
    (workspaceName !== query.data.name || environmentName !== query.data.environment_name),
  );
  useUnsavedChanges(isDirty);
  const save = useMutation({
    mutationFn: () =>
      apiFetch("/api/v1/settings/general", {
        method: "PATCH",
        body: JSON.stringify({ workspaceName, environmentName }),
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["settings-general"] });
      toast.success("Settings saved");
    },
    onError: (error) => toast.error(error.message),
  });
  if (query.isLoading) return <PageSkeleton rows={4} />;
  if (query.isError)
    return (
      <ErrorState
        description="Authometry could not load general settings. Check your connection, then retry."
        headingLevel="h2"
        onRetry={() => void query.refetch()}
        title="Unable to Load General Settings"
      />
    );
  return (
    <div>
      <SettingsSection
        description="Displayed throughout administration interfaces and authorization screens."
        footer={
          <Button
            disabled={save.isPending || !isDirty}
            onClick={() => save.mutate()}
            variant="primary"
          >
            {save.isPending ? "Saving…" : "Save Changes"}
          </Button>
        }
        title="Workspace"
      >
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium">Workspace name</span>
          <input
            autoComplete="off"
            className={inputClass}
            name="workspaceName"
            onChange={(event) => setWorkspaceName(event.target.value)}
            value={workspaceName}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium">Environment name</span>
          <input
            autoComplete="off"
            className={inputClass}
            name="environmentName"
            onChange={(event) => setEnvironmentName(event.target.value)}
            value={environmentName}
          />
        </label>
      </SettingsSection>
      <SettingsSection
        description="The issuer identifies tokens and discovery metadata. Activate a verified domain before changing a production issuer."
        title="Issuer URL"
      >
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium">Current issuer</span>
          <input
            className={`${inputClass} technical-value`}
            name="issuer"
            readOnly
            value={query.data?.issuer ?? ""}
          />
        </label>
        <p className="text-xs leading-5 text-[var(--text-secondary)]">
          Issuer changes are applied through a verified domain or an AuthometryInstance manifest.
        </p>
      </SettingsSection>
      <SettingsSection
        description="External authentication and delivery remain disabled until complete runtime credentials are supplied."
        title="Integrations"
      >
        {providers.isLoading ? (
          <p className="text-xs text-[var(--text-secondary)]" role="status">
            Loading integrations…
          </p>
        ) : providers.isError ? (
          <div className="flex items-center justify-between gap-3" role="alert">
            <p className="text-xs text-[var(--danger)]">
              Integration status is unavailable. Check your connection, then retry.
            </p>
            <Button onClick={() => void providers.refetch()} size="compact">
              Retry
            </Button>
          </div>
        ) : Object.keys(providers.data ?? {}).length ? (
          <div className="divide-y divide-[var(--border-subtle)] border-y border-[var(--border)]">
            {Object.entries(providers.data ?? {}).map(([name, provider]) => (
              <div className="flex min-h-12 items-center justify-between px-2" key={name}>
                <span className="text-[13px] capitalize">{name}</span>
                <StatusBadge
                  label={provider.enabled ? "Configured" : "Disabled"}
                  tone={provider.enabled ? "success" : "neutral"}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[var(--text-secondary)]">
            No integration providers available.
          </p>
        )}
      </SettingsSection>
    </div>
  );
}
