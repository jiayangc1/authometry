"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@authometry/ui";
import { inputClass } from "@/components/auth/auth-shell";
import { PageContainer, PageHeader, SectionHeader } from "@/components/layout/page";
import { GroupChipInput } from "@/components/users/group-chip-input";
import { apiFetch } from "@/lib/api";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";

export default function NewUserPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [groups, setGroups] = useState<string[]>([]);
  useUnsavedChanges(dirty && !loading);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const data = new FormData(event.currentTarget);
    try {
      const user = await apiFetch<{ id: string }>("/api/v1/users", {
        method: "POST",
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          password: data.get("password"),
          groups,
        }),
      });
      toast.success("User created");
      router.push(`/users/${user.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "User creation failed");
      setLoading(false);
    }
  }
  return (
    <PageContainer size="settings">
      <PageHeader
        description="Create a local identity with a one-time initial password."
        title="Add User"
      />
      <form className="space-y-7" onChange={() => setDirty(true)} onSubmit={submit}>
        <section>
          <SectionHeader title="Identity" />
          <div className="grid gap-4">
            <label>
              <span className="mb-1.5 block text-xs font-medium">Name</span>
              <input autoComplete="name" className={inputClass} name="name" required />
            </label>
            <label>
              <span className="mb-1.5 block text-xs font-medium">Email</span>
              <input
                autoComplete="email"
                className={inputClass}
                name="email"
                required
                spellCheck={false}
                type="email"
              />
            </label>
            <label>
              <span className="mb-1.5 block text-xs font-medium">Initial password</span>
              <input
                autoComplete="new-password"
                className={inputClass}
                minLength={12}
                name="password"
                required
                type="password"
              />
              <span className="mt-1 block text-xs text-[var(--text-tertiary)]">
                Share through a secure channel and require the user to reset it.
              </span>
            </label>
            <div>
              <span className="mb-1.5 block text-xs font-medium">Groups</span>
              <GroupChipInput
                disabled={loading}
                groups={groups}
                onChange={(nextGroups) => {
                  setGroups(nextGroups);
                  setDirty(true);
                }}
              />
              <span className="mt-1.5 block text-xs text-[var(--text-tertiary)]">
                Type a group name and press Enter. Select a bubble’s × to remove it.
              </span>
            </div>
          </div>
        </section>
        <div className="flex justify-end gap-2">
          <Button onClick={() => router.back()} type="button" variant="ghost">
            Cancel
          </Button>
          <Button disabled={loading} type="submit" variant="primary">
            {loading ? "Creating…" : "Create User"}
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}
