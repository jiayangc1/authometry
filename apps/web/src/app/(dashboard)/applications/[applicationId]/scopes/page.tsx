"use client";

import { useQuery } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button, Checkbox, EmptyState, StatusBadge, cn } from "@authometry/ui";
import { useApplication } from "@/components/applications/application-context";
import { ErrorState, ListSkeleton } from "@/components/data-display/states";
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
  const [selected, setSelected] = useState<string[]>();
  const [saving, setSaving] = useState(false);
  const values = selected ?? application?.allowed_scopes ?? [];
  const dirty = Boolean(
    application &&
    JSON.stringify([...values].sort()) !== JSON.stringify([...application.allowed_scopes].sort()),
  );
  useUnsavedChanges(dirty);
  if (!application) return null;
  const app = application;
  const readOnly = app.ownership === "manifest";
  async function save() {
    setSaving(true);
    try {
      await apiFetch(`/api/v1/applications/${app.id}`, {
        method: "PATCH",
        body: JSON.stringify({ allowedScopes: values, version: app.version }),
      });
      await refetch();
      setSelected(undefined);
      toast.success("Scopes saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Scopes could not be saved.");
    } finally {
      setSaving(false);
    }
  }
  function toggle(name: string, checked: boolean) {
    setSelected(checked ? [...values, name] : values.filter((value) => value !== name));
  }
  const list = scopes.data?.data ?? [];
  return (
    <section>
      <SectionHeader
        actions={
          <Button asChild size="compact" variant="ghost">
            <Link href="/scopes/new">Create scope</Link>
          </Button>
        }
        description={`Permissions this application may request. ${values.length} of ${list.length || "…"} selected.`}
        title="Allowed scopes"
      />
      {scopes.isLoading ? (
        <ListSkeleton rows={5} />
      ) : scopes.isError ? (
        <ErrorState
          description="Authometry could not load available scopes. Check your connection, then retry."
          headingLevel="h3"
          onRetry={() => void scopes.refetch()}
          title="Unable to load scopes"
        />
      ) : list.length === 0 ? (
        <EmptyState
          description="Create a scope to define a permission applications can request."
          headingLevel="h3"
          icon={KeyRound}
          primaryAction={
            <Button asChild variant="primary">
              <Link href="/scopes/new">Create scope</Link>
            </Button>
          }
          title="No scopes defined"
        />
      ) : (
        <ul className="stagger overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-raised)]">
          {list.map((scope) => {
            const checked = values.includes(scope.name);
            const locked = readOnly || scope.name === "openid";
            return (
              <li className="border-b border-[var(--border)] last:border-0" key={scope.id}>
                <label
                  className={cn(
                    "flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors duration-[var(--motion-fast)]",
                    locked ? "cursor-default" : "cursor-pointer hover:bg-[var(--surface-subtle)]",
                    checked && "bg-[var(--surface-subtle)]",
                  )}
                >
                  <Checkbox
                    checked={checked}
                    disabled={locked}
                    onChange={(event) => toggle(scope.name, event.target.checked)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="technical-value font-medium text-[var(--text-primary)]">
                        {scope.name}
                      </code>
                      {scope.name === "openid" && <StatusBadge label="Required" tone="info" />}
                      {scope.sensitivity !== "standard" && (
                        <StatusBadge
                          label={
                            scope.sensitivity.charAt(0).toUpperCase() + scope.sensitivity.slice(1)
                          }
                          tone="warning"
                        />
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                      {scope.description}
                    </p>
                  </div>
                </label>
              </li>
            );
          })}
        </ul>
      )}
      <div
        aria-label="Save scopes"
        className={cn(
          "sticky bottom-4 z-10 mt-6 flex items-center gap-3 rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface-raised)] py-2 pr-2 pl-4 shadow-[var(--shadow-menu)] transition-[opacity,transform] duration-[var(--motion-normal)] ease-[var(--ease-out)]",
          dirty ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
        )}
        role="region"
      >
        <span className="mr-auto text-[13px] text-[var(--text-secondary)]">
          You have unsaved scope changes.
        </span>
        <Button disabled={saving} onClick={() => setSelected(undefined)} variant="ghost">
          Reset
        </Button>
        <Button loading={saving} onClick={() => void save()} variant="primary">
          {saving ? "Saving…" : "Save scopes"}
        </Button>
      </div>
    </section>
  );
}
