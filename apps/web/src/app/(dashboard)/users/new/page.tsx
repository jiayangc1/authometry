"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button, Note } from "@authometry/ui";
import { Breadcrumbs, PageContainer, PageHeader } from "@/components/layout/page";
import { Card, CardFooter, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { GroupChipInput } from "@/components/users/group-chip-input";
import { apiFetch } from "@/lib/api";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";

export default function NewUserPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string>();
  const [groups, setGroups] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  useUnsavedChanges(dirty && !loading);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(undefined);
    const data = new FormData(event.currentTarget);
    try {
      const user = await apiFetch<{ id: string }>("/api/v1/users", {
        method: "POST",
        body: JSON.stringify({
          name: String(data.get("name") ?? "").trim(),
          email: String(data.get("email") ?? "").trim(),
          password: data.get("password"),
          groups,
        }),
      });
      setDirty(false);
      toast.success("User created.");
      router.push(`/users/${user.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The user could not be created.");
      setLoading(false);
    }
  }
  return (
    <PageContainer size="narrow">
      <Breadcrumbs items={[{ label: "Users", href: "/users" }, { label: "New" }]} />
      <PageHeader
        description="Create a local identity with a one-time initial password."
        title="Add user"
      />
      <form onChange={() => setDirty(true)} onSubmit={submit}>
        <Card>
          <CardHeader title="Identity" description="The user can change these after signing in." />
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
            <Field label="Name">
              <Input autoComplete="off" autoFocus name="name" placeholder="Ada Lovelace" required />
            </Field>
            <Field label="Email">
              <Input
                autoComplete="off"
                name="email"
                placeholder="ada@example.com"
                required
                spellCheck={false}
                type="email"
              />
            </Field>
            <Field
              className="sm:col-span-2"
              description="At least 12 characters. Share it through a secure channel and ask the user to change it."
              label="Initial password"
              labelAction={
                <button
                  className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  onClick={() => setShowPassword((value) => !value)}
                  type="button"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              }
            >
              <Input
                autoComplete="new-password"
                minLength={12}
                mono={showPassword}
                name="password"
                required
                type={showPassword ? "text" : "password"}
              />
            </Field>
            <Field
              className="sm:col-span-2"
              description="Groups grant access to portal applications. Press Enter or comma to add each one."
              label="Groups"
              optional
            >
              <GroupChipInput
                disabled={loading}
                groups={groups}
                onChange={(nextGroups) => {
                  setGroups(nextGroups);
                  setDirty(true);
                }}
              />
            </Field>
            {error && (
              <Note className="sm:col-span-2" role="alert" tone="danger">
                {error}
              </Note>
            )}
          </div>
          <CardFooter>
            <Button asChild variant="ghost">
              <Link href="/users">Cancel</Link>
            </Button>
            <Button loading={loading} type="submit" variant="primary">
              {loading ? "Creating…" : "Create user"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </PageContainer>
  );
}
