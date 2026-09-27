"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button, Note } from "@authometry/ui";
import { Breadcrumbs, PageContainer, PageHeader } from "@/components/layout/page";
import { Card, CardFooter, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { apiFetch } from "@/lib/api";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";

export default function NewScopePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string>();
  const [preview, setPreview] = useState({ name: "", consent: "" });
  useUnsavedChanges(dirty && !loading);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(undefined);
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
      setDirty(false);
      toast.success("Scope created.");
      router.push("/scopes");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The scope could not be created.");
      setLoading(false);
    }
  }
  return (
    <PageContainer size="settings">
      <Breadcrumbs items={[{ label: "Scopes", href: "/scopes" }, { label: "New" }]} />
      <PageHeader
        description="Define a permission applications can request."
        title="Create scope"
      />
      <form
        autoComplete="off"
        className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]"
        onChange={(event) => {
          setDirty(true);
          const form = event.currentTarget;
          const data = new FormData(form);
          setPreview({
            name: String(data.get("name") ?? ""),
            consent: String(data.get("consentDescription") ?? ""),
          });
        }}
        onSubmit={submit}
      >
        <Card>
          <CardHeader
            description="The scope value is a stable protocol identifier and cannot be renamed later."
            title="Definition"
          />
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
            <Field description="Letters, numbers, and . _ : -" label="Scope value">
              <Input
                autoFocus
                mono
                name="name"
                pattern="[a-zA-Z0-9._:-]+"
                placeholder="orders:read"
                required
                spellCheck={false}
              />
            </Field>
            <Field label="Display name">
              <Input minLength={2} name="displayName" placeholder="Read orders" required />
            </Field>
            <Field
              className="sm:col-span-2"
              description="For developers and admins."
              label="Description"
            >
              <Textarea minLength={2} name="description" required rows={3} />
            </Field>
            <Field
              className="sm:col-span-2"
              description="What people read on the consent screen."
              label="Consent description"
            >
              <Input
                minLength={2}
                name="consentDescription"
                placeholder="View your orders"
                required
              />
            </Field>
            <Field
              className="sm:col-span-2"
              description="Sensitive and restricted scopes are highlighted during consent."
              label="Sensitivity"
            >
              <Select defaultValue="standard" name="sensitivity">
                <option value="standard">Standard</option>
                <option value="sensitive">Sensitive</option>
                <option value="restricted">Restricted</option>
              </Select>
            </Field>
            {error && (
              <Note className="sm:col-span-2" role="alert" tone="danger">
                {error}
              </Note>
            )}
          </div>
          <CardFooter>
            <Button asChild variant="ghost">
              <Link href="/scopes">Cancel</Link>
            </Button>
            <Button loading={loading} type="submit" variant="primary">
              {loading ? "Creating…" : "Create scope"}
            </Button>
          </CardFooter>
        </Card>
        <aside className="lg:sticky lg:top-6">
          <p className="mb-2 text-xs font-medium text-[var(--text-secondary)]">Consent preview</p>
          <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
            <p className="text-[13px] font-medium">Example App wants to:</p>
            <ul className="mt-3 space-y-2">
              <li className="flex items-start gap-2 text-[13px]">
                <Check aria-hidden="true" className="mt-0.5 size-3.5 text-[var(--success)]" />
                <span className="min-w-0">
                  <span className="block">
                    {preview.consent || (
                      <span className="text-[var(--text-tertiary)]">Consent description</span>
                    )}
                  </span>
                  <code className="technical-value text-[var(--text-tertiary)]">
                    {preview.name || "scope:value"}
                  </code>
                </span>
              </li>
            </ul>
          </div>
        </aside>
      </form>
    </PageContainer>
  );
}
