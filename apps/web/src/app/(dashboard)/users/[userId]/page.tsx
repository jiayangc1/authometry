"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { Button, EmptyState, StatusBadge } from "@authometry/ui";
import { FullDateTime, RelativeTime } from "@/components/data-display/formatted-time";
import { ErrorState, PageSkeleton } from "@/components/data-display/states";
import { PageContainer, PageHeader, SectionHeader } from "@/components/layout/page";
import { ConfirmDialog } from "@/components/overlays/confirm-dialog";
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
}
export default function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const router = useRouter();
  const client = useQueryClient();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
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
  const details: Array<[string, ReactNode]> = [
    ["User ID", user.id],
    ["Email", user.email],
    ["Email verified", user.email_verified_at ? "Verified" : "Not verified"],
    [
      "Sign-in methods",
      [
        ...(user.password_enabled ? ["Password"] : []),
        ...user.social_connections.map(({ provider }) =>
          provider === "github" ? "GitHub" : "Google",
        ),
      ].join(", ") || "None",
    ],
    ["MFA", user.mfa_enabled ? "Enabled" : "Not enabled"],
    ["Groups", user.groups.join(", ") || "None"],
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
      <div className="mb-4 flex items-center gap-1 text-xs text-[var(--text-secondary)]">
        <Link href="/users">Users</Link>
        <ChevronRight aria-hidden="true" className="size-3" />
        {user.email}
      </div>
      <PageHeader
        actions={
          <Button onClick={() => setConfirmingDelete(true)} variant="danger">
            <Trash2 aria-hidden="true" className="size-3.5" /> Delete User
          </Button>
        }
        description={user.email}
        title={user.name}
      />
      <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
        <section>
          <SectionHeader title="Profile" />
          <dl className="divide-y divide-[var(--border-subtle)] border-y border-[var(--border)]">
            {details.map(([label, value]) => (
              <div className="grid gap-1 py-3 sm:grid-cols-[150px_1fr]" key={label}>
                <dt className="text-xs text-[var(--text-secondary)]">{label}</dt>
                <dd className={label.includes("ID") ? "technical-value" : "text-[13px]"}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
        <section>
          <SectionHeader title="Sessions" />
          {user.sessions.length ? (
            <div className="border-y border-[var(--border)]">
              {user.sessions.map((session) => (
                <div
                  className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-2 py-3 last:border-0"
                  key={session.id}
                >
                  <div className="flex-1">
                    <p className="text-[13px] font-medium">
                      {session.application_name ?? "Unknown application"}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
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
              icon={Users}
              title="No Sessions"
            />
          )}
        </section>
      </div>
      <ConfirmDialog
        actionLabel="Delete User"
        description="Their Authometry sessions, grants, and tokens will be removed. Connected services will be notified asynchronously. This action cannot be undone."
        onConfirm={() => remove.mutateAsync()}
        onOpenChange={setConfirmingDelete}
        open={confirmingDelete}
        pendingLabel="Deleting…"
        title={`Delete ${user.email}?`}
      />
    </PageContainer>
  );
}
