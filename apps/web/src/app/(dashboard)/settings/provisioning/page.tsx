"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, Plus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button, Checkbox, Note, StatusBadge } from "@authometry/ui";
import { RelativeTime } from "@/components/data-display/formatted-time";
import { Snippet } from "@/components/data-display/copyable-value";
import { ErrorState, ListSkeleton } from "@/components/data-display/states";
import { ConfirmDialog } from "@/components/overlays/confirm-dialog";
import { SettingsSection } from "@/components/settings/settings-section";
import { Modal } from "@/components/ui/dialog";
import { ChoiceRow, Field, Input } from "@/components/ui/form";
import { apiFetch } from "@/lib/api";
import { humanize } from "@/lib/status";

interface ProvisioningConnection {
  id: string;
  name: string;
  url: string;
  secret_prefix: string;
  status: string;
  failed_deliveries: number;
  last_delivered_at?: string;
}

export default function ProvisioningPage() {
  const client = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [secret, setSecret] = useState<string>();
  const [selectedConnection, setSelectedConnection] = useState<ProvisioningConnection>();
  const query = useQuery({
    queryKey: ["provisioning-connections"],
    queryFn: () => apiFetch<{ data: ProvisioningConnection[] }>("/api/v1/settings/provisioning"),
  });
  const create = useMutation({
    mutationFn: (input: { name: string; url: string; syncExistingUsers: boolean }) =>
      apiFetch<{ id: string; secret: string; queued: number }>("/api/v1/settings/provisioning", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: async (result) => {
      setSecret(result.secret);
      await client.invalidateQueries({ queryKey: ["provisioning-connections"] });
      toast.success(
        result.queued ? `Connected. ${result.queued} existing users queued.` : "Connected.",
      );
    },
    onError: (error) => toast.error(error.message),
  });
  const sync = useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ queued: number }>(`/api/v1/settings/provisioning/${id}/sync`, {
        method: "POST",
      }),
    onSuccess: ({ queued }) => toast.success(`${queued} users queued for provisioning.`),
    onError: (error) => toast.error(error.message),
  });
  const disconnect = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/settings/provisioning/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["provisioning-connections"] });
      toast.success("Connection removed.");
    },
    onError: (error) => toast.error(error.message),
  });

  function close() {
    setAdding(false);
    setSecret(undefined);
  }
  return (
    <>
      <SettingsSection
        description="Create and remove accounts in connected services as Authometry users change. Passwords are never sent."
        footer={
          <Button onClick={() => setAdding(true)} size="compact" variant="primary">
            <Plus aria-hidden="true" className="size-3.5" /> Add connection
          </Button>
        }
        footerHint="Portal apps need a provisioning connection before people can launch them."
        title="Account provisioning"
      >
        {query.isLoading ? (
          <ListSkeleton rows={2} />
        ) : query.isError ? (
          <ErrorState
            description="Authometry could not load provisioning connections. Check your connection, then retry."
            headingLevel="h3"
            onRetry={() => void query.refetch()}
            title="Unable to load provisioning"
          />
        ) : query.data?.data.length ? (
          <ul className="divide-y divide-[var(--border)] rounded-[var(--radius-control)] border border-[var(--border)]">
            {query.data.data.map((connection) => (
              <li
                className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center"
                key={connection.id}
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <Link2
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-[var(--text-secondary)]"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[13px] font-medium">{connection.name}</p>
                      <StatusBadge
                        label={
                          connection.failed_deliveries
                            ? `${connection.failed_deliveries} failed ${connection.failed_deliveries === 1 ? "delivery" : "deliveries"}`
                            : humanize(connection.status)
                        }
                        tone={connection.failed_deliveries ? "danger" : "success"}
                      />
                    </div>
                    <p className="technical-value truncate text-[var(--text-tertiary)]">
                      {connection.url}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Secret <span className="technical-value">{connection.secret_prefix}…</span> ·
                      Last delivered{" "}
                      {connection.last_delivered_at ? (
                        <RelativeTime value={connection.last_delivered_at} />
                      ) : (
                        "never"
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1 pl-7 sm:pl-0">
                  <Button
                    className="[&:hover_svg]:rotate-180"
                    loading={sync.isPending && sync.variables === connection.id}
                    onClick={() => sync.mutate(connection.id)}
                    size="compact"
                  >
                    {!(sync.isPending && sync.variables === connection.id) && (
                      <RefreshCw aria-hidden="true" className="size-3.5" />
                    )}
                    Sync users
                  </Button>
                  <Button
                    className="hover:text-[var(--danger)]"
                    onClick={() => setSelectedConnection(connection)}
                    size="compact"
                    variant="ghost"
                  >
                    Disconnect
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-[var(--radius-control)] border border-dashed border-[var(--border-strong)] px-4 py-6 text-center text-[13px] text-[var(--text-secondary)]">
            No services connected yet.
          </p>
        )}
      </SettingsSection>
      <ConfirmDialog
        actionLabel="Disconnect"
        description="Authometry stops sending user lifecycle events to this service. Existing downstream accounts are not changed."
        onConfirm={() =>
          selectedConnection ? disconnect.mutateAsync(selectedConnection.id) : undefined
        }
        onOpenChange={(open) => {
          if (!open) setSelectedConnection(undefined);
        }}
        open={Boolean(selectedConnection)}
        pendingLabel="Disconnecting…"
        title={
          selectedConnection ? `Disconnect ${selectedConnection.name}?` : "Disconnect service?"
        }
      />
      <Modal
        description={
          secret
            ? "Configure this signing secret in the connected service. It won’t be shown again."
            : "Authometry sends signed user lifecycle events to this endpoint."
        }
        footer={
          secret ? (
            <Button onClick={close} variant="primary">
              Done
            </Button>
          ) : (
            <>
              <Button disabled={create.isPending} onClick={close}>
                Cancel
              </Button>
              <Button
                form="provisioning-form"
                loading={create.isPending}
                type="submit"
                variant="primary"
              >
                Connect service
              </Button>
            </>
          )
        }
        onOpenChange={(next) => (next ? setAdding(true) : close())}
        open={adding}
        preventClose={create.isPending}
        title={secret ? "Signing secret" : "Add provisioning connection"}
      >
        {secret ? (
          <div className="space-y-3">
            <Note tone="warning">Copy this secret now.</Note>
            <Snippet label="signing secret" value={secret} />
          </div>
        ) : (
          <form
            autoComplete="off"
            className="space-y-4"
            id="provisioning-form"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const name = data.get("name");
              const url = data.get("url");
              if (typeof name === "string" && typeof url === "string") {
                create.mutate({
                  name: name.trim(),
                  url: url.trim(),
                  syncExistingUsers: data.get("syncExistingUsers") === "on",
                });
              }
            }}
          >
            <Field label="Service name">
              <Input autoFocus name="name" placeholder="CamSaver" required />
            </Field>
            <Field label="Provisioning endpoint">
              <Input
                mono
                name="url"
                placeholder="https://service.example/api/webhooks/authometry"
                required
                type="url"
              />
            </Field>
            <ChoiceRow
              control={<Checkbox defaultChecked name="syncExistingUsers" />}
              description="Queue every current user for this service right away."
              title="Sync existing users"
            />
          </form>
        )}
      </Modal>
    </>
  );
}
