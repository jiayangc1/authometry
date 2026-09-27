"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Activity,
  AppWindow,
  BadgeCheck,
  Copy,
  Fingerprint,
  KeyRound,
  ListTree,
  MoreHorizontal,
  ShieldCheck,
  ShieldOff,
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { Button, Checkbox, EmptyState, Spinner, StatusBadge, StatusDot, cn } from "@authometry/ui";
import { CopyableValue } from "@/components/data-display/copyable-value";
import { FullDateTime, RelativeTime } from "@/components/data-display/formatted-time";
import { ErrorState, PageSkeleton } from "@/components/data-display/states";
import {
  Breadcrumbs,
  DescriptionList,
  PageContainer,
  SectionHeader,
} from "@/components/layout/page";
import { ConfirmDialog } from "@/components/overlays/confirm-dialog";
import { ResetUserPasswordDialog } from "@/components/users/reset-user-password-dialog";
import { GroupChipInput } from "@/components/users/group-chip-input";
import { Card } from "@/components/ui/card";
import {
  menuContentClass,
  menuDangerItemClass,
  menuItemClass,
  menuSeparatorClass,
} from "@/components/ui/menu";
import { apiFetch } from "@/lib/api";
import { humanize } from "@/lib/status";

interface UserDetail {
  id: string;
  name: string;
  email: string;
  status: string;
  email_verified_at?: string;
  groups: string[];
  custom_claims: Record<string, unknown>;
  mfa_enabled: boolean;
  password_enabled: boolean;
  created_at: string;
  last_authenticated_at?: string;
  social_connections: Array<{
    provider: string;
    provider_email?: string;
    created_at: string;
  }>;
  sessions: Array<{
    id: string;
    status: string;
    application_name?: string;
    last_active_at: string;
    expires_at: string;
  }>;
  application_assignments: Array<{
    application_id: string;
    name: string;
    slug: string;
    assigned_at: string;
    last_launched_at?: string;
    provisioning_enabled: boolean;
  }>;
  available_applications: Array<{
    id: string;
    name: string;
    slug: string;
    directly_assigned: boolean;
    inherited_from_groups: string[];
    provisioning_enabled: boolean;
  }>;
}

function getInitials(name: string, email: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length > 1) return `${parts[0]?.[0] ?? ""}${parts.at(-1)?.[0] ?? ""}`.toUpperCase();
  return (parts[0]?.slice(0, 2) || email.slice(0, 2)).toUpperCase();
}

