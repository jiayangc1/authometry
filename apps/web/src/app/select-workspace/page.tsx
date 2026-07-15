"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button, StatusBadge } from "@authometry/ui";
import { AuthHeading, AuthShell, inputClass } from "@/components/auth/auth-shell";
import { apiFetch } from "@/lib/api";

interface Me {
  activeWorkspaceId: string;
  workspaces: Array<{ id: string; name: string; slug: string; role: string }>;
}
export default function SelectWorkspacePage() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const query = useQuery({ queryKey: ["me"], queryFn: () => apiFetch<Me>("/api/v1/auth/me") });
  async function select(workspaceId: string) {
    setLoading(true);
    await apiFetch("/api/v1/auth/switch-workspace", {
      method: "POST",
      body: JSON.stringify({ workspaceId }),
    });
    window.location.assign("/overview");
  }
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const data = new FormData(event.currentTarget);
    try {
      const result = await apiFetch<{ id: string }>("/api/v1/auth/workspaces", {
        method: "POST",
        body: JSON.stringify({ name: data.get("name"), slug: data.get("slug") }),
      });
      await select(result.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Workspace creation failed");
      setLoading(false);
    }
  }
  return (
    <AuthShell>
      <div className="w-full">
        <AuthHeading
          description="Each workspace has isolated members, environments, identities, applications, keys, and traces."
          title="Choose a workspace"
        />
        <div className="space-y-2">
          {query.data?.workspaces.map((workspace) => (
            <button
              className="flex w-full items-center justify-between rounded-lg border border-[var(--border)] p-3 text-left hover:border-[var(--border-strong)]"
              disabled={loading}
              key={workspace.id}
              onClick={() => void select(workspace.id)}
            >
              <span>
                <span className="block text-[13px] font-medium">{workspace.name}</span>
                <span className="technical-value text-[var(--text-tertiary)]">
                  {workspace.slug}
                </span>
              </span>
              <StatusBadge
                label={workspace.role}
                tone={workspace.id === query.data.activeWorkspaceId ? "info" : "neutral"}
              />
            </button>
          ))}
        </div>
        {creating ? (
          <form className="mt-5 space-y-3 border-t border-[var(--border)] pt-5" onSubmit={create}>
            <label>
              <span className="mb-1.5 block text-xs font-medium">Workspace name</span>
              <input autoFocus className={inputClass} name="name" required />
            </label>
            <label>
              <span className="mb-1.5 block text-xs font-medium">Workspace slug</span>
              <input
                className={`${inputClass} technical-value`}
                name="slug"
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                required
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setCreating(false)} type="button" variant="ghost">
                Cancel
              </Button>
              <Button disabled={loading} type="submit" variant="primary">
                Create
              </Button>
            </div>
          </form>
        ) : (
          <Button className="mt-5 w-full" onClick={() => setCreating(true)}>
            <Plus className="size-3.5" /> New workspace
          </Button>
        )}
        <Button className="mt-2 w-full" onClick={() => router.back()} variant="ghost">
          Back
        </Button>
      </div>
    </AuthShell>
  );
}
