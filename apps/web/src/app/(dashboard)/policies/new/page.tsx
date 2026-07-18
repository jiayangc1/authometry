"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@authometry/ui";
import { inputClass } from "@/components/auth/auth-shell";
import { PageContainer, PageHeader, SectionHeader } from "@/components/layout/page";
import { apiFetch } from "@/lib/api";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";

export default function NewPolicyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  useUnsavedChanges(dirty && !loading);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const data = new FormData(event.currentTarget);
    try {
      const result = await apiFetch<{ id: string }>("/api/v1/policies", {
        method: "POST",
        body: JSON.stringify({
          name: data.get("name"),
          displayName: data.get("displayName"),
          description: data.get("description"),
          enabled: true,
          applicationIds: [],
          conditions: {
            all: [
              {
                field: data.get("field"),
                operator: data.get("operator"),
                value: data.get("value"),
              },
            ],
          },
          otherwise: { deny: { code: "policy_denied", message: data.get("message") } },
        }),
      });
      toast.success("Policy created");
      router.push(`/policies/${result.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Policy creation failed");
      setLoading(false);
    }
  }
  return (
    <PageContainer size="settings">
      <PageHeader
        description="Build an explicit rule that is evaluated before an authorization code is issued."
        title="New Policy"
      />
      <form
        autoComplete="off"
        className="space-y-7"
        onChange={() => setDirty(true)}
        onSubmit={submit}
      >
        <section>
          <SectionHeader title="Policy" />
          <div className="grid gap-4">
            <label>
              <span className="mb-1.5 block text-xs font-medium">Identifier</span>
              <input
                autoComplete="off"
                className={`${inputClass} technical-value`}
                name="name"
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                placeholder="production-admins…"
                required
                spellCheck={false}
              />
            </label>
            <label>
              <span className="mb-1.5 block text-xs font-medium">Display name</span>
              <input autoComplete="off" className={inputClass} name="displayName" required />
            </label>
            <label>
              <span className="mb-1.5 block text-xs font-medium">Description</span>
              <textarea autoComplete="off" className={inputClass} name="description" rows={2} />
            </label>
          </div>
        </section>
        <section>
          <SectionHeader description="All conditions must match." title="Decision" />
          <div className="grid gap-3 sm:grid-cols-3">
            <label>
              <span className="sr-only">Condition field</span>
              <select className={inputClass} defaultValue="user.groups" name="field">
                <option value="user.groups">User groups</option>
                <option value="user.email">User email</option>
                <option value="environment">Environment</option>
                <option value="application.type">Application type</option>
              </select>
            </label>
            <label>
              <span className="sr-only">Condition operator</span>
              <select className={inputClass} defaultValue="contains" name="operator">
                <option value="equals">equals</option>
                <option value="not_equals">does not equal</option>
                <option value="contains">contains</option>
                <option value="in">is in</option>
              </select>
            </label>
            <label>
              <span className="sr-only">Condition value</span>
              <input
                autoComplete="off"
                className={inputClass}
                name="value"
                placeholder="admin…"
                required
              />
            </label>
          </div>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-xs font-medium">Denial message</span>
            <input
              className={inputClass}
              autoComplete="off"
              defaultValue="This account does not meet the authorization policy."
              name="message"
              required
            />
          </label>
        </section>
        <div className="flex justify-end gap-2">
          <Button onClick={() => router.back()} type="button" variant="ghost">
            Cancel
          </Button>
          <Button disabled={loading} type="submit" variant="primary">
            {loading ? "Creating…" : "Create Policy"}
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}