function formatProvider(provider: string) {
  if (provider === "github") return "GitHub";
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

export default function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const router = useRouter();
  const client = useQueryClient();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [groupValues, setGroupValues] = useState<string[]>();
  const query = useQuery({
    queryKey: ["user", userId],
    queryFn: () => apiFetch<UserDetail>(`/api/v1/users/${userId}`),
  });
  const remove = useMutation({
    mutationFn: () => apiFetch(`/api/v1/users/${userId}`, { method: "DELETE" }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["users"] });
      toast.success("User deleted.");
      router.push("/users");
    },
    onError: (error) => toast.error(error.message),
  });
  const changeApplicationAccess = useMutation({
    mutationFn: ({ applicationId, assigned }: { applicationId: string; assigned: boolean }) =>
      apiFetch(`/api/v1/users/${userId}/applications/${applicationId}`, {
        method: assigned ? "PUT" : "DELETE",
      }),
    onSuccess: async (_result, variables) => {
      await client.invalidateQueries({ queryKey: ["user", userId] });
      toast.success(
        variables.assigned ? "Application access assigned." : "Application access removed.",
      );
    },
    onError: (error) => toast.error(error.message),
  });
  const resetPassword = useMutation({
    mutationFn: (newPassword: string) =>
      apiFetch(`/api/v1/users/${userId}/password`, {
        method: "PUT",
        body: JSON.stringify({ newPassword }),
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["user", userId] });
      toast.success("Password reset. Active sessions were signed out.");
    },
    onError: (error) => toast.error(error.message),
  });
  const updateGroups = useMutation({
    mutationFn: (groups: string[]) =>
      apiFetch<{ groups: string[] }>(`/api/v1/users/${userId}/groups`, {
        method: "PATCH",
        body: JSON.stringify({ groups }),
      }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["user", userId] }),
        client.invalidateQueries({ queryKey: ["users"] }),
        client.invalidateQueries({ queryKey: ["groups"] }),
      ]);
      setGroupValues(undefined);
      toast.success("Groups updated.");
    },
    onError: (error) => toast.error(error.message),
  });
  const revokeSession = useMutation({
    mutationFn: (sessionId: string) =>
      apiFetch(`/api/v1/sessions/${sessionId}/revoke`, { method: "POST" }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["user", userId] });
      toast.success("Session revoked.");
    },
    onError: (error) => toast.error(error.message),
  });
  if (!query.data) {
    return (
      <PageContainer>
        {query.isLoading ? (
          <PageSkeleton metrics={false} />
        ) : (
          <>
            <Breadcrumbs items={[{ label: "Users", href: "/users" }, { label: "Not found" }]} />
            <ErrorState
              description="This user may have been deleted. Check your connection, then retry."
              onRetry={() => void query.refetch()}
              retrying={query.isRefetching}
              title="Unable to load user"
            />
          </>
        )}
      </PageContainer>
    );
  }
  const user = query.data;
  const signInMethods = [
    ...(user.password_enabled ? ["Password"] : []),
    ...user.social_connections.map(({ provider }) => formatProvider(provider)),
  ];
  const activeSessions = user.sessions.filter((session) => session.status === "active").length;
  const details: Array<[string, ReactNode]> = [
    ["User ID", <CopyableValue key="user-id" value={user.id} />],
    ["Sign-in methods", signInMethods.join(", ") || "None"],
    ["Created", <FullDateTime key="created" value={user.created_at} />],
    [
      "Last authentication",
      user.last_authenticated_at ? (
        <RelativeTime key="last-authentication" value={user.last_authenticated_at} />
      ) : (
        "Never"
      ),
    ],
  ];
  const groupsDirty =
    groupValues !== undefined && JSON.stringify(groupValues) !== JSON.stringify(user.groups);
  const statusTone =
    user.status === "active" ? "success" : user.status === "suspended" ? "danger" : "neutral";
  const signals: Array<{ label: string; value: string; ok: boolean; icon: LucideIcon }> = [
    {
      label: "Email",
      value: user.email_verified_at ? "Verified" : "Not verified",
      ok: Boolean(user.email_verified_at),
      icon: user.email_verified_at ? BadgeCheck : ShieldOff,
    },
    {
      label: "Multi-factor",
      value: user.mfa_enabled ? "Enabled" : "Not enabled",
      ok: user.mfa_enabled,
      icon: user.mfa_enabled ? ShieldCheck : ShieldOff,
    },
    {
      label: "Sign-in methods",
      value: signInMethods.join(", ") || "None",
      ok: signInMethods.length > 0,
      icon: Fingerprint,
    },
    {
      label: "Active sessions",
      value: String(activeSessions),
      ok: true,
      icon: Activity,
    },
  ];
  return (
    <PageContainer>
      <Breadcrumbs items={[{ label: "Users", href: "/users" }, { label: user.name }]} />
      <header className="mb-6 flex flex-col gap-4 border-b border-[var(--border)] pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div className="animate-pop flex size-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--geist-gray-200)] to-[var(--geist-gray-100)] text-lg font-semibold tracking-[-0.03em] text-[var(--text-secondary)] ring-1 ring-[var(--border)]">
            {getInitials(user.name, user.email)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl leading-8 font-semibold tracking-[-0.03em]">
                {user.name}
              </h1>
              <StatusBadge label={humanize(user.status)} tone={statusTone} />
            </div>
            <p className="truncate text-sm text-[var(--text-secondary)]">{user.email}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setResettingPassword(true)}>
            <KeyRound aria-hidden="true" className="size-3.5" /> Reset password
          </Button>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button aria-label="More actions" size="icon">
                <MoreHorizontal aria-hidden="true" className="size-4" />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" className={menuContentClass} sideOffset={6}>
                <DropdownMenu.Item
                  className={menuItemClass}
                  onSelect={() => {
                    void navigator.clipboard
                      .writeText(user.id)
                      .then(() => toast.success("User ID copied."))
                      .catch(() => toast.error("Could not copy the user ID."));
                  }}
                >
                  <Copy aria-hidden="true" /> Copy user ID
                </DropdownMenu.Item>
                <DropdownMenu.Item asChild className={menuItemClass}>
                  <Link href={`/traces?q=${encodeURIComponent(user.email)}`}>
                    <ListTree aria-hidden="true" /> View traces
                  </Link>
                </DropdownMenu.Item>
                <DropdownMenu.Separator className={menuSeparatorClass} />
                <DropdownMenu.Item
                  className={menuDangerItemClass}
                  onSelect={() => setConfirmingDelete(true)}
                >
                  <Trash2 aria-hidden="true" /> Delete user
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </header>

      <section
        aria-label="Security summary"
        className="stagger mb-8 grid gap-px overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--border)] sm:grid-cols-2 xl:grid-cols-4"
      >
        {signals.map((signal) => {
          const Icon = signal.icon;
          return (
            <div
              className="flex min-w-0 items-center gap-3 bg-[var(--surface-raised)] px-4 py-3.5"
              key={signal.label}
            >
              <Icon
                aria-hidden="true"
                className={cn(
                  "size-4 shrink-0",
                  signal.ok ? "text-[var(--success)]" : "text-[var(--warning)]",
                )}
              />
              <span className="min-w-0">
                <span className="block text-xs text-[var(--text-secondary)]">{signal.label}</span>
                <span className="block truncate text-[13px] font-medium">{signal.value}</span>
              </span>
            </div>
          );
        })}
      </section>

      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
        <div className="space-y-8">
          <section>
            <SectionHeader title="Details" />
            <DescriptionList items={details} />
          </section>

          <section>
            <SectionHeader
              description="Groups grant inherited access to portal applications."
              title="Groups"
            />
            <Card>
              <form
                className="p-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (groupsDirty) updateGroups.mutate(groupValues ?? user.groups);
                }}
              >
                <GroupChipInput
                  disabled={updateGroups.isPending}
                  groups={groupValues ?? user.groups}
                  onChange={setGroupValues}
                />
                <div
                  className={cn(
                    "grid transition-[grid-template-rows,opacity] duration-[var(--motion-normal)] ease-[var(--ease-out)]",
                    groupsDirty ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="flex items-center justify-end gap-2 pt-3">
                      <Button
                        disabled={updateGroups.isPending}
                        onClick={() => setGroupValues(undefined)}
                        size="compact"
                        type="button"
                        variant="ghost"
                      >
                        Reset
                      </Button>
                      <Button
                        loading={updateGroups.isPending}
                        size="compact"
                        tabIndex={groupsDirty ? 0 : -1}
                        type="submit"
                        variant="primary"
                      >
                        Save groups
                      </Button>
                    </div>
                  </div>
                </div>
              </form>
            </Card>
          </section>

          <section>
            <SectionHeader
              description="Assigned applications appear in this person’s launch portal."
              title="Application access"
            />
            {user.available_applications.length ? (
              <ul className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-raised)]">
                {user.available_applications.map((application) => {
                  const inherited = application.inherited_from_groups.length > 0;
                  const assigned = application.directly_assigned || inherited;
                  const pending =
                    changeApplicationAccess.isPending &&
                    changeApplicationAccess.variables?.applicationId === application.id;
                  return (
                    <li
                      className="border-b border-[var(--border)] last:border-0"
                      key={application.id}
                    >
                      <label
                        className={cn(
                          "flex items-center gap-3 px-4 py-3 transition-colors duration-[var(--motion-fast)]",
                          inherited
                            ? "cursor-default"
                            : "cursor-pointer hover:bg-[var(--surface-subtle)]",
                        )}
                        title={
                          inherited ? "Inherited from a group — change it on the group." : undefined
                        }
                      >
                        <Checkbox
                          checked={assigned}
                          disabled={inherited || pending}
                          onChange={(event) =>
                            changeApplicationAccess.mutate({
                              applicationId: application.id,
                              assigned: event.target.checked,
                            })
                          }
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-medium">{application.name}</span>
                          <span className="block truncate text-xs text-[var(--text-secondary)]">
                            {inherited
                              ? `Inherited from ${application.inherited_from_groups.join(", ")}`
                              : application.slug}
                          </span>
                        </span>
                        {pending ? (
                          <Spinner className="size-3.5 text-[var(--text-tertiary)]" />
                        ) : (
                          <StatusBadge
                            label={
                              application.provisioning_enabled ? "Ready" : "Needs provisioning"
                            }
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

        <section>
          <SectionHeader
            description={`${activeSessions} active of ${user.sessions.length} recorded`}
            title="Sessions"
          />
          {user.sessions.length ? (
            <ul className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-raised)]">
              {user.sessions.map((session) => (
                <li
                  className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3 last:border-0"
                  key={session.id}
                >
                  <StatusDot tone={session.status === "active" ? "success" : "neutral"} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">
                      {session.application_name ?? "Dashboard"}
                    </p>
                    <p className="truncate text-xs text-[var(--text-secondary)]">
                      Active <RelativeTime value={session.last_active_at} />
                    </p>
                  </div>
                  {session.status === "active" ? (
                    <Button
                      className="hover:text-[var(--danger)]"
                      loading={revokeSession.isPending && revokeSession.variables === session.id}
                      onClick={() => revokeSession.mutate(session.id)}
                      size="compact"
                      variant="ghost"
                    >
                      Revoke
                    </Button>
                  ) : (
                    <span className="text-xs text-[var(--text-tertiary)]">
                      {humanize(session.status)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              description="This user has no active or recent sessions."
              headingLevel="h3"
              icon={Activity}
              title="No sessions"
            />
          )}
        </section>
      </div>
      <ConfirmDialog
        actionLabel="Delete user"
        confirmationText={user.email}
        description="Their sessions, grants, and tokens will be removed, and connected services are notified. This cannot be undone."
        onConfirm={() => remove.mutateAsync()}
        onOpenChange={setConfirmingDelete}
        open={confirmingDelete}
        pendingLabel="Deleting…"
        title={`Delete ${user.name}?`}
      />
      <ResetUserPasswordDialog
        email={user.email}
        onOpenChange={setResettingPassword}
        onReset={(newPassword) => resetPassword.mutateAsync(newPassword)}
        open={resettingPassword}
      />
    </PageContainer>
  );
}
