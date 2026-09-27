"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppWindow, Trash2, UsersRound } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button, Checkbox, EmptyState, Spinner, StatusBadge } from "@authometry/ui";
import { SearchInput } from "@/components/data-display/search-input";
import { ErrorState, PageSkeleton } from "@/components/data-display/states";
import { Breadcrumbs, PageContainer, PageHeader, SectionHeader } from "@/components/layout/page";
import { SegmentedControl } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/overlays/confirm-dialog";
import { apiFetch } from "@/lib/api";
import { humanize } from "@/lib/status";

interface GroupDetail {
  id: string;
  name: string;
  users: Array<{
    id: string;
    name: string;
    email: string;
    status: string;
    assigned: boolean;
  }>;
  applications: Array<{
    id: string;
    name: string;
    slug: string;
    assigned: boolean;
    provisioning_enabled: boolean;
  }>;
}

export default function GroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const router = useRouter();
  const client = useQueryClient();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [memberFilter, setMemberFilter] = useState("");
  const [membersOnly, setMembersOnly] = useState(false);
  const group = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => apiFetch<GroupDetail>(`/api/v1/groups/${groupId}`),
  });
  const changeMembership = useMutation({
    mutationFn: ({ userId, assigned }: { userId: string; assigned: boolean }) =>
      apiFetch(`/api/v1/groups/${groupId}/users/${userId}`, {
        method: assigned ? "PUT" : "DELETE",
      }),
    onSuccess: async (_result, variables) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["group", groupId] }),
        client.invalidateQueries({ queryKey: ["groups"] }),
        client.invalidateQueries({ queryKey: ["user", variables.userId] }),
        client.invalidateQueries({ queryKey: ["users"] }),
      ]);
      toast.success(variables.assigned ? "Member added." : "Member removed.");
    },
    onError: (error) => toast.error(error.message),
  });
  const changeApplicationAccess = useMutation({
    mutationFn: ({ applicationId, assigned }: { applicationId: string; assigned: boolean }) =>
      apiFetch(`/api/v1/groups/${groupId}/applications/${applicationId}`, {
        method: assigned ? "PUT" : "DELETE",
      }),
    onSuccess: async (_result, variables) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["group", groupId] }),
        client.invalidateQueries({ queryKey: ["groups"] }),
        client.invalidateQueries({ queryKey: ["users"] }),
      ]);
      toast.success(variables.assigned ? "Portal access granted." : "Portal access removed.");
    },
    onError: (error) => toast.error(error.message),
  });
  const removeGroup = useMutation({
    mutationFn: () => apiFetch(`/api/v1/groups/${groupId}`, { method: "DELETE" }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["groups"] });
      toast.success("Group deleted.");
      router.push("/groups");
    },
    onError: (error) => toast.error(error.message),
  });

  if (!group.data) {
    return (
      <PageContainer>
        {group.isLoading ? (
          <PageSkeleton metrics={false} />
        ) : (
          <>
            <Breadcrumbs items={[{ label: "Groups", href: "/groups" }, { label: "Not found" }]} />
            <ErrorState
              description="This group may have been deleted. Check your connection, then retry."
              onRetry={() => void group.refetch()}
              title="Unable to load group"
            />
          </>
        )}
      </PageContainer>
    );
  }

  const data = group.data;
  const memberCount = data.users.filter((user) => user.assigned).length;
  const applicationCount = data.applications.filter((application) => application.assigned).length;
  const needle = memberFilter.trim().toLowerCase();
  const visibleUsers = data.users.filter(
    (user) =>
      (!membersOnly || user.assigned) &&
      (!needle ||
        user.name.toLowerCase().includes(needle) ||
        user.email.toLowerCase().includes(needle)),
  );

  return (
    <PageContainer>
      <Breadcrumbs items={[{ label: "Groups", href: "/groups" }, { label: data.name }]} />
      <PageHeader
        actions={
          <Button className="hover:text-[var(--danger)]" onClick={() => setConfirmingDelete(true)}>
            <Trash2 aria-hidden="true" className="size-3.5" /> Delete group
          </Button>
        }
        description={`${memberCount} ${memberCount === 1 ? "member" : "members"} · ${applicationCount} portal ${applicationCount === 1 ? "app" : "apps"}`}
        title={data.name}
      />
      <div className="grid items-start gap-8 xl:grid-cols-2">
        <section>
          <SectionHeader
            description="Changes update group claims and inherited portal access immediately."
            title="Members"
          />
          {data.users.length ? (
            <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-raised)]">
              <div className="flex flex-col gap-2 border-b border-[var(--border)] bg-[var(--surface-subtle)] p-2 sm:flex-row sm:items-center">
                <SearchInput
                  className="flex-1"
                  onChange={(event) => setMemberFilter(event.target.value)}
                  onClear={() => setMemberFilter("")}
                  placeholder="Filter people…"
                  value={memberFilter}
                />
                <SegmentedControl
                  label="Show"
                  onChange={(value) => setMembersOnly(value === "members")}
                  options={[
                    { value: "all", label: "Everyone" },
                    { value: "members", label: `Members (${memberCount})` },
                  ]}
                  size="compact"
                  value={membersOnly ? "members" : "all"}
                />
              </div>
              <ul className="max-h-[480px] scrollbar-thin overflow-y-auto">
                {visibleUsers.map((user) => {
                  const pending =
                    changeMembership.isPending && changeMembership.variables?.userId === user.id;
                  return (
                    <li className="border-b border-[var(--border)] last:border-0" key={user.id}>
                      <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--surface-subtle)]">
                        <Checkbox
                          checked={user.assigned}
                          disabled={pending}
                          onChange={(event) =>
                            changeMembership.mutate({
                              userId: user.id,
                              assigned: event.target.checked,
                            })
                          }
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium">
                            {user.name}
                          </span>
                          <span className="block truncate text-xs text-[var(--text-secondary)]">
                            {user.email}
                          </span>
                        </span>
                        {pending ? (
                          <Spinner className="size-3.5 text-[var(--text-tertiary)]" />
                        ) : (
                          user.status !== "active" && (
                            <StatusBadge label={humanize(user.status)} tone="neutral" />
                          )
                        )}
                      </label>
                    </li>
                  );
                })}
                {visibleUsers.length === 0 && (
                  <li className="px-4 py-8 text-center text-[13px] text-[var(--text-secondary)]">
                    No people match this filter.
                  </li>
                )}
              </ul>
            </div>
          ) : (
            <EmptyState
              description="Create a user before assigning group membership."
              headingLevel="h3"
              icon={UsersRound}
              primaryAction={
                <Button asChild>
                  <Link href="/users/new">Add user</Link>
                </Button>
              }
              title="No users"
            />
          )}
        </section>
        <section>
          <SectionHeader
            description="Selected applications appear in every member’s employee portal."
            title="Portal access"
          />
          {data.applications.length ? (
            <ul className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-raised)]">
              {data.applications.map((application) => {
                const pending =
                  changeApplicationAccess.isPending &&
                  changeApplicationAccess.variables?.applicationId === application.id;
                return (
                  <li
                    className="border-b border-[var(--border)] last:border-0"
                    key={application.id}
                  >
                    <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--surface-subtle)]">
                      <Checkbox
                        checked={application.assigned}
                        disabled={pending}
                        onChange={(event) =>
                          changeApplicationAccess.mutate({
                            applicationId: application.id,
                            assigned: event.target.checked,
                          })
                        }
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium">
                          {application.name}
                        </span>
                        <span className="technical-value block truncate text-[var(--text-tertiary)]">
                          {application.slug}
                        </span>
                      </span>
                      {pending ? (
                        <Spinner className="size-3.5 text-[var(--text-tertiary)]" />
                      ) : (
                        <StatusBadge
                          label={application.provisioning_enabled ? "Ready" : "Needs provisioning"}
                          tone={application.provisioning_enabled ? "success" : "warning"}
                        />
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              description="Turn on an application’s employee portal setting and add its sign-in URL first."
              headingLevel="h3"
              icon={AppWindow}
              primaryAction={
                <Button asChild>
                  <Link href="/applications">Configure applications</Link>
                </Button>
              }
              title="No portal applications"
            />
          )}
        </section>
      </div>
      <ConfirmDialog
        actionLabel="Delete group"
        confirmationText={data.name}
        description="The group is removed from every member and its inherited portal access ends. Users and direct assignments are kept."
        onConfirm={() => removeGroup.mutateAsync()}
        onOpenChange={setConfirmingDelete}
        open={confirmingDelete}
        pendingLabel="Deleting…"
        title={`Delete ${data.name}?`}
      />
    </PageContainer>
  );
}
