"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Pencil, Plus, SearchX } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button, EmptyState, Note, StatusBadge, type StatusTone } from "@authometry/ui";
import { FilterBar, SearchInput } from "@/components/data-display/search-input";
import { ErrorState, ListSkeleton } from "@/components/data-display/states";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { Modal } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Table, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch } from "@/lib/api";
import { humanize } from "@/lib/status";

interface Scope {
  id: string;
  name: string;
  display_name: string;
  description: string;
  consent_description?: string;
  sensitivity: string;
  is_system: boolean;
  application_count: number;
  ownership: string;
  version: number;
}

const sensitivityTone: Record<string, StatusTone> = {
  standard: "neutral",
  sensitive: "warning",
  restricted: "danger",
};

function EditScopeDialog({ scope, onClose }: { scope: Scope | undefined; onClose: () => void }) {
  const client = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!scope) return;
    const data = new FormData(event.currentTarget);
    setSaving(true);
    setError(undefined);
    try {
      await apiFetch(`/api/v1/scopes/${scope.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          displayName: data.get("displayName"),
          description: data.get("description"),
          consentDescription: data.get("consentDescription"),
          sensitivity: data.get("sensitivity"),
          version: scope.version,
        }),
      });
      await client.invalidateQueries({ queryKey: ["scopes"] });
      toast.success(`${scope.name} updated.`);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The scope could not be saved.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal
      description={
        scope ? (
          <>
            Editing <code className="technical-value">{scope.name}</code>. The scope value itself
            cannot change.
          </>
        ) : undefined
      }
      footer={
        <>
          <Button disabled={saving} onClick={onClose}>
            Cancel
          </Button>
          <Button form="edit-scope-form" loading={saving} type="submit" variant="primary">
            Save scope
          </Button>
        </>
      }
      onOpenChange={(open) => {
        if (!open) {
          setError(undefined);
          onClose();
        }
      }}
      open={Boolean(scope)}
      preventClose={saving}
      title="Edit scope"
    >
      {scope && (
        <form className="space-y-4" id="edit-scope-form" key={scope.id} onSubmit={submit}>
          <Field label="Display name">
            <Input
              defaultValue={scope.display_name}
              maxLength={100}
              minLength={2}
              name="displayName"
              required
            />
          </Field>
          <Field label="Description">
            <Textarea
              defaultValue={scope.description}
              maxLength={500}
              minLength={2}
              name="description"
              required
              rows={3}
            />
          </Field>
          <Field description="Shown on the consent screen." label="Consent description">
            <Input
              defaultValue={scope.consent_description ?? ""}
              maxLength={200}
              minLength={2}
              name="consentDescription"
              required
            />
          </Field>
          <Field label="Sensitivity">
            <Select defaultValue={scope.sensitivity} name="sensitivity">
              <option value="standard">Standard</option>
              <option value="sensitive">Sensitive</option>
              <option value="restricted">Restricted</option>
            </Select>
          </Field>
          {error && (
            <Note role="alert" tone="danger">
              {error}
            </Note>
          )}
        </form>
      )}
    </Modal>
  );
}

export default function ScopesPage() {
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<Scope>();
  const query = useQuery({
    queryKey: ["scopes"],
    queryFn: () => apiFetch<{ data: Scope[] }>("/api/v1/scopes"),
  });
  const needle = filter.trim().toLowerCase();
  const all = query.data?.data ?? [];
  const rows = all.filter(
    (scope) =>
      !needle ||
      scope.name.toLowerCase().includes(needle) ||
      scope.display_name.toLowerCase().includes(needle) ||
      scope.description.toLowerCase().includes(needle),
  );
  return (
    <PageContainer>
      <PageHeader
        actions={
          <Button asChild variant="primary">
            <Link href="/scopes/new">
              <Plus aria-hidden="true" className="size-3.5" /> Create scope
            </Link>
          </Button>
        }
        description="Permissions applications can request, and what people see when they consent."
        title="Scopes"
      />
      <FilterBar>
        <SearchInput
          className="sm:w-72"
          onChange={(event) => setFilter(event.target.value)}
          onClear={() => setFilter("")}
          placeholder="Filter scopes…"
          value={filter}
        />
      </FilterBar>
      {query.isLoading ? (
        <ListSkeleton />
      ) : query.isError ? (
        <ErrorState
          description="Authometry could not load scopes. Check your connection, then retry."
          headingLevel="h2"
          onRetry={() => void query.refetch()}
          title="Unable to load scopes"
        />
      ) : rows.length ? (
        <Table columns="minmax(160px,0.8fr) minmax(220px,1.4fr) 110px 110px 48px" label="Scopes">
          <TableHeader>
            <span>Scope</span>
            <span>Description</span>
            <span>Sensitivity</span>
            <span className="text-right">Apps</span>
            <span />
          </TableHeader>
          <div className="stagger">
            {rows.map((scope) => {
              const editable = !scope.is_system && scope.ownership !== "manifest";
              return (
                <TableRow key={scope.id} mobileColumns="minmax(0,1fr) auto">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="technical-value font-medium text-[var(--text-primary)]">
                        {scope.name}
                      </code>
                      {scope.is_system && <StatusBadge label="System" tone="info" />}
                      {scope.ownership === "manifest" && <StatusBadge label="Git" tone="neutral" />}
                    </div>
                    <p className="truncate text-xs text-[var(--text-secondary)]">
                      {scope.display_name}
                    </p>
                  </div>
                  <p className="hidden text-[13px] text-[var(--text-secondary)] lg:block">
                    {scope.description}
                  </p>
                  <span className="hidden lg:block">
                    <StatusBadge
                      label={humanize(scope.sensitivity)}
                      tone={sensitivityTone[scope.sensitivity] ?? "neutral"}
                    />
                  </span>
                  <span className="hidden text-right text-[13px] text-[var(--text-secondary)] tabular-nums lg:block">
                    {scope.application_count}
                  </span>
                  <span className="flex justify-end">
                    {editable && (
                      <Button
                        aria-label={`Edit ${scope.name}`}
                        onClick={() => setEditing(scope)}
                        size="icon-compact"
                        variant="ghost"
                      >
                        <Pencil aria-hidden="true" className="size-3.5" />
                      </Button>
                    )}
                  </span>
                </TableRow>
              );
            })}
          </div>
        </Table>
      ) : (
        <EmptyState
          description={
            all.length
              ? "No scopes match this filter."
              : "Create a custom scope when your API needs permissions beyond the standard OpenID Connect scopes."
          }
          icon={all.length ? SearchX : KeyRound}
          primaryAction={
            all.length ? (
              <Button onClick={() => setFilter("")}>Clear filter</Button>
            ) : (
              <Button asChild variant="primary">
                <Link href="/scopes/new">Create scope</Link>
              </Button>
            )
          }
          title={all.length ? "No matching scopes" : "No scopes yet"}
        />
      )}
      <EditScopeDialog onClose={() => setEditing(undefined)} scope={editing} />
    </PageContainer>
  );
}
