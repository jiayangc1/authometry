"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button, EmptyState, Spinner, StatusBadge } from "@authometry/ui";
import { ErrorState, ListSkeleton } from "@/components/data-display/states";
import { SettingsSection } from "@/components/settings/settings-section";
import { Modal } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/form";
import { apiFetch } from "@/lib/api";

interface Member {
  id: string;
  email: string;
  name: string;
  role: "owner" | "admin" | "developer" | "auditor" | "viewer";
}
const roles: Member["role"][] = ["admin", "developer", "auditor", "viewer"];
const roleLabels: Record<Member["role"], string> = {
  owner: "Owner",
  admin: "Admin",
  developer: "Developer",
  auditor: "Auditor",
  viewer: "Viewer",
};
const roleDescriptions: Record<Member["role"], string> = {
  owner: "Full control, including deleting the workspace.",
  admin: "Manage members, settings, and every resource.",
  developer: "Create and edit applications, scopes, and policies.",
  auditor: "Read-only access plus traces and the audit log.",
  viewer: "Read-only access to configuration.",
};

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
      toast.success("Invitation sent.");
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
      toast.success("Role updated.");
    },
    onError: (error) => toast.error(error.message),
  });
  const smtpEnabled = Boolean(providers.data?.smtp.enabled);
  return (
    <>
      <SettingsSection
        description="People who can manage this workspace. Roles control what each member can change."
        footer={
          <Button
            disabled={!smtpEnabled}
            onClick={() => setInviting(true)}
            size="compact"
            variant="primary"
          >
            <UserPlus aria-hidden="true" className="size-3.5" /> Invite member
          </Button>
        }
        footerHint={
          smtpEnabled
            ? "Invitations are single-use and expire after 24 hours."
            : "Configure SMTP or Resend email delivery to send invitations."
        }
        title="Members"
      >
        {query.isLoading ? (
          <ListSkeleton rows={3} />
        ) : query.isError ? (
          <ErrorState
            description="Authometry could not load workspace members. Check your connection, then retry."
            headingLevel="h3"
            onRetry={() => void query.refetch()}
            title="Unable to load members"
          />
        ) : query.data?.data.length ? (
          <ul className="divide-y divide-[var(--border)] rounded-[var(--radius-control)] border border-[var(--border)]">
            {query.data.data.map((member) => {
              const pending = update.isPending && update.variables?.id === member.id;
              return (
                <li className="flex min-h-14 items-center gap-3 px-3 py-2" key={member.id}>
                  <span
                    aria-hidden="true"
                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--geist-gray-100)] text-[11px] font-semibold text-[var(--text-secondary)]"
                  >
                    {member.name
                      .split(/\s+/)
                      .map((part) => part[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{member.name}</p>
                    <p className="truncate text-xs text-[var(--text-secondary)]">{member.email}</p>
                  </div>
                  {pending && <Spinner className="size-3.5 text-[var(--text-tertiary)]" />}
                  {member.role === "owner" ? (
                    <StatusBadge label="Owner" tone="info" />
                  ) : (
                    <Select
                      aria-label={`Role for ${member.name}`}
                      compact
                      disabled={pending}
                      onChange={(event) =>
                        update.mutate({ id: member.id, role: event.target.value as Member["role"] })
                      }
                      value={member.role}
                      wrapperClassName="w-32"
                    >
                      {roles.map((role) => (
                        <option key={role} value={role}>
                          {roleLabels[role]}
                        </option>
                      ))}
                    </Select>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            description="Invite a teammate to give them access to this workspace."
            headingLevel="h3"
            icon={UserPlus}
            title="No members yet"
          />
        )}
      </SettingsSection>
      <SettingsSection description="What each role can do." title="Roles">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {(["owner", ...roles] as Member["role"][]).map((role) => (
            <div key={role}>
              <dt className="text-[13px] font-medium">{roleLabels[role]}</dt>
              <dd className="text-xs text-[var(--text-secondary)]">{roleDescriptions[role]}</dd>
            </div>
          ))}
        </dl>
      </SettingsSection>
      <Modal
        description="They’ll get an email with a single-use link that expires in 24 hours."
        footer={
          <>
            <Button disabled={invite.isPending} onClick={() => setInviting(false)}>
              Cancel
            </Button>
            <Button
              form="invite-member-form"
              loading={invite.isPending}
              type="submit"
              variant="primary"
            >
              Send invitation
            </Button>
          </>
        }
        onOpenChange={setInviting}
        open={inviting}
        preventClose={invite.isPending}
        title="Invite member"
      >
        <form
          autoComplete="off"
          className="grid gap-4 sm:grid-cols-2"
          id="invite-member-form"
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
          <Field label="Name">
            <Input autoComplete="off" autoFocus name="name" required />
          </Field>
          <Field label="Email">
            <Input autoComplete="off" name="email" required spellCheck={false} type="email" />
          </Field>
          <Field className="sm:col-span-2" label="Role">
            <Select defaultValue="developer" name="role">
              {roles.map((role) => (
                <option key={role} value={role}>
                  {roleLabels[role]} — {roleDescriptions[role]}
                </option>
              ))}
            </Select>
          </Field>
        </form>
      </Modal>
    </>
  );
}
