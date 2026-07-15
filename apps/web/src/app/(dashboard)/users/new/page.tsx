"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@authometry/ui";
import { inputClass } from "@/components/auth/auth-shell";
import { PageContainer, PageHeader, SectionHeader } from "@/components/layout/page";
import { apiFetch } from "@/lib/api";

export default function NewUserPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const data = new FormData(event.currentTarget);
    const groupValue = data.get("groups");
    const groups =
      typeof groupValue === "string"
        ? groupValue
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
        : [];
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
        title="Add user"
      />
      <form className="space-y-7" onSubmit={submit}>
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
            <label>
              <span className="mb-1.5 block text-xs font-medium">Groups</span>
              <input className={inputClass} name="groups" placeholder="engineering, admin" />
            </label>
          </div>
        </section>
        <div className="flex justify-end gap-2">
          <Button onClick={() => router.back()} type="button" variant="ghost">
            Cancel
          </Button>
          <Button disabled={loading} type="submit" variant="primary">
            {loading ? "Creating…" : "Create user"}
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}
