"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppWindow, Plus, UsersRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button, EmptyState } from "@authometry/ui";
import { ErrorState, ListSkeleton } from "@/components/data-display/states";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { Input } from "@/components/ui/form";
import { Table, TableHeader, TableRow } from "@/components/ui/table";
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
      toast.success("Group created.");
    },
    onError: (error) => toast.error(error.message),
  });

  const list = groups.data?.data ?? [];
  return (
    <PageContainer>
      <PageHeader
        description="Organize people and grant portal application access to a whole group at once."
        title="Groups"
      />
      <form
        className="mb-6 flex max-w-lg gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) createGroup.mutate(name.trim());
        }}
      >
        <label className="min-w-0 flex-1">
          <span className="sr-only">New group name</span>
          <Input
            autoComplete="off"
            compact
            maxLength={64}
            onChange={(event) => setName(event.target.value)}
            placeholder="New group name, e.g. Engineering"
            value={name}
          />
        </label>
        <Button
          disabled={!name.trim()}
          loading={createGroup.isPending}
          type="submit"
          variant="primary"
        >
          <Plus aria-hidden="true" className="size-3.5" /> Create group
        </Button>
      </form>
      {groups.isLoading ? (
        <ListSkeleton rows={5} />
      ) : groups.isError ? (
        <ErrorState
          description="Authometry could not load groups. Check your connection, then retry."
          headingLevel="h2"
          onRetry={() => void groups.refetch()}
          title="Unable to load groups"
        />
      ) : list.length ? (
        <Table columns="minmax(200px,1fr) 140px 160px" label="Groups">
          <TableHeader>
            <span>Name</span>
            <span>Members</span>
            <span>Portal apps</span>
          </TableHeader>
          <div className="stagger">
            {list.map((group) => (
              <TableRow href={`/groups/${group.id}`} key={group.id}>
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface-subtle)] transition-transform duration-[var(--motion-normal)] ease-[var(--ease-spring)] group-hover:scale-105">
                    <UsersRound
                      aria-hidden="true"
                      className="size-4 text-[var(--text-secondary)]"
                    />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium">{group.name}</span>
                    <span className="block text-xs text-[var(--text-secondary)] lg:hidden">
                      {group.member_count} members · {group.application_count} apps
                    </span>
                  </span>
                </span>
                <span className="hidden text-[13px] text-[var(--text-secondary)] tabular-nums lg:block">
                  {group.member_count} {group.member_count === 1 ? "member" : "members"}
                </span>
                <span className="hidden items-center gap-1.5 text-[13px] text-[var(--text-secondary)] tabular-nums lg:flex">
                  <AppWindow aria-hidden="true" className="size-3.5" />
                  {group.application_count} {group.application_count === 1 ? "app" : "apps"}
                </span>
              </TableRow>
            ))}
          </div>
        </Table>
      ) : (
        <EmptyState
          description="Create a group above to manage membership and portal access in one place."
          icon={UsersRound}
          title="No groups yet"
        />
      )}
    </PageContainer>
  );
}
