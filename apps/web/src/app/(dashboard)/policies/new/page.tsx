"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button, Note } from "@authometry/ui";
import { Breadcrumbs, PageContainer, PageHeader } from "@/components/layout/page";
import {
  PolicyEditor,
  PolicyTester,
  serializeCondition,
  type PolicyDraft,
  type TestContext,
} from "@/components/policies/policy-editor";
import { Field, Input } from "@/components/ui/form";
import { apiFetch } from "@/lib/api";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";

function toIdentifier(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

export default function NewPolicyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string>();
  const [name, setName] = useState("");
  const [nameEdited, setNameEdited] = useState(false);
  const [draft, setDraft] = useState<PolicyDraft>({
    displayName: "",
    description: "",
    enabled: true,
    applicationIds: [],
    conditions: [{ field: "user.groups", operator: "contains", value: "" }],
    message: "This account does not meet the authorization policy.",
  });
  const [context, setContext] = useState<TestContext>({
    groups: "engineering",
    email: "ada@example.com",
    environment: "production",
    applicationType: "web",
    applicationSlug: "",
    scopes: "openid, profile",
  });
  useUnsavedChanges(dirty && !loading);
  function change(next: PolicyDraft) {
    setDirty(true);
    if (!nameEdited && next.displayName !== draft.displayName)
      setName(toIdentifier(next.displayName));
    setDraft(next);
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(undefined);
    try {
      const result = await apiFetch<{ id: string }>("/api/v1/policies", {
        method: "POST",
        body: JSON.stringify({
          name,
          displayName: draft.displayName.trim(),
          description: draft.description.trim(),
          enabled: draft.enabled,
          applicationIds: draft.applicationIds,
          conditions: { all: draft.conditions.map(serializeCondition) },
          otherwise: { deny: { code: "policy_denied", message: draft.message.trim() } },
        }),
      });
      setDirty(false);
      toast.success("Policy created.");
      router.push(`/policies/${result.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The policy could not be created.");
      setLoading(false);
    }
  }
  return (
    <PageContainer>
      <Breadcrumbs items={[{ label: "Policies", href: "/policies" }, { label: "New" }]} />
      <PageHeader
        description="An explicit rule evaluated before an authorization code is issued."
        title="Create policy"
      />
      <form
        autoComplete="off"
        className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]"
        onSubmit={submit}
      >
        <div className="space-y-6">
          <PolicyEditor
            draft={draft}
            identifier={
              <Field description="Lowercase letters, numbers, and hyphens." label="Identifier">
                <Input
                  mono
                  onChange={(event) => {
                    setNameEdited(true);
                    setName(event.target.value);
                    setDirty(true);
                  }}
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  placeholder="production-admins"
                  required
                  spellCheck={false}
                  value={name}
                />
              </Field>
            }
            onChange={change}
          />
          {error && (
            <Note role="alert" tone="danger">
              {error}
            </Note>
          )}
          <div className="flex flex-col-reverse gap-2 border-t border-[var(--border)] pt-5 sm:flex-row sm:justify-end">
            <Button asChild variant="ghost">
              <Link href="/policies">Cancel</Link>
            </Button>
            <Button loading={loading} type="submit" variant="primary">
              {loading ? "Creating…" : "Create policy"}
            </Button>
          </div>
        </div>
        <aside className="lg:sticky lg:top-6">
          <PolicyTester
            conditions={draft.conditions}
            context={context}
            message={draft.message}
            onChange={setContext}
          />
        </aside>
      </form>
    </PageContainer>
  );
}
