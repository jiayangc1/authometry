"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button, EmptyState, StatusBadge } from "@authometry/ui";
import { inputClass } from "@/components/auth/auth-shell";
import { ErrorState, PageSkeleton } from "@/components/data-display/states";
import { SettingsSection } from "@/components/settings/settings-section";
import { apiFetch } from "@/lib/api";

interface Member {
  id: string;
  email: string;
  name: string;
  role: "owner" | "admin" | "developer" | "auditor" | "viewer";
}
const roles: Member["role"][] = ["admin", "developer", "auditor", "viewer"];

export default function MembersPage() {
  const client = useQueryClient();
  const [inviting, setInviting] = useState(false);
  const query = useQuery({
    queryKey: ["members"],
    queryFn: () => apiFetch<{ data: Member[] }>("/api/v1/settings/members"),
  });
  const providers = useQuery({
    queryKey: ["settings-providers"],
    queryFn: () => apiFetch<{ smtp: { enabled: boolean } }>("/api/v1/settings/providers"),
  });
  const invite = useMutation({
    mutationFn: (input: { name: string; email: string; role: Member["role"] }) =>
      apiFetch("/api/v1/settings/members", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: async () => {
      setInviting(false);
      await client.invalidateQueries({ queryKey: ["members"] });
      toast.success("Workspace invitation sent");
    },
    onError: (error) => toast.error(error.message),
  });
  const update = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Member["role"] }) =>
      apiFetch(`/api/v1/settings/members/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["members"] });
      toast.success("Member role updated");
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <SettingsSection
      description="Members can access workspace environments according to their assigned role."
      title="Workspace Members"
    >
      <div className="flex justify-end">
        <Button
          disabled={!providers.data?.smtp.enabled}
          onClick={() => setInviting((value) => !value)}
          title={providers.data?.smtp.enabled ? undefined : "Configure SMTP to invite members"}
        >
          <UserPlus aria-hidden="true" className="size-3.5" /> Invite Member
        </Button>
      </div>
      {inviting && (
        <form
          autoComplete="off"
          className="grid gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const name = data.get("name");
            const email = data.get("email");
            const role = data.get("role");
            if (typeof name === "string" && typeof email === "string" && typeof role === "string")
              invite.mutate({ name, email, role: role as Member["role"] });
          }}
        >
          <label>
            <span className="mb-1.5 block text-xs font-medium">Name</span>
            <input autoComplete="off" className={inputClass} name="name" required />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-medium">Email</span>
            <input
              autoComplete="email"
              className={inputClass}
              name="email"
              required
              spellCheck={false}
              type="email"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-medium">Role</span>
            <select className={inputClass} defaultValue="developer" name="role">
              {roles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
          <Button className="self-end" disabled={invite.isPending} type="submit" variant="primary">
            {invite.isPending ? "Sending…" : "Send Invitation"}
          </Button>
        </form>
      )}
      {query.isLoading ? (
        <PageSkeleton rows={5} />
      ) : query.isError ? (
        <ErrorState
          description="Authometry could not load workspace members. Check your connection, then retry."
          headingLevel="h3"
          onRetry={() => void query.refetch()}
          title="Unable to Load Members"
        />
      ) : query.data?.data.length ? (
        <div className="border-y border-[var(--border)]">
          {query.data.data.map((member) => (
            <div
              className="virtualized-row grid min-h-16 grid-cols-[1fr_auto] items-center gap-3 border-b border-[var(--border-subtle)] px-2 last:border-0 sm:grid-cols-[1fr_220px]"
              key={member.id}
            >
              <div>
                <p className="text-[13px] font-medium">{member.name}</p>
                <p className="text-xs text-[var(--text-secondary)]">{member.email}</p>
              </div>
              {member.role === "owner" ? (
                <StatusBadge label="Owner" tone="info" />
              ) : (
                <select
                  aria-label={`Role for ${member.name}`}
                  className="h-8 rounded border border-[var(--border)] bg-[var(--surface-raised)] px-2 text-xs text-[var(--foreground)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none"
                  disabled={update.isPending}
                  onChange={(event) =>
                    update.mutate({ id: member.id, role: event.target.value as Member["role"] })
                  }
                  value={member.role}
                >
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          description="Invite a teammate to give them access to this workspace."
          headingLevel="h3"
          icon={UserPlus}
          title="No Workspace Members"
        />
      )}
      <p className="text-xs text-[var(--text-tertiary)]">
        Invitations are single-use, expire after 24 hours, and require configured SMTP delivery.
      </p>
    </SettingsSection>
  );
}
