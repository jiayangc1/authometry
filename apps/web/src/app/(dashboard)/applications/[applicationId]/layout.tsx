"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  CirclePause,
  CirclePlay,
  Clipboard,
  FlaskConical,
  GitBranch,
  MoreHorizontal,
  Settings,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button, Note, StatusBadge } from "@authometry/ui";
import { ApplicationProvider, useApplication } from "@/components/applications/application-context";
import { CopyButton } from "@/components/data-display/copyable-value";
import { ErrorState, PageSkeleton } from "@/components/data-display/states";
import { Breadcrumbs, PageContainer } from "@/components/layout/page";
import {
  menuContentClass,
  menuDangerItemClass,
  menuItemClass,
  menuSeparatorClass,
} from "@/components/ui/menu";
import { TabNav } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/overlays/confirm-dialog";
import { ApiClientError, apiFetch } from "@/lib/api";

export default function ApplicationLayout({ children }: { children: React.ReactNode }) {
  const { applicationId } = useParams<{ applicationId: string }>();
  return (
    <ApplicationProvider applicationId={applicationId}>
      <ApplicationFrame>{children}</ApplicationFrame>
    </ApplicationProvider>
  );
}

function ApplicationFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingDisable, setConfirmingDisable] = useState(false);
  const [failedLogo, setFailedLogo] = useState<string>();
  const { application, loading, error, refetch } = useApplication();
  const deleteApplication = useMutation({
    mutationFn: (applicationId: string) =>
      apiFetch(`/api/v1/applications/${applicationId}`, {
        method: "DELETE",
      }),
    onSuccess: async (_result, applicationId) => {
      queryClient.removeQueries({ queryKey: ["application", applicationId] });
      await queryClient.invalidateQueries({ queryKey: ["applications"] });
      toast.success("Application deleted.");
      router.push("/applications");
    },
    onError: (mutationError) => toast.error(mutationError.message),
  });
  const changeStatus = useMutation({
    mutationFn: ({
      applicationId,
      status,
    }: {
      applicationId: string;
      status: "active" | "disabled";
    }) =>
      apiFetch(`/api/v1/applications/${applicationId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: async (_result, variables) => {
      await Promise.all([refetch(), queryClient.invalidateQueries({ queryKey: ["applications"] })]);
      toast.success(
        variables.status === "active" ? "Application enabled." : "Application disabled.",
      );
    },
    onError: (mutationError) => toast.error(mutationError.message),
  });
  if (loading)
    return (
      <PageContainer>
        <PageSkeleton metrics={false} />
      </PageContainer>
    );
  // A failed background refresh keeps showing the application that is already loaded.
  if (!application) {
    const missing = error instanceof ApiClientError && error.status === 404;
    return (
      <PageContainer>
        <Breadcrumbs
          items={[
            { label: "Applications", href: "/applications" },
            { label: missing ? "Not found" : "Unavailable" },
          ]}
        />
        <ErrorState
          title={missing ? "Application not found" : "Unable to load application"}
          description={
            missing
              ? "This application may have been deleted or belong to another environment. Switch environments or return to the application list."
              : "Authometry could not reach the API. Check your connection, then retry."
          }
          onRetry={() => void refetch()}
        />
      </PageContainer>
    );
  }
  const tabs = [
    ["Overview", `/applications/${application.id}`],
    ["Configuration", `/applications/${application.id}/configuration`],
    ["Scopes", `/applications/${application.id}/scopes`],
    ["Credentials", `/applications/${application.id}/credentials`],
    ["Activity", `/applications/${application.id}/activity`],
  ] as const;
  const clientId = application.client_id;
  const playgroundParameters = new URLSearchParams({
    client_id: clientId,
    scope: application.allowed_scopes.join(" "),
  });
  const redirectUri = application.redirect_uris[0];
  if (redirectUri) playgroundParameters.set("redirect_uri", redirectUri);
  const playgroundHref = `/developer/playground?${playgroundParameters.toString()}`;
  async function copyClientId() {
    try {
      await navigator.clipboard.writeText(clientId);
      toast.success("Client ID copied.");
    } catch {
      toast.error("Could not copy the client ID.");
    }
  }

  return (
    <PageContainer>
      <Breadcrumbs
        items={[{ label: "Applications", href: "/applications" }, { label: application.name }]}
      />
      <header className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-subtle)] text-sm font-semibold text-[var(--text-secondary)]">
            {application.logo_uri && failedLogo !== application.logo_uri ? (
              <img
                alt=""
                className="size-full object-cover"
                height={40}
                onError={() => setFailedLogo(application.logo_uri ?? undefined)}
                referrerPolicy="no-referrer"
                src={application.logo_uri}
                width={40}
              />
            ) : (
              application.name.charAt(0).toUpperCase()
            )}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl leading-8 font-semibold tracking-[-0.03em] break-words">
                {application.name}
              </h1>
              <StatusBadge
                label={application.status === "active" ? "Active" : "Disabled"}
                tone={application.status === "active" ? "success" : "neutral"}
              />
              {application.ownership === "manifest" && (
                <StatusBadge label="Managed by Git" tone="info" />
              )}
            </div>
            <p className="flex min-w-0 items-center gap-1 text-[13px] text-[var(--text-secondary)]">
              <span className="technical-value truncate">{clientId}</span>
              <CopyButton label="Copy client ID" value={clientId} />
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="primary">
            <Link href={playgroundHref}>
              <FlaskConical aria-hidden="true" className="size-3.5" /> Test sign-in
            </Link>
          </Button>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button aria-label="More actions" size="icon">
                <MoreHorizontal aria-hidden="true" className="size-4" />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" className={menuContentClass} sideOffset={6}>
                <DropdownMenu.Item asChild className={menuItemClass}>
                  <Link href={`/applications/${application.id}/configuration`}>
                    <Settings aria-hidden="true" /> Edit configuration
                  </Link>
                </DropdownMenu.Item>
                <DropdownMenu.Item asChild className={menuItemClass}>
                  <Link href={`/applications/${application.id}/activity`}>
                    <Activity aria-hidden="true" /> View activity
                  </Link>
                </DropdownMenu.Item>
                <DropdownMenu.Item className={menuItemClass} onSelect={() => void copyClientId()}>
                  <Clipboard aria-hidden="true" /> Copy client ID
                </DropdownMenu.Item>
                {application.ownership !== "manifest" && (
                  <>
                    <DropdownMenu.Separator className={menuSeparatorClass} />
                    {application.status === "active" ? (
                      <DropdownMenu.Item
                        className={menuItemClass}
                        onSelect={() => setConfirmingDisable(true)}
                      >
                        <CirclePause aria-hidden="true" /> Disable application
                      </DropdownMenu.Item>
                    ) : (
                      <DropdownMenu.Item
                        className={menuItemClass}
                        disabled={changeStatus.isPending}
                        onSelect={() =>
                          changeStatus.mutate({ applicationId: application.id, status: "active" })
                        }
                      >
                        <CirclePlay aria-hidden="true" /> Enable application
                      </DropdownMenu.Item>
                    )}
                    <DropdownMenu.Item
                      className={menuDangerItemClass}
                      disabled={deleteApplication.isPending}
                      onSelect={() => setConfirmingDelete(true)}
                    >
                      <Trash2 aria-hidden="true" />
                      {deleteApplication.isPending ? "Deleting…" : "Delete application"}
                    </DropdownMenu.Item>
                  </>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </header>
      {application.ownership === "manifest" && (
        <Note
          action={
            <Button asChild size="compact">
              <Link href={`/applications/${application.id}/configuration`}>View configuration</Link>
            </Button>
          }
          className="mb-5"
          icon={GitBranch}
          tone="info"
        >
          Configuration is managed in Git by{" "}
          <code className="technical-value">
            {application.manifest_path ?? `applications/${application.slug}.yaml`}
          </code>
          . Edit the manifest to make changes.
        </Note>
      )}
      {application.status === "disabled" && (
        <Note
          action={
            application.ownership !== "manifest" ? (
              <Button
                loading={changeStatus.isPending}
                onClick={() =>
                  changeStatus.mutate({ applicationId: application.id, status: "active" })
                }
                size="compact"
              >
                Enable
              </Button>
            ) : undefined
          }
          className="mb-5"
          tone="warning"
        >
          This application is disabled. Sign-ins and token requests are refused until it is enabled
          again.
        </Note>
      )}
      <TabNav
        className="mb-6"
        items={tabs.map(([label, href], index) => ({
          label,
          href,
          active: index === 0 ? pathname === href : pathname.startsWith(href),
        }))}
        label="Application sections"
      />
      <div className="animate-[fade-in_var(--motion-normal)_var(--ease-out)]" key={pathname}>
        {children}
      </div>
      <ConfirmDialog
        actionLabel="Disable application"
        description="New sign-ins and token requests will be refused until you enable it again. Nothing is deleted."
        onConfirm={() =>
          changeStatus.mutateAsync({ applicationId: application.id, status: "disabled" })
        }
        onOpenChange={setConfirmingDisable}
        open={confirmingDisable}
        pendingLabel="Disabling…"
        title={`Disable ${application.name}?`}
      />
      <ConfirmDialog
        actionLabel="Delete application"
        confirmationText={application.slug}
        description="Its sessions, grants, tokens, and credentials will stop working immediately. This cannot be undone."
        onConfirm={() => deleteApplication.mutateAsync(application.id)}
        onOpenChange={setConfirmingDelete}
        open={confirmingDelete}
        pendingLabel="Deleting…"
        title={`Delete ${application.name}?`}
      />
    </PageContainer>
  );
}
