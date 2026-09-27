"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GitBranch } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button, Note, StatusBadge, cn } from "@authometry/ui";
import { ErrorState, PageSkeleton } from "@/components/data-display/states";
import { Breadcrumbs, PageContainer, PageHeader } from "@/components/layout/page";
import {
  PolicyEditor,
  PolicyTester,
  deserializeCondition,
  serializeCondition,
  type Operator,
  type PolicyDraft,
  type TestContext,
} from "@/components/policies/policy-editor";
import { apiFetch } from "@/lib/api";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";

interface Policy {
  id: string;
  name: string;
  display_name: string;
  description: string;
  enabled: boolean;
  application_ids: string[];
  conditions: { all: Array<{ field: string; operator: Operator; value: unknown }> };
  decision: { otherwise: { deny: { message: string } } };
  ownership: string;
  manifest_path?: string;
  version: number;
}

function toDraft(policy: Policy): PolicyDraft {
  return {
    displayName: policy.display_name,
    description: policy.description ?? "",
    enabled: policy.enabled,
    applicationIds: policy.application_ids ?? [],
    conditions: (policy.conditions.all ?? []).map(deserializeCondition),
    message: policy.decision?.otherwise?.deny?.message ?? "",
  };
}

export default function PolicyDetailPage() {
  const id = String(useParams().policyId);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["policy", id],
    queryFn: () => apiFetch<Policy>(`/api/v1/policies/${id}`),
  });
  const [edits, setEdits] = useState<PolicyDraft>();
  const [context, setContext] = useState<TestContext>({
    groups: "engineering",
    email: "ada@example.com",
    environment: "production",
    applicationType: "web",
    applicationSlug: "",
    scopes: "openid, profile",
  });
  const original = query.data ? toDraft(query.data) : undefined;
  const draft = edits ?? original;
  const dirty = Boolean(edits && original && JSON.stringify(edits) !== JSON.stringify(original));
  useUnsavedChanges(dirty);
  const save = useMutation({
    mutationFn: (next: PolicyDraft) =>
      apiFetch(`/api/v1/policies/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          version: query.data!.version,
          displayName: next.displayName.trim(),
          description: next.description.trim(),
          enabled: next.enabled,
          applicationIds: next.applicationIds,
          conditions: { all: next.conditions.map(serializeCondition) },
          otherwise: { deny: { code: "policy_denied", message: next.message.trim() } },
        }),
      }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["policy", id] }),
        client.invalidateQueries({ queryKey: ["policies"] }),
      ]);
      setEdits(undefined);
      toast.success("Policy saved.");
    },
    onError: (error) => toast.error(error.message),
  });
  if (query.isLoading)
    return (
      <PageContainer>
        <PageSkeleton metrics={false} />
      </PageContainer>
    );
  if (!query.data || !draft)
    return (
      <PageContainer>
        <Breadcrumbs items={[{ label: "Policies", href: "/policies" }, { label: "Not found" }]} />
        <ErrorState
          description="This policy may have been deleted or belong to another environment."
          onRetry={() => void query.refetch()}
          title="Unable to load policy"
        />
      </PageContainer>
    );
  const policy = query.data;
  const managed = policy.ownership === "manifest";
  return (
    <PageContainer>
      <Breadcrumbs
        items={[{ label: "Policies", href: "/policies" }, { label: policy.display_name }]}
      />
      <PageHeader
        badges={
          <>
            <StatusBadge
              label={policy.enabled ? "Enforced" : "Disabled"}
              tone={policy.enabled ? "success" : "neutral"}
            />
            {managed && <StatusBadge label="Managed by Git" tone="info" />}
          </>
        }
        description={<code className="technical-value">{policy.name}</code>}
        title={policy.display_name}
      />
      {managed && (
        <Note className="mb-6" icon={GitBranch} tone="info">
          This policy is managed in <code className="technical-value">{policy.manifest_path}</code>.
          Edit the manifest to change it.
        </Note>
      )}
      <form
        className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]"
        onSubmit={(event) => {
          event.preventDefault();
          if (dirty) save.mutate(draft);
        }}
      >
        <PolicyEditor draft={draft} onChange={setEdits} readOnly={managed} />
        <aside className="lg:sticky lg:top-6">
          <PolicyTester
            conditions={draft.conditions}
            context={context}
            message={draft.message}
            onChange={setContext}
          />
        </aside>
        {!managed && (
          <div
            aria-label="Save policy"
            className={cn(
              "sticky bottom-4 z-10 flex items-center gap-3 rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface-raised)] py-2 pr-2 pl-4 shadow-[var(--shadow-menu)] transition-[opacity,transform] duration-[var(--motion-normal)] ease-[var(--ease-out)] lg:col-span-2",
              dirty ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
            )}
            role="region"
          >
            <span className="mr-auto text-[13px] text-[var(--text-secondary)]">
              You have unsaved policy changes.
            </span>
            <Button
              disabled={save.isPending}
              onClick={() => setEdits(undefined)}
              type="button"
              variant="ghost"
            >
              Reset
            </Button>
            <Button loading={save.isPending} type="submit" variant="primary">
              {save.isPending ? "Saving…" : "Save policy"}
            </Button>
          </div>
        )}
      </form>
    </PageContainer>
  );
}
