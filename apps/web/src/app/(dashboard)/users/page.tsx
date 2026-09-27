"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { SearchX, ShieldCheck, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { Button, EmptyState, StatusBadge, cn } from "@authometry/ui";
import { RelativeTime } from "@/components/data-display/formatted-time";
import { ErrorState, ListSkeleton } from "@/components/data-display/states";
import { FilterBar, SearchInput } from "@/components/data-display/search-input";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { Select } from "@/components/ui/form";
import { Table, TableFooter, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch } from "@/lib/api";
import { humanize } from "@/lib/status";
import { useDebouncedSearchParam } from "@/lib/use-query-params";

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
const columns = "minmax(220px,1.6fr) 110px 130px 110px 100px 120px";

export default function UsersPage() {
  const search = useDebouncedSearchParam("q");
  const status = search.parameters.get("status") ?? "";
  const users = useQuery({
    queryKey: ["users", search.query],
    queryFn: () =>
      apiFetch<{ data: UserRow[] }>(`/api/v1/users?q=${encodeURIComponent(search.query)}`),
    placeholderData: keepPreviousData,
  });
  const all = users.data?.data ?? [];
  const filteredUsers = all.filter((user) => !status || user.status === status);
  const statuses = [...new Set(all.map((user) => user.status))];
  const filtered = Boolean(search.query || status);
  function clearFilters() {
    search.clear();
    search.update({ q: undefined, status: undefined });
  }
  return (
    <PageContainer>
      <PageHeader
        actions={
          <Button asChild variant="primary">
            <Link href="/users/new">
              <UserPlus aria-hidden="true" className="size-3.5" /> Add user
            </Link>
          </Button>
        }
        description="People who sign in through this Authometry workspace."
        title="Users"
      />
      <FilterBar>
        <SearchInput
          className="sm:w-72"
          onChange={(event) => search.setValue(event.target.value)}
          onClear={search.clear}
          placeholder="Search name, email, or ID…"
          value={search.value}
        />
        <Select
          aria-label="User status"
          compact
          name="status"
          onChange={(event) => search.update({ status: event.target.value || undefined })}
          value={status}
          wrapperClassName="sm:w-40"
        >
          <option value="">All statuses</option>
          {statuses.map((value) => (
            <option key={value} value={value}>
              {humanize(value)}
            </option>
          ))}
        </Select>
        {filtered && (
          <Button className="sm:ml-auto" onClick={clearFilters} size="compact" variant="ghost">
            Clear filters
          </Button>
        )}
      </FilterBar>
      {users.isLoading ? (
        <ListSkeleton rows={7} />
      ) : users.isError ? (
        <ErrorState
          description="Authometry could not load users. Check your connection, then retry."
          headingLevel="h2"
          onRetry={() => void users.refetch()}
          retrying={users.isRefetching}
          title="Unable to load users"
        />
      ) : filteredUsers.length ? (
        <Table
          className={cn("transition-opacity", users.isPlaceholderData && "opacity-60")}
          columns={columns}
          label="Users"
        >
          <TableHeader>
            <span>User</span>
            <span>Status</span>
            <span>Sign-in method</span>
            <span>MFA</span>
            <span className="text-right">Sessions</span>
            <span className="text-right">Last sign-in</span>
          </TableHeader>
          <div className="stagger">
            {filteredUsers.map((user) => (
              <TableRow href={`/users/${user.id}`} key={user.id}>
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--geist-gray-100)] text-[11px] font-semibold text-[var(--text-secondary)] transition-transform duration-[var(--motion-normal)] ease-[var(--ease-spring)] group-hover:scale-105"
                  >
                    {user.name
                      .split(/\s+/)
                      .map((part) => part[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium">{user.name}</p>
                    <p className="truncate text-xs text-[var(--text-secondary)]">{user.email}</p>
                  </div>
                </div>
                <span>
                  <StatusBadge
                    label={humanize(user.status)}
                    tone={
                      user.status === "active"
                        ? "success"
                        : user.status === "suspended"
                          ? "danger"
                          : "neutral"
                    }
                  />
                </span>
                <span className="hidden truncate text-[13px] text-[var(--text-secondary)] lg:block">
                  {user.social_connections.length
                    ? user.social_connections.map(humanize).join(", ")
                    : "Password"}
                </span>
                <span className="hidden items-center gap-1.5 text-[13px] text-[var(--text-secondary)] lg:flex">
                  {user.mfa_enabled ? (
                    <>
                      <ShieldCheck aria-hidden="true" className="size-3.5 text-[var(--success)]" />
                      On
                    </>
                  ) : (
                    "Off"
                  )}
                </span>
                <span className="hidden text-right text-[13px] text-[var(--text-secondary)] tabular-nums lg:block">
                  {user.active_sessions}
                </span>
                <span className="hidden text-right text-[13px] text-[var(--text-secondary)] lg:block">
                  {user.last_authenticated_at ? (
                    <RelativeTime value={user.last_authenticated_at} />
                  ) : (
                    "Never"
                  )}
                </span>
              </TableRow>
            ))}
          </div>
          <TableFooter>
            <span>
              {filteredUsers.length} {filteredUsers.length === 1 ? "user" : "users"}
              {filtered && all.length !== filteredUsers.length ? ` of ${all.length}` : ""}
            </span>
          </TableFooter>
        </Table>
      ) : (
        <EmptyState
          description={
            filtered
              ? "Try a different search or status filter."
              : "Users appear after they sign in, or you can create one now."
          }
          icon={filtered ? SearchX : Users}
          primaryAction={
            filtered ? (
              <Button onClick={clearFilters}>Clear filters</Button>
            ) : (
              <Button asChild variant="primary">
                <Link href="/users/new">Add user</Link>
              </Button>
            )
          }
          title={filtered ? "No matching users" : "No users yet"}
        />
      )}
    </PageContainer>
  );
}
