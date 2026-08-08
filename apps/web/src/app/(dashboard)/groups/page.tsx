"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppWindow, ChevronRight, UsersRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button, EmptyState } from "@authometry/ui";
import { inputClass } from "@/components/auth/auth-shell";
import { ErrorState, PageSkeleton } from "@/components/data-display/states";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { apiFetch } from "@/lib/api";

interface GroupRow {
  id: string;
  name: string;
  member_count: number;
  application_count: number;
}

export default function GroupsPage() {
  const client = useQueryClient();
  const [name, setName] = useState("");
  const groups = useQuery({
    queryKey: ["groups"],
    queryFn: () => apiFetch<{ data: GroupRow[] }>("/api/v1/groups"),
  });
  const createGroup = useMutation({
    mutationFn: (groupName: string) =>
      apiFetch<{ id: string; name: string }>("/api/v1/groups", {
        method: "POST",
        body: JSON.stringify({ name: groupName }),
      }),
    onSuccess: async () => {
      setName("");
      await client.invalidateQueries({ queryKey: ["groups"] });
      toast.success("Group created");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <PageContainer>
      <PageHeader
        description="Organize users and grant portal application access once for an entire group."
        title="Groups"
      />
      <form
        className="mb-7 flex max-w-lg gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) createGroup.mutate(name.trim());
        }}
      >
        <label className="min-w-0 flex-1">
          <span className="sr-only">Group name</span>
          <input
            autoComplete="off"
            className={inputClass}
            maxLength={64}
            onChange={(event) => setName(event.target.value)}
            placeholder="Create a group…"
            value={name}
          />
        </label>
        <Button disabled={!name.trim() || createGroup.isPending} type="submit" variant="primary">
          {createGroup.isPending ? "Creating…" : "Create Group"}
        </Button>
      </form>
      {groups.isLoading ? (
        <PageSkeleton rows={5} />
      ) : groups.isError ? (
        <ErrorState
          description="Authometry could not load groups. Check your connection, then retry."
          headingLevel="h2"
          onRetry={() => void groups.refetch()}
          title="Unable to Load Groups"
        />
      ) : groups.data?.data.length ? (
        <div className="border-y border-[var(--border)]">
          {groups.data.data.map((group) => (
            <Link
              className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-[var(--border-subtle)] px-2 py-3 last:border-0 hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none focus-visible:ring-inset sm:grid-cols-[minmax(0,1fr)_150px_180px_auto]"
              href={`/groups/${group.id}`}
              key={group.id}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-raised)]">
                  <UsersRound aria-hidden="true" className="size-4 text-[var(--accent)]" />
                </span>
                <span className="truncate text-[13px] font-medium">{group.name}</span>
              </span>
              <span className="hidden text-xs text-[var(--text-secondary)] sm:block">
                {group.member_count} {group.member_count === 1 ? "member" : "members"}
              </span>
              <span className="hidden items-center gap-1.5 text-xs text-[var(--text-secondary)] sm:flex">
                <AppWindow aria-hidden="true" className="size-3.5" />
                {group.application_count} portal {group.application_count === 1 ? "app" : "apps"}
              </span>
              <ChevronRight aria-hidden="true" className="size-4 text-[var(--text-tertiary)]" />
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          description="Create a group to manage membership and portal access in one place."
          icon={UsersRound}
          title="No Groups Yet"
        />
      )}
    </PageContainer>
  );
}
