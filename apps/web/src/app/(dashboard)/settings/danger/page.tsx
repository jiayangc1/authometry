"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button, StatusBadge } from "@authometry/ui";
import { ErrorState, ListSkeleton } from "@/components/data-display/states";
import { SettingsSection } from "@/components/settings/settings-section";
import { ConfirmDialog } from "@/components/overlays/confirm-dialog";
import { apiFetch } from "@/lib/api";

interface DangerState {
  workspace_name: string;
  environment_status: "active" | "disabled";
}
export default function DangerPage() {
  const client = useQueryClient();
  const router = useRouter();
  const [confirmingDisable, setConfirmingDisable] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const query = useQuery({
    queryKey: ["danger-settings"],
    queryFn: () => apiFetch<DangerState>("/api/v1/settings/danger"),
  });
  const status = useMutation({
    mutationFn: (value: "active" | "disabled") =>
      apiFetch("/api/v1/settings/danger/status", {
        method: "POST",
        body: JSON.stringify({ status: value }),
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["danger-settings"] });
      toast.success("Environment status updated.");
    },
    onError: (error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: () =>
      apiFetch("/api/v1/settings/danger/workspace", {
        method: "DELETE",
        body: JSON.stringify({ confirmation: query.data?.workspace_name }),
      }),
    onSuccess: () => {
      client.clear();
      toast.success("Workspace deleted.");
      router.push("/login");
    },
    onError: (error) => toast.error(error.message),
  });
  const disabled = query.data?.environment_status === "disabled";
  if (query.isLoading) return <ListSkeleton rows={2} />;
  if (query.isError)
    return (
      <ErrorState
        description="Authometry could not load environment controls. Check your connection, then retry."
        headingLevel="h2"
        onRetry={() => void query.refetch()}
        title="Unable to load the danger zone"
      />
    );
  return (
    <>
      <SettingsSection
        description="Stop new sign-ins and token issuance in this environment while keeping its configuration and audit data."
        footer={
          <Button
            loading={status.isPending}
            onClick={() => {
              if (disabled) status.mutate("active");
              else setConfirmingDisable(true);
            }}
            size="compact"
            variant={disabled ? "primary" : "danger"}
          >
            {disabled ? "Enable environment" : "Disable environment"}
          </Button>
        }
        footerHint={
          <span className="flex items-center gap-2">
            <StatusBadge
              label={disabled ? "Disabled" : "Active"}
              tone={disabled ? "danger" : "success"}
            />
            Existing access tokens stay valid until they expire.
          </span>
        }
        title="Environment status"
        tone="danger"
      />
      <SettingsSection
        description="Permanently delete this workspace with every identity, application, token, trace, and configuration. This cannot be undone."
        footer={
          <Button onClick={() => setConfirmingDelete(true)} size="compact" variant="danger">
            Delete workspace
          </Button>
        }
        footerHint="You’ll be asked to type the workspace name."
        title="Delete workspace"
        tone="danger"
      />
      <ConfirmDialog
        actionLabel="Disable environment"
        description="New sign-ins and token issuance stop immediately. Existing access tokens stay valid until they expire."
        onConfirm={() => status.mutateAsync("disabled")}
        onOpenChange={setConfirmingDisable}
        open={confirmingDisable}
        pendingLabel="Disabling…"
        title="Disable this environment?"
      />
      <ConfirmDialog
        actionLabel="Delete workspace"
        confirmationText={query.data?.workspace_name ?? ""}
        description="Every identity, application, token, trace, and configuration in this workspace will be permanently deleted."
        onConfirm={() => remove.mutateAsync()}
        onOpenChange={setConfirmingDelete}
        open={confirmingDelete}
        pendingLabel="Deleting…"
        title={`Delete ${query.data?.workspace_name ?? "workspace"}?`}
      />
    </>
  );
}
