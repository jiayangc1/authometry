"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Monitor, Smartphone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button, EmptyState, StatusBadge } from "@authometry/ui";
import { RelativeTime } from "@/components/data-display/formatted-time";
import { ErrorState, PageSkeleton } from "@/components/data-display/states";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { ConfirmDialog } from "@/components/overlays/confirm-dialog";
import { apiFetch } from "@/lib/api";

interface SessionRow {
  id: string;
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
export default function SessionsPage() {
  const client = useQueryClient();
  const [selectedSession, setSelectedSession] = useState<SessionRow>();
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
  return (
    <PageContainer>
      <PageHeader description="Review active user sessions and token activity." title="Sessions" />
      {query.isLoading ? (
        <PageSkeleton rows={8} />
      ) : query.isError ? (
        <ErrorState
          description="Authometry could not load active sessions. Check your connection, then retry."
          headingLevel="h2"
          onRetry={() => void query.refetch()}
          title="Unable to Load Sessions"
        />
      ) : query.data?.data.length ? (
        <div className="border-y border-[var(--border)]">
          {query.data.data.map((session) => (
            <div
              className="virtualized-row grid min-h-16 grid-cols-[28px_1fr_auto] items-center gap-3 border-b border-[var(--border-subtle)] px-2 py-2.5 last:border-0 sm:grid-cols-[28px_minmax(150px,1fr)_minmax(130px,1fr)_100px_120px_130px_auto]"
              key={session.id}
            >
              <span className="flex size-7 items-center justify-center rounded border border-[var(--border)]">
                {session.user_agent?.toLowerCase().includes("mobile") ? (
                  <Smartphone aria-hidden="true" className="size-3.5" />
                ) : (
                  <Monitor aria-hidden="true" className="size-3.5" />
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium">{session.user_name}</p>
                <p className="truncate text-xs text-[var(--text-secondary)]">{session.email}</p>
              </div>
              <span className="hidden truncate text-xs text-[var(--text-secondary)] sm:block">
                {session.application_name ?? "Unknown"}
              </span>
              <StatusBadge
                label={session.status}
                tone={session.status === "active" ? "success" : "neutral"}
              />
              <span className="technical-value hidden sm:block">{session.ip_address ?? "—"}</span>
              <span className="hidden text-xs text-[var(--text-tertiary)] sm:block">
                <RelativeTime value={session.last_active_at} />
              </span>
              <Button
                disabled={session.status !== "active"}
                onClick={() => setSelectedSession(session)}
                size="compact"
                variant="ghost"
              >
                Revoke
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          description="Active user and refresh-token sessions will appear here."
          title="No Sessions"
        />
      )}
      <ConfirmDialog
        actionLabel="Revoke Session"
        description="The user will be signed out of this session and must authenticate again."
        onConfirm={() => (selectedSession ? revoke(selectedSession) : undefined)}
        onOpenChange={(open) => {
          if (!open) setSelectedSession(undefined);
        }}
        open={Boolean(selectedSession)}
        pendingLabel="Revoking…"
        title={
          selectedSession ? `Revoke ${selectedSession.user_name}'s session?` : "Revoke session?"
        }
      />
    </PageContainer>
  );
}
