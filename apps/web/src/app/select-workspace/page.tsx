"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button, EmptyState, Spinner, StatusBadge } from "@authometry/ui";
import { AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { ErrorState, ListSkeleton } from "@/components/data-display/states";
import { Field, Input } from "@/components/ui/form";
import { apiFetch } from "@/lib/api";
import { humanize } from "@/lib/status";

interface Me {
  activeWorkspaceId: string;
  workspaces: Array<{ id: string; name: string; slug: string; role: string }>;
}
export default function SelectWorkspacePage() {
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectingId, setSelectingId] = useState<string>();
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const query = useQuery({ queryKey: ["me"], queryFn: () => apiFetch<Me>("/api/v1/auth/me") });
  async function select(workspaceId: string) {
    setLoading(true);
    setSelectingId(workspaceId);
    try {
      await apiFetch("/api/v1/auth/switch-workspace", {
        method: "POST",
        body: JSON.stringify({ workspaceId }),
      });
      window.location.assign("/overview");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The workspace could not be selected.");
      setLoading(false);
      setSelectingId(undefined);
    }
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
      toast.error(error instanceof Error ? error.message : "The workspace could not be created.");
      setLoading(false);
    }
  }
  return (
    <AuthShell>
      <div className="w-full">
        <AuthHeading
          description="Each workspace keeps its own members, environments, identities, applications, keys, and traces."
          title="Choose a workspace"
        />
        {query.isLoading ? (
          <ListSkeleton rows={3} />
        ) : query.isError ? (
          <ErrorState
            description="Authometry could not load your workspaces. Check the connection and try again."
            headingLevel="h2"
            onRetry={() => void query.refetch()}
            title="Unable to load workspaces"
          />
        ) : query.data?.workspaces.length ? (
          <ul className="stagger space-y-2">
            {query.data.workspaces.map((workspace) => {
              const current = workspace.id === query.data.activeWorkspaceId;
              return (
                <li key={workspace.id}>
                  <button
                    className="lift group flex w-full items-center gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-raised)] p-3 text-left focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-60"
                    disabled={loading}
                    onClick={() => void select(workspace.id)}
                    type="button"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-gradient-to-br from-[var(--geist-gray-1000)] to-[var(--geist-gray-800)] text-xs font-semibold text-[var(--background)]">
                      {workspace.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">
                        {workspace.name}
                      </span>
                      <span className="technical-value block truncate text-[var(--text-tertiary)]">
                        {workspace.slug} · {humanize(workspace.role)}
                      </span>
                    </span>
                    {selectingId === workspace.id ? (
                      <Spinner className="size-4 text-[var(--text-tertiary)]" />
                    ) : current ? (
                      <StatusBadge label="Current" tone="info" />
                    ) : (
                      <ArrowRight
                        aria-hidden="true"
                        className="size-4 -translate-x-1 text-[var(--text-tertiary)] opacity-0 transition-[opacity,transform] duration-[var(--motion-normal)] ease-[var(--ease-spring)] group-hover:translate-x-0 group-hover:opacity-100"
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            description="Create a workspace to isolate members, applications, policies, and audit data."
            title="No workspaces"
          />
        )}
        {creating ? (
          <form
            className="animate-enter mt-5 space-y-4 border-t border-[var(--border)] pt-5"
            onSubmit={create}
          >
            <Field label="Workspace name">
              <Input
                autoComplete="off"
                autoFocus
                name="name"
                onChange={(event) => {
                  if (!slugEdited) setSlug(toSlug(event.target.value));
                }}
                required
              />
            </Field>
            <Field
              description="Used in issuer URLs. Lowercase letters, numbers, and hyphens."
              label="Workspace ID"
            >
              <Input
                autoComplete="off"
                mono
                name="slug"
                onChange={(event) => {
                  setSlugEdited(true);
                  setSlug(event.target.value);
                }}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                required
                spellCheck={false}
                value={slug}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setCreating(false)} type="button" variant="ghost">
                Cancel
              </Button>
              <Button loading={loading} type="submit" variant="primary">
                Create workspace
              </Button>
            </div>
          </form>
        ) : (
          <Button className="mt-4 w-full" onClick={() => setCreating(true)} size="large">
            <Plus aria-hidden="true" className="size-3.5" /> New workspace
          </Button>
        )}
        <Button asChild className="mt-2 w-full" variant="ghost">
          <Link href="/overview">Back to dashboard</Link>
        </Button>
      </div>
    </AuthShell>
  );
}

function toSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
