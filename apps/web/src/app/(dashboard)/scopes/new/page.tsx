"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@authometry/ui";
import { inputClass } from "@/components/auth/auth-shell";
import { PageContainer, PageHeader, SectionHeader } from "@/components/layout/page";
import { apiFetch } from "@/lib/api";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";

export default function NewScopePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  useUnsavedChanges(dirty && !loading);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const data = new FormData(event.currentTarget);
    try {
      await apiFetch("/api/v1/scopes", {
        method: "POST",
        body: JSON.stringify({
          name: data.get("name"),
          displayName: data.get("displayName"),
          description: data.get("description"),
          consentDescription: data.get("consentDescription"),
          sensitivity: data.get("sensitivity"),
        }),
      });
      toast.success("Scope created");
      router.push("/scopes");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Scope creation failed");
      setLoading(false);
    }
  }
  return (
    <PageContainer size="settings">
      <PageHeader description="Create a permission applications can request." title="New Scope" />
      <form
        autoComplete="off"
        className="space-y-7"
        onChange={() => setDirty(true)}
        onSubmit={submit}
      >
        <section>
          <SectionHeader
            description="Scope values are stable protocol identifiers and cannot be renamed."
            title="Definition"
          />
          <div className="grid gap-4">
            <label>
              <span className="mb-1.5 block text-xs font-medium">Scope value</span>
              <input
                autoComplete="off"
                className={`${inputClass} technical-value`}
                name="name"
                pattern="[a-zA-Z0-9._:-]+"
                placeholder="orders:read…"
                required
                spellCheck={false}
              />
            </label>
            <label>
              <span className="mb-1.5 block text-xs font-medium">Display name</span>
              <input
                autoComplete="off"
                className={inputClass}
                name="displayName"
                placeholder="Read orders…"
                required
              />
            </label>
            <label>
              <span className="mb-1.5 block text-xs font-medium">Description</span>
              <textarea
                autoComplete="off"
                className={inputClass}
                name="description"
                required
                rows={3}
              />
            </label>
            <label>
              <span className="mb-1.5 block text-xs font-medium">Consent description</span>
              <input
                className={inputClass}
                autoComplete="off"
                name="consentDescription"
                placeholder="View your orders…"
                required
              />
            </label>
            <label>
              <span className="mb-1.5 block text-xs font-medium">Sensitivity</span>
              <select className={inputClass} defaultValue="standard" name="sensitivity">
                <option value="standard">Standard</option>
                <option value="sensitive">Sensitive</option>
                <option value="restricted">Restricted</option>
              </select>
            </label>
          </div>
        </section>
        <div className="flex justify-end gap-2">
          <Button onClick={() => router.back()} type="button" variant="ghost">
            Cancel
          </Button>
          <Button disabled={loading} type="submit" variant="primary">
            {loading ? "Creating…" : "Create Scope"}
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}
