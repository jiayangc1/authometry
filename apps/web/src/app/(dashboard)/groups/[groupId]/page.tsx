"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppWindow, ChevronRight, Trash2, UsersRound } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button, Checkbox, EmptyState, StatusBadge } from "@authometry/ui";
import { ErrorState, PageSkeleton } from "@/components/data-display/states";
import { PageContainer, PageHeader, SectionHeader } from "@/components/layout/page";
import { ConfirmDialog } from "@/components/overlays/confirm-dialog";
import { apiFetch } from "@/lib/api";

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
      toast.success(variables.assigned ? "Member added" : "Member removed");
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
      toast.success(variables.assigned ? "Portal access granted" : "Portal access removed");
    },
    onError: (error) => toast.error(error.message),
  });
  const removeGroup = useMutation({
    mutationFn: () => apiFetch(`/api/v1/groups/${groupId}`, { method: "DELETE" }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["groups"] });
      toast.success("Group deleted");
      router.push("/groups");
    },
    onError: (error) => toast.error(error.message),
  });

  if (!group.data) {
    return (
      <PageContainer>
        {group.isLoading ? (
          <PageSkeleton />
        ) : (
          <ErrorState
            description="Authometry could not load this group. Check your connection, then retry."
            onRetry={() => void group.refetch()}
            title="Unable to Load Group"
          />
        )}
      </PageContainer>
    );
  }

  const memberCount = group.data.users.filter((user) => user.assigned).length;
  const applicationCount = group.data.applications.filter((application) => application.assigned).length;

  return (
    <PageContainer>
      <div className="mb-4 flex items-center gap-1 text-xs text-[var(--text-secondary)]">
        <Link href="/groups">Groups</Link>
        <ChevronRight aria-hidden="true" className="size-3" />
        {group.data.name}
      </div>
      <PageHeader
        actions={
          <Button onClick={() => setConfirmingDelete(true)} variant="danger">
            <Trash2 aria-hidden="true" className="size-3.5" /> Delete Group
          </Button>
        }
        description={`${memberCount} ${memberCount === 1 ? "member" : "members"} · ${applicationCount} portal ${applicationCount === 1 ? "app" : "apps"}`}
        title={group.data.name}
      />
      <div className="grid gap-10 xl:grid-cols-2">
        <section>
          <SectionHeader
            description="Membership updates group claims and inherited portal access immediately."
            title="Members"
          />
          {group.data.users.length ? (
            <div className="divide-y divide-[var(--border-subtle)] border-y border-[var(--border)]">
              {group.data.users.map((user) => (
                <label
                  className="flex cursor-pointer items-center gap-3 px-2 py-3 hover:bg-[var(--surface-hover)]"
                  key={user.id}
                >
                  <Checkbox
                    checked={user.assigned}
                    disabled={
                      changeMembership.isPending && changeMembership.variables?.userId === user.id
                    }
                    onChange={(event) =>
                      changeMembership.mutate({ userId: user.id, assigned: event.target.checked })
                    }
                  />
                  <span className="flex size-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-raised)]">
                    <UsersRound aria-hidden="true" className="size-4 text-[var(--accent)]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{user.name}</span>
                    <span className="block truncate text-xs text-[var(--text-tertiary)]">
                      {user.email}
                    </span>
                  </span>
                  <StatusBadge
                    label={user.status}
                    tone={user.status === "active" ? "success" : "neutral"}
                  />
                </label>
              ))}
            </div>
          ) : (
            <EmptyState
              description="Create a user before assigning group membership."
              headingLevel="h3"
              icon={UsersRound}
              title="No Users"
            />
          )}
        </section>
        <section>
          <SectionHeader
            description="Selected applications appear in every member's employee portal."
            title="Portal Application Access"
          />
          {group.data.applications.length ? (
            <div className="divide-y divide-[var(--border-subtle)] border-y border-[var(--border)]">
              {group.data.applications.map((application) => (
                <label
                  className="flex cursor-pointer items-center gap-3 px-2 py-3 hover:bg-[var(--surface-hover)]"
                  key={application.id}
                >
                  <Checkbox
                    checked={application.assigned}
                    disabled={
                      changeApplicationAccess.isPending &&
                      changeApplicationAccess.variables?.applicationId === application.id
                    }
                    onChange={(event) =>
                      changeApplicationAccess.mutate({
                        applicationId: application.id,
                        assigned: event.target.checked,
                      })
                    }
                  />
                  <span className="flex size-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-raised)]">
                    <AppWindow aria-hidden="true" className="size-4 text-[var(--accent)]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">
                      {application.name}
                    </span>
                    <span className="technical-value block truncate text-[var(--text-tertiary)]">
                      {application.slug}
                    </span>
                  </span>
                  <StatusBadge
                    label={application.provisioning_enabled ? "Ready" : "Provisioning required"}
                    tone={application.provisioning_enabled ? "success" : "warning"}
                  />
                </label>
              ))}
            </div>
          ) : (
            <EmptyState
              primaryAction={
                <Button asChild>
                  <Link href="/applications">Configure Applications</Link>
                </Button>
              }
              description="Enable an application's employee portal setting and add its sign-in URL first."
              headingLevel="h3"
              icon={AppWindow}
              title="No Portal Applications"
            />
          )}
        </section>
      </div>
      <ConfirmDialog
        actionLabel="Delete Group"
        description="The group will be removed from every member and its inherited portal access will end. Users and direct application assignments are not deleted."
        onConfirm={() => removeGroup.mutateAsync()}
        onOpenChange={setConfirmingDelete}
        open={confirmingDelete}
        pendingLabel="Deleting…"
        title={`Delete ${group.data.name}?`}
      />
    </PageContainer>
  );
}
