"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Button, Note, StatusBadge } from "@authometry/ui";
import { Snippet } from "@/components/data-display/copyable-value";
import { ErrorState, ListSkeleton } from "@/components/data-display/states";
import { SettingsSection } from "@/components/settings/settings-section";
import { Field, Input } from "@/components/ui/form";
import { apiFetch } from "@/lib/api";
import { humanize } from "@/lib/status";
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
      await Promise.all([
        client.invalidateQueries({ queryKey: ["settings-general"] }),
        client.invalidateQueries({ queryKey: ["me"] }),
        client.invalidateQueries({ queryKey: ["environments"] }),
      ]);
      toast.success("Settings saved.");
    },
    onError: (error) => toast.error(error.message),
  });
  if (query.isLoading) return <ListSkeleton rows={4} />;
  if (query.isError)
    return (
      <ErrorState
        description="Authometry could not load general settings. Check your connection, then retry."
        headingLevel="h2"
        onRetry={() => void query.refetch()}
        title="Unable to load general settings"
      />
    );
  return (
    <>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (isDirty) save.mutate();
        }}
      >
        <SettingsSection
          description="Shown throughout the dashboard and on authorization screens."
          footer={
            <>
              {isDirty && (
                <Button
                  disabled={save.isPending}
                  onClick={() => {
                    setWorkspaceName(query.data?.name ?? "");
                    setEnvironmentName(query.data?.environment_name ?? "");
                  }}
                  type="button"
                  variant="ghost"
                >
                  Reset
                </Button>
              )}
              <Button disabled={!isDirty} loading={save.isPending} type="submit" variant="primary">
                Save
              </Button>
            </>
          }
          footerHint={isDirty ? "You have unsaved changes." : "Names can be changed at any time."}
          title="Workspace"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Workspace name">
              <Input
                autoComplete="off"
                maxLength={100}
                name="workspaceName"
                onChange={(event) => setWorkspaceName(event.target.value)}
                required
                value={workspaceName}
              />
            </Field>
            <Field
              description="Applies to the environment you’re viewing."
              label="Environment name"
            >
              <Input
                autoComplete="off"
                maxLength={100}
                name="environmentName"
                onChange={(event) => setEnvironmentName(event.target.value)}
                required
                value={environmentName}
              />
            </Field>
          </div>
        </SettingsSection>
      </form>
      <SettingsSection
        description="The issuer identifies tokens and discovery metadata for this environment."
        footerHint={
          <>
            Change it by activating a{" "}
            <Link
              className="underline underline-offset-2 hover:text-[var(--text-primary)]"
              href="/settings/domains"
            >
              verified domain
            </Link>{" "}
            or through an AuthometryInstance manifest.
          </>
        }
        title="Issuer URL"
      >
        <Snippet label="issuer" value={query.data?.issuer ?? ""} />
      </SettingsSection>
      <SettingsSection
        description="Social sign-in and email delivery stay off until their runtime credentials are configured."
        title="Integrations"
      >
        {providers.isLoading ? (
          <ListSkeleton rows={3} />
        ) : providers.isError ? (
          <Note
            action={
              <Button onClick={() => void providers.refetch()} size="compact">
                Retry
              </Button>
            }
            tone="danger"
          >
            Integration status is unavailable.
          </Note>
        ) : Object.keys(providers.data ?? {}).length ? (
          <ul className="divide-y divide-[var(--border)] rounded-[var(--radius-control)] border border-[var(--border)]">
            {Object.entries(providers.data ?? {}).map(([name, provider]) => (
              <li className="flex min-h-11 items-center justify-between gap-3 px-3" key={name}>
                <span className="text-[13px]">{name === "github" ? "GitHub" : humanize(name)}</span>
                <StatusBadge
                  label={provider.enabled ? "Configured" : "Not configured"}
                  tone={provider.enabled ? "success" : "neutral"}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-[var(--text-secondary)]">
            No integration providers available.
          </p>
        )}
      </SettingsSection>
    </>
  );
}
