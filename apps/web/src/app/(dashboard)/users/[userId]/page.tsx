"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AppWindow,
  BadgeCheck,
  ChevronLeft,
  Fingerprint,
  KeyRound,
  ShieldCheck,
  ShieldOff,
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { Button, Checkbox, EmptyState, StatusBadge } from "@authometry/ui";
import { CopyableValue } from "@/components/data-display/copyable-value";
import { FullDateTime, RelativeTime } from "@/components/data-display/formatted-time";
import { ErrorState, PageSkeleton } from "@/components/data-display/states";
import { PageContainer, SectionHeader } from "@/components/layout/page";
import { ConfirmDialog } from "@/components/overlays/confirm-dialog";
import { ResetUserPasswordDialog } from "@/components/users/reset-user-password-dialog";
import { GroupChipInput } from "@/components/users/group-chip-input";
import { apiFetch } from "@/lib/api";

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

function Signal({
  icon: Icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  tone?: "neutral" | "success" | "warning";
}) {
  const iconClass =
    tone === "success"
      ? "bg-[var(--success-soft)] text-[var(--success)]"
      : tone === "warning"
        ? "bg-[var(--warning-soft)] text-[var(--warning)]"
        : "bg-[var(--surface-subtle)] text-[var(--text-secondary)]";
  return (
    <div className="flex min-w-0 items-center gap-3 bg-[var(--surface)] px-4 py-3.5">
      <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] leading-4 font-medium tracking-[0.04em] text-[var(--text-tertiary)] uppercase">
          {label}
        </span>
        <span className="block truncate text-[13px] font-medium">{value}</span>
      </span>
    </div>
  );
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
      toast.success("User deleted");
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
        variables.assigned ? "Application access assigned" : "Application access removed",
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
      toast.success("Password reset and active sessions revoked");
    },
    onError: (error) => toast.error(error.message),
  });
  const updateGroups = useMutation({
    mutationFn: (groups: string[]) =>
      apiFetch<{ groups: string[] }>(`/api/v1/users/${userId}/groups`, {
        method: "PATCH",
        body: JSON.stringify({ groups }),
      }),
    onSuccess: async ({ groups }) => {
      setGroupValues(groups);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["user", userId] }),
        client.invalidateQueries({ queryKey: ["users"] }),
        client.invalidateQueries({ queryKey: ["groups"] }),
      ]);
      toast.success("Groups updated");
    },
    onError: (error) => toast.error(error.message),
  });
  if (!query.data) {
    return (
      <PageContainer>
        {query.isLoading ? (
          <PageSkeleton />
        ) : (
          <ErrorState
            description="Authometry could not load this user. Check your connection, then retry."
            onRetry={() => void query.refetch()}
            title="Unable to Load User"
          />
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
  return (
    <PageContainer>
      <Link
        className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
        href="/users"
      >
        <ChevronLeft aria-hidden="true" className="size-3.5" />
        All users
      </Link>

      <header className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-raised)]">
        <div className="absolute inset-y-0 left-0 w-1 bg-[var(--accent)]" />
        <div className="flex flex-col gap-5 p-5 pl-6 sm:flex-row sm:items-center sm:justify-between sm:p-6 sm:pl-7">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-xl border border-[var(--accent-border)] bg-[var(--accent-soft)] text-lg font-semibold tracking-[-0.03em] text-[var(--accent)] shadow-sm">
              {getInitials(user.name, user.email)}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl leading-8 font-semibold tracking-[-0.035em]">
                  {user.name}
                </h1>
                <StatusBadge
                  label={user.status}
                  tone={user.status === "active" ? "success" : "neutral"}
                />
              </div>
              <p className="mt-0.5 truncate text-sm text-[var(--text-secondary)]">{user.email}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setResettingPassword(true)}>
              <KeyRound aria-hidden="true" className="size-3.5" /> Reset password
            </Button>
            <Button onClick={() => setConfirmingDelete(true)} variant="danger">
              <Trash2 aria-hidden="true" className="size-3.5" /> Delete user
            </Button>
          </div>
        </div>
        <div className="grid gap-px border-t border-[var(--border-subtle)] bg-[var(--border-subtle)] sm:grid-cols-2 xl:grid-cols-4">
          <Signal
            icon={user.email_verified_at ? BadgeCheck : ShieldOff}
            label="Email"
            tone={user.email_verified_at ? "success" : "warning"}
            value={user.email_verified_at ? "Verified" : "Not verified"}
          />
          <Signal
            icon={user.mfa_enabled ? ShieldCheck : ShieldOff}
            label="Multi-factor auth"
            tone={user.mfa_enabled ? "success" : "warning"}
            value={user.mfa_enabled ? "Enabled" : "Not enabled"}
          />
          <Signal
            icon={Fingerprint}
            label="Sign-in methods"
            value={`${signInMethods.length} configured`}
          />
          <Signal
            icon={Activity}
            label="Active sessions"
            tone={activeSessions ? "success" : "neutral"}
            value={activeSessions === 1 ? "1 session" : `${activeSessions} sessions`}
          />
        </div>
      </header>

      <div className="mt-8 grid items-start gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <div className="grid gap-6">
          <section className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-5 sm:p-6">
            <SectionHeader
              description="Core identity information and authentication history."
              title="Identity details"
            />
            <dl className="divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]">
              {details.map(([label, value]) => (
                <div
                  className="grid gap-1 py-3.5 sm:grid-cols-[145px_1fr] sm:items-center"
                  key={label}
                >
                  <dt className="text-xs font-medium text-[var(--text-secondary)]">{label}</dt>
                  <dd className="min-w-0 text-[13px]">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-5 sm:p-6">
            <SectionHeader
              description="Groups can grant inherited access to portal applications."
              title="Group membership"
            />
            <form
              onSubmit={(event) => {
                event.preventDefault();
                updateGroups.mutate(groupValues ?? user.groups);
              }}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <GroupChipInput
                    disabled={updateGroups.isPending}
                    groups={groupValues ?? user.groups}
                    onChange={setGroupValues}
                  />
                  <p className="mt-2 text-xs leading-5 text-[var(--text-tertiary)]">
                    Type a group name and press Enter. Portal access updates after you save.
                  </p>
                </div>
                <Button disabled={updateGroups.isPending} type="submit" variant="secondary">
                  {updateGroups.isPending ? "Saving…" : "Save groups"}
                </Button>
              </div>
            </form>
          </section>
        </div>

        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-5 sm:p-6">
          <SectionHeader
            description={`${activeSessions} active across ${user.sessions.length} recorded`}
            title="Sessions"
          />
          {user.sessions.length ? (
            <div className="divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]">
              {user.sessions.map((session) => (
                <div className="flex items-center gap-3 py-3.5" key={session.id}>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-subtle)] text-[var(--text-secondary)]">
                    <AppWindow aria-hidden="true" className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium">
                      {session.application_name ?? "Unknown application"}
                    </p>
                    <p className="truncate text-xs text-[var(--text-secondary)]">
                      Active <RelativeTime value={session.last_active_at} />
                    </p>
                  </div>
                  <StatusBadge
                    label={session.status}
                    tone={session.status === "active" ? "success" : "neutral"}
                  />
                </div>
              ))}
            </div>
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

      <section className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-5 sm:p-6">
        <SectionHeader
          description="Assigned services appear in this employee's launch portal. Provisioning must be connected before launch is available."
          title="Application access"
        />
        {user.available_applications.length ? (
          <div className="divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]">
            {user.available_applications.map((application) => {
              const directlyAssigned = application.directly_assigned;
              const inherited = application.inherited_from_groups.length > 0;
              const assigned = directlyAssigned || inherited;
              return (
                <label
                  className="-mx-2 flex cursor-pointer items-center gap-3 rounded-lg px-2 py-3.5 transition-colors hover:bg-[var(--surface-hover)]"
                  key={application.id}
                >
                  <Checkbox
                    checked={assigned}
                    disabled={
                      inherited ||
                      (changeApplicationAccess.isPending &&
                        changeApplicationAccess.variables?.applicationId === application.id)
                    }
                    onChange={(event) =>
                      changeApplicationAccess.mutate({
                        applicationId: application.id,
                        assigned: event.target.checked,
                      })
                    }
                  />
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                    <AppWindow aria-hidden="true" className="size-4 text-[var(--accent)]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium">{application.name}</span>
                    <span className="technical-value block text-[var(--text-tertiary)]">
                      {inherited
                        ? `Via ${application.inherited_from_groups.join(", ")}`
                        : application.slug}
                    </span>
                    <span className="mt-1.5 inline-flex sm:hidden">
                      <StatusBadge
                        label={
                          application.provisioning_enabled
                            ? "Ready to launch"
                            : "Provisioning required"
                        }
                        tone={application.provisioning_enabled ? "success" : "warning"}
                      />
                    </span>
                  </span>
                  <span className="hidden sm:block">
                    <StatusBadge
                      label={
                        application.provisioning_enabled
                          ? "Ready to launch"
                          : "Provisioning required"
                      }
                      tone={application.provisioning_enabled ? "success" : "warning"}
                    />
                  </span>
                </label>
              );
            })}
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
            title="No portal applications"
          />
        )}
      </section>
      <ConfirmDialog
        actionLabel="Delete User"
        description="Their Authometry sessions, grants, and tokens will be removed. Connected services will be notified asynchronously. This action cannot be undone."
        onConfirm={() => remove.mutateAsync()}
        onOpenChange={setConfirmingDelete}
        open={confirmingDelete}
        pendingLabel="Deleting…"
        title={`Delete ${user.email}?`}
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
