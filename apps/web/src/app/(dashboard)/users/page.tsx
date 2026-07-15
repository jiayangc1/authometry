"use client";

import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button, EmptyState, StatusBadge } from "@authometry/ui";
import { PageSkeleton } from "@/components/data-display/states";
import { SearchInput, selectClass } from "@/components/data-display/search-input";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { apiFetch } from "@/lib/api";
import { relativeTime } from "@/lib/format";

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
  const users = useQuery({
    queryKey: ["users", q],
    queryFn: () => apiFetch<{ data: UserRow[] }>(`/api/v1/users?q=${encodeURIComponent(q)}`),
  });
  function update(value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set("q", value);
    else next.delete("q");
    router.replace(`${pathname}?${next}`);
  }
  return (
    <PageContainer>
      <PageHeader
        actions={
          <Button asChild>
            <Link href="/users/new">
              <UserPlus className="size-3.5" /> Add user
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
          onChange={(event) => update(event.target.value)}
          placeholder="Name, email, or user ID"
        />
        <select className={selectClass} disabled>
          <option>All statuses</option>
        </select>
      </div>
      {users.isLoading ? (
        <PageSkeleton rows={7} />
      ) : users.data?.data.length ? (
        <div className="border-y border-[var(--border)]">
          {users.data.data.map((user) => (
            <Link
              className="grid min-h-16 grid-cols-[1fr_auto] items-center gap-3 border-b border-[var(--border-subtle)] px-2 py-2.5 last:border-0 hover:bg-[var(--surface-hover)] sm:grid-cols-[minmax(180px,1.4fr)_130px_130px_100px_100px_130px]"
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
                {user.mfa_enabled && <ShieldCheck className="size-3 text-[var(--success)]" />}
                {user.mfa_enabled ? "Enabled" : "Not enabled"}
              </span>
              <span className="hidden text-xs text-[var(--text-secondary)] sm:block">
                {user.active_sessions} sessions
              </span>
              <span className="text-xs text-[var(--text-tertiary)]">
                {user.last_authenticated_at ? relativeTime(user.last_authenticated_at) : "Never"}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          description="Users appear after they authenticate or are created through the management API."
          icon={Users}
          title="No users yet"
        />
      )}
    </PageContainer>
  );
}
