"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, Plus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button, Checkbox, EmptyState, StatusBadge } from "@authometry/ui";
import { inputClass } from "@/components/auth/auth-shell";
import { RelativeTime } from "@/components/data-display/formatted-time";
import { CopyableValue } from "@/components/data-display/copyable-value";
import { ErrorState, PageSkeleton } from "@/components/data-display/states";
import { ConfirmDialog } from "@/components/overlays/confirm-dialog";
import { SettingsSection } from "@/components/settings/settings-section";
import { apiFetch } from "@/lib/api";

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
      setAdding(false);
      await client.invalidateQueries({ queryKey: ["provisioning-connections"] });
      toast.success(
        result.queued
          ? `Provisioning connected; ${result.queued} existing users queued`
          : "Provisioning connected",
      );
    },
    onError: (error) => toast.error(error.message),
  });
  const sync = useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ queued: number }>(`/api/v1/settings/provisioning/${id}/sync`, {
        method: "POST",
      }),
    onSuccess: ({ queued }) => toast.success(`${queued} users queued for provisioning`),
    onError: (error) => toast.error(error.message),
  });
  const disconnect = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/settings/provisioning/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["provisioning-connections"] });
      toast.success("Provisioning connection removed");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <SettingsSection
      description="Create and remove accounts in connected services when Authometry users change. Passwords are never included."
      title="Account provisioning"
    >
      <div className="flex justify-end">
        <Button onClick={() => setAdding((value) => !value)}>
          <Plus aria-hidden="true" className="size-3.5" /> Add Connection
        </Button>
      </div>
      {adding && (
        <form
          autoComplete="off"
          className="grid gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const name = data.get("name");
            const url = data.get("url");
            if (typeof name === "string" && typeof url === "string") {
              create.mutate({
                name,
                url,
                syncExistingUsers: data.get("syncExistingUsers") === "on",
              });
            }
          }}
        >
          <label>
            <span className="mb-1.5 block text-xs font-medium">Service name</span>
            <input
              autoComplete="off"
              className={inputClass}
              name="name"
              placeholder="CamSaver"
              required
            />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-medium">Provisioning endpoint</span>
            <input
              autoComplete="off"
              className={inputClass}
              name="url"
              placeholder="https://service.example/api/webhooks/authometry"
              required
              type="url"
            />
          </label>
          <label className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
            <Checkbox defaultChecked name="syncExistingUsers" wrapperClassName="mt-0.5" />
            <span>Queue existing Authometry users after connecting.</span>
          </label>
          <Button
            className="justify-self-end"
            disabled={create.isPending}
            type="submit"
            variant="primary"
          >
            {create.isPending ? "Connecting…" : "Connect Service"}
          </Button>
        </form>
      )}
      {secret && (
        <div className="border border-[var(--warning-border)] bg-[var(--warning-soft)] p-3">
          <p className="text-xs font-semibold">Copy the signing secret now</p>
          <div className="mt-2">
            <CopyableValue value={secret} />
          </div>
          <p className="mt-2 text-xs text-[var(--text-secondary)]">
            Configure this secret in the connected service. It will not be displayed again.
          </p>
        </div>
      )}
      {query.isLoading ? (
        <PageSkeleton rows={4} />
      ) : query.isError ? (
        <ErrorState
          description="Authometry could not load provisioning connections. Check your connection, then retry."
          headingLevel="h3"
          onRetry={() => void query.refetch()}
          title="Unable to Load Provisioning"
        />
      ) : query.data?.data.length ? (
        <div className="border-y border-[var(--border)]">
          {query.data.data.map((connection) => (
            <div
              className="virtualized-row grid min-h-20 gap-3 border-b border-[var(--border-subtle)] px-2 py-3 last:border-0 sm:grid-cols-[1fr_auto] sm:items-center"
              key={connection.id}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-medium">{connection.name}</p>
                  <StatusBadge
                    label={connection.failed_deliveries ? "delivery errors" : connection.status}
                    tone={connection.failed_deliveries ? "danger" : "success"}
                  />
                </div>
                <p className="technical-value mt-1 truncate text-[var(--text-tertiary)]">
                  {connection.url}
                </p>
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                  Secret {connection.secret_prefix}… · Last delivered{" "}
                  {connection.last_delivered_at ? (
                    <RelativeTime value={connection.last_delivered_at} />
                  ) : (
                    "never"
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  disabled={sync.isPending}
                  onClick={() => sync.mutate(connection.id)}
                  size="compact"
                >
                  <RefreshCw aria-hidden="true" className="size-3.5" /> Sync Users
                </Button>
                <Button
                  disabled={disconnect.isPending}
                  onClick={() => setSelectedConnection(connection)}
                  size="compact"
                  variant="ghost"
                >
                  Disconnect
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          description="Connect a service endpoint to provision Authometry users automatically."
          headingLevel="h3"
          icon={Link2}
          title="No Provisioning Connections"
        />
      )}
      <ConfirmDialog
        actionLabel="Disconnect Service"
        description="Authometry will stop sending user lifecycle events to this service. Existing downstream accounts are not changed."
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
    </SettingsSection>
  );
}
