"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button, StatusBadge } from "@authometry/ui";
import { useApplication } from "@/components/applications/application-context";
import { SectionHeader } from "@/components/layout/page";
import { apiFetch } from "@/lib/api";

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
  if (!application) return null;
  const app = application;
  const values = selected ?? app.allowed_scopes;
  async function save() {
    await apiFetch(`/api/v1/applications/${app.id}`, {
      method: "PATCH",
      body: JSON.stringify({ allowedScopes: values, version: app.version }),
    });
    await refetch();
    setEditing(false);
    setSelected(undefined);
    toast.success("Application scopes saved.");
  }
  return (
    <section>
      <SectionHeader
        actions={
          <Button
            onClick={() => {
              setSelected(application.allowed_scopes);
              setEditing(!editing);
            }}
          >
            {editing ? "Cancel" : "Manage scopes"}
          </Button>
        }
        description="Permissions this application may request during authorization."
        title="Assigned scopes"
      />
      <div className="border-y border-[var(--border)]">
        {scopes.data?.data.map((scope) => {
          const checked = values.includes(scope.name);
          if (!editing && !checked) return null;
          return (
            <label
              className="flex min-h-14 items-center gap-3 border-b border-[var(--border-subtle)] px-2 py-2.5 last:border-0"
              key={scope.id}
            >
              {editing && (
                <input
                  checked={checked}
                  disabled={scope.name === "openid"}
                  onChange={(event) =>
                    setSelected(
                      event.target.checked
                        ? [...values, scope.name]
                        : values.filter((value) => value !== scope.name),
                    )
                  }
                  type="checkbox"
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
      {editing && (
        <div className="mt-4 flex justify-end">
          <Button onClick={() => void save()} variant="primary">
            Save scopes
          </Button>
        </div>
      )}
    </section>
  );
}
