"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button, Checkbox, EmptyState, StatusBadge } from "@authometry/ui";
import { useApplication } from "@/components/applications/application-context";
import { ErrorState, PageSkeleton } from "@/components/data-display/states";
import { SectionHeader } from "@/components/layout/page";
import { apiFetch } from "@/lib/api";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";

interface ScopeRow {
  id: string;
  name: string;
  display_name: string;
  description: string;
  sensitivity: string;
  is_system: boolean;
}

export default function ApplicationScopesPage() {
  const { application, refetch } = useApplication();
  const scopes = useQuery({
    queryKey: ["scopes"],
    queryFn: () => apiFetch<{ data: ScopeRow[] }>("/api/v1/scopes"),
  });
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<string[]>();
  const [saving, setSaving] = useState(false);
  const values = selected ?? application?.allowed_scopes ?? [];
  const dirty = Boolean(
    editing &&
    application &&
    JSON.stringify([...values].sort()) !== JSON.stringify([...application.allowed_scopes].sort()),
  );
  useUnsavedChanges(dirty);
  if (!application) return null;
  const app = application;
  async function save() {
    setSaving(true);
    try {
      await apiFetch(`/api/v1/applications/${app.id}`, {
        method: "PATCH",
        body: JSON.stringify({ allowedScopes: values, version: app.version }),
      });
      await refetch();
      setEditing(false);
      setSelected(undefined);
      toast.success("Application scopes saved.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <section>
      <SectionHeader
        actions={
          <Button
            onClick={() => {
              if (editing) {
                setEditing(false);
                setSelected(undefined);
              } else {
                setSelected([...application.allowed_scopes]);
                setEditing(true);
              }
            }}
          >
            {editing ? "Cancel" : "Manage Scopes"}
          </Button>
        }
        description="Permissions this application may request during authorization."
        title="Assigned Scopes"
      />
      {scopes.isLoading ? (
        <PageSkeleton rows={5} />
      ) : scopes.isError ? (
        <ErrorState
          description="Authometry could not load available scopes. Check your connection, then retry."
          headingLevel="h3"
          onRetry={() => void scopes.refetch()}
          title="Unable to Load Scopes"
        />
      ) : scopes.data?.data.some((scope) => editing || values.includes(scope.name)) ? (
        <div className="border-y border-[var(--border)]">
          {scopes.data.data.map((scope) => {
            const checked = values.includes(scope.name);
            if (!editing && !checked) return null;
            return (
              <label
                className="flex min-h-14 items-center gap-3 border-b border-[var(--border-subtle)] px-2 py-2.5 last:border-0"
                key={scope.id}
              >
                {editing && (
                  <Checkbox
                    checked={checked}
                    disabled={scope.name === "openid"}
                    onChange={(event) =>
                      setSelected(
                        event.target.checked
                          ? [...values, scope.name]
                          : values.filter((value) => value !== scope.name),
                      )
                    }
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <code className="technical-value font-medium">{scope.name}</code>
                    {scope.name === "openid" && <StatusBadge label="Required" tone="info" />}
                    {scope.sensitivity !== "standard" && (
                      <StatusBadge label={scope.sensitivity} tone="warning" />
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{scope.description}</p>
                </div>
              </label>
            );
          })}
        </div>
      ) : (
        <EmptyState
          description="Choose Manage Scopes to assign permissions to this application."
          headingLevel="h3"
          title="No Assigned Scopes"
        />
      )}
      {editing && (
        <div className="mt-4 flex justify-end">
          <Button disabled={!dirty || saving} onClick={() => void save()} variant="primary">
            {saving ? "Saving…" : "Save Scopes"}
          </Button>
        </div>
      )}
    </section>
  );
}
