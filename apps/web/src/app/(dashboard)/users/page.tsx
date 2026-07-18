"use client";

import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button, EmptyState, StatusBadge } from "@authometry/ui";
import { RelativeTime } from "@/components/data-display/formatted-time";
import { ErrorState, PageSkeleton } from "@/components/data-display/states";
import { SearchInput, selectClass } from "@/components/data-display/search-input";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { apiFetch } from "@/lib/api";

interface UserRow {
  id: string;
  name: string;
  email: string;
  status: string;
  groups: string[];
  mfa_enabled: boolean;
  last_authenticated_at?: string;
  active_sessions: number;
  social_connections: string[];
}
export default function UsersPage() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const q = params.get("q") ?? "";
  const status = params.get("status") ?? "all";
  const users = useQuery({
    queryKey: ["users", q],
    queryFn: () => apiFetch<{ data: UserRow[] }>(`/api/v1/users?q=${encodeURIComponent(q)}`),
  });
  function update(name: string, value: string) {
    const next = new URLSearchParams(params);
    if (value && value !== "all") next.set(name, value);
    else next.delete(name);
    const queryString = next.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname);
  }
  const filteredUsers = (users.data?.data ?? []).filter(
    (user) => status === "all" || user.status === status,
  );
  const statuses = [...new Set((users.data?.data ?? []).map((user) => user.status))];
  return (
    <PageContainer>
      <PageHeader
        actions={
          <Button asChild>
            <Link href="/users/new">
              <UserPlus aria-hidden="true" className="size-3.5" /> Add User
            </Link>
          </Button>
        }
        description="Manage identities that authenticate through this Authometry instance."
        title="Users"
      />
      <div className="mb-4 flex gap-2">
        <SearchInput
          className="w-full max-w-72"
          defaultValue={q}
          onChange={(event) => update("q", event.target.value)}
          placeholder="Name, email, or user ID…"
        />
        <label>
          <span className="sr-only">User status</span>
          <select
            className={selectClass}
            name="status"
            onChange={(event) => update("status", event.target.value)}
            value={status}
          >
            <option value="all">All statuses</option>
            {statuses.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>
      {users.isLoading ? (
        <PageSkeleton rows={7} />
      ) : users.isError ? (
        <ErrorState
          description="Authometry could not load users. Check your connection, then retry."
          headingLevel="h2"
          onRetry={() => void users.refetch()}
          title="Unable to Load Users"
        />
      ) : filteredUsers.length ? (
        <div className="border-y border-[var(--border)]">
          {filteredUsers.map((user) => (
            <Link
              className="virtualized-row grid min-h-16 grid-cols-[1fr_auto] items-center gap-3 border-b border-[var(--border-subtle)] px-2 py-2.5 last:border-0 hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none focus-visible:ring-inset sm:grid-cols-[minmax(180px,1.4fr)_130px_130px_100px_100px_130px]"
              href={`/users/${user.id}`}
              key={user.id}
            >
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium">{user.name}</p>
                <p className="truncate text-xs text-[var(--text-secondary)]">{user.email}</p>
              </div>
              <StatusBadge
                label={user.status}
                tone={user.status === "active" ? "success" : "neutral"}
              />
              <span className="hidden text-xs text-[var(--text-secondary)] sm:block">
                {user.social_connections.length ? user.social_connections.join(", ") : "Password"}
              </span>
              <span className="hidden items-center gap-1 text-xs text-[var(--text-secondary)] sm:flex">
                {user.mfa_enabled && (
                  <ShieldCheck aria-hidden="true" className="size-3 text-[var(--success)]" />
                )}
                {user.mfa_enabled ? "Enabled" : "Not enabled"}
              </span>
              <span className="hidden text-xs text-[var(--text-secondary)] sm:block">
                {user.active_sessions} sessions
              </span>
              <span className="text-xs text-[var(--text-tertiary)]">
                {user.last_authenticated_at ? (
                  <RelativeTime value={user.last_authenticated_at} />
                ) : (
                  "Never"
                )}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          description={
            q || status !== "all"
              ? "Try a different search or status filter."
              : "Users appear after they authenticate or are created through the management API."
          }
          icon={Users}
          title={q || status !== "all" ? "No Matching Users" : "No Users Yet"}
        />
      )}
    </PageContainer>
  );
}
