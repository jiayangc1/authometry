"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Monitor, SearchX, Smartphone } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button, EmptyState, StatusBadge } from "@authometry/ui";
import { RelativeTime } from "@/components/data-display/formatted-time";
import { FilterBar, SearchInput } from "@/components/data-display/search-input";
import { ErrorState, ListSkeleton } from "@/components/data-display/states";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { ConfirmDialog } from "@/components/overlays/confirm-dialog";
import { SegmentedControl } from "@/components/ui/tabs";
import { Table, TableFooter, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch } from "@/lib/api";
import { humanize } from "@/lib/status";
import { useDebouncedSearchParam } from "@/lib/use-query-params";

interface SessionRow {
  id: string;
  user_id: string;
  email: string;
  user_name: string;
  application_name?: string;
  status: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  last_active_at: string;
  expires_at: string;
}
const pageSize = 50;

export default function SessionsPage() {
  const client = useQueryClient();
  const [selectedSession, setSelectedSession] = useState<SessionRow>();
  const search = useDebouncedSearchParam("q");
  const filter = search.value;
  const activeOnly = search.parameters.get("status") !== "all";
  const [shown, setShown] = useState(pageSize);
  const query = useQuery({
    queryKey: ["sessions"],
    queryFn: () => apiFetch<{ data: SessionRow[] }>("/api/v1/sessions"),
  });
  async function revoke(session: SessionRow) {
    try {
      await apiFetch(`/api/v1/sessions/${session.id}/revoke`, { method: "POST" });
      await client.invalidateQueries({ queryKey: ["sessions"] });
      toast.success("Session revoked.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The session could not be revoked.");
      throw error;
    }
  }
  const needle = filter.trim().toLowerCase();
  const all = query.data?.data ?? [];
  const rows = all.filter(
    (session) =>
      (!activeOnly || session.status === "active") &&
      (!needle ||
        [session.user_name, session.email, session.application_name, session.ip_address]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(needle))),
  );
  const visibleRows = rows.slice(0, shown);
  return (
    <PageContainer>
      <PageHeader
        description="Signed-in sessions across your applications. Revoke one to sign that person out."
        title="Sessions"
      />
      <FilterBar>
        <SearchInput
          className="sm:w-72"
          onChange={(event) => search.setValue(event.target.value)}
          onClear={search.clear}
          placeholder="Filter by person, app, or IP…"
          value={filter}
        />
        <SegmentedControl
          className="sm:ml-auto"
          label="Session status"
          onChange={(value) => search.update({ status: value === "all" ? "all" : undefined })}
          options={[
            { value: "active", label: "Active" },
            { value: "all", label: "All" },
          ]}
          size="compact"
          value={activeOnly ? "active" : "all"}
        />
      </FilterBar>
      {query.isLoading ? (
        <ListSkeleton rows={8} />
      ) : query.isError ? (
        <ErrorState
          description="Authometry could not load sessions. Check your connection, then retry."
          headingLevel="h2"
          onRetry={() => void query.refetch()}
          retrying={query.isRefetching}
          title="Unable to load sessions"
        />
      ) : rows.length ? (
        <Table
          columns="minmax(200px,1.3fr) minmax(140px,1fr) 100px 130px 120px 90px"
          label="Sessions"
        >
          <TableHeader>
            <span>Person</span>
            <span>Application</span>
            <span>Status</span>
            <span>IP address</span>
            <span>Last active</span>
            <span />
          </TableHeader>
          <div className="stagger">
            {visibleRows.map((session) => {
              const mobile = session.user_agent?.toLowerCase().includes("mobile");
              return (
                <TableRow key={session.id} mobileColumns="minmax(0,1fr) auto">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--text-secondary)]"
                      title={session.user_agent}
                    >
                      {mobile ? (
                        <Smartphone aria-label="Mobile" className="size-3.5" />
                      ) : (
                        <Monitor aria-label="Desktop" className="size-3.5" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium">
                        <Link
                          className="rounded-[4px] hover:underline focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:outline-none"
                          href={`/users/${session.user_id}`}
                        >
                          {session.user_name}
                        </Link>
                      </p>
                      <p className="truncate text-xs text-[var(--text-secondary)]">
                        {session.email}
                        <span className="lg:hidden">
                          {" "}
                          · {session.application_name ?? "Dashboard"} ·{" "}
                          <RelativeTime value={session.last_active_at} />
                        </span>
                      </p>
                    </div>
                  </div>
                  <span className="hidden truncate text-[13px] text-[var(--text-secondary)] lg:block">
                    {session.application_name ?? "Dashboard"}
                  </span>
                  <span className="hidden lg:block">
                    <StatusBadge
                      label={humanize(session.status)}
                      tone={session.status === "active" ? "success" : "neutral"}
                    />
                  </span>
                  <span className="technical-value hidden text-[var(--text-secondary)] lg:block">
                    {session.ip_address ?? "—"}
                  </span>
                  <span className="hidden text-[13px] text-[var(--text-secondary)] lg:block">
                    <RelativeTime value={session.last_active_at} />
                  </span>
                  <span className="flex justify-end">
                    {session.status === "active" ? (
                      <Button
                        className="hover:text-[var(--danger)]"
                        onClick={() => setSelectedSession(session)}
                        size="compact"
                        variant="ghost"
                      >
                        Revoke
                      </Button>
                    ) : (
                      <span className="text-xs text-[var(--text-tertiary)] lg:hidden">
                        {humanize(session.status)}
                      </span>
                    )}
                  </span>
                </TableRow>
              );
            })}
          </div>
          <TableFooter>
            <span>
              {rows.length} of {all.length} {all.length === 1 ? "session" : "sessions"}
              {visibleRows.length < rows.length ? ` · showing ${visibleRows.length}` : ""}
            </span>
            {visibleRows.length < rows.length && (
              <Button onClick={() => setShown(shown + pageSize)} size="compact" variant="ghost">
                Show more
              </Button>
            )}
          </TableFooter>
        </Table>
      ) : (
        <EmptyState
          description={
            all.length
              ? "No sessions match this filter."
              : "Sessions appear here when people sign in to your applications."
          }
          icon={all.length ? SearchX : Monitor}
          primaryAction={
            all.length ? (
              <Button
                onClick={() => {
                  search.clear();
                  search.update({ q: undefined, status: "all" });
                }}
              >
                Clear filters
              </Button>
            ) : undefined
          }
          title={all.length ? "No matching sessions" : "No sessions"}
        />
      )}
      <ConfirmDialog
        actionLabel="Revoke session"
        description="They will be signed out of this session and must sign in again."
        onConfirm={() => (selectedSession ? revoke(selectedSession) : undefined)}
        onOpenChange={(open) => {
          if (!open) setSelectedSession(undefined);
        }}
        open={Boolean(selectedSession)}
        pendingLabel="Revoking…"
        title={
          selectedSession ? `Revoke ${selectedSession.user_name}’s session?` : "Revoke session?"
        }
      />
    </PageContainer>
  );
}
