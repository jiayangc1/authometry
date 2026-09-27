"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
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
import { apiFetch } from "@/lib/api";

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
  if (loading)
    return (
      <PageContainer>
        <PageSkeleton metrics={false} />
      </PageContainer>
    );
  if (error || !application)
    return (
      <PageContainer>
        <Breadcrumbs
          items={[{ label: "Applications", href: "/applications" }, { label: "Not found" }]}
        />
        <ErrorState
          title="Application not found"
          description="This application may have been deleted or belong to another environment. Switch environments or return to the application list."
          onRetry={() => void refetch()}
        />
      </PageContainer>
    );
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
            {application.logo_uri ? (
              <img alt="" className="size-full object-cover" src={application.logo_uri} />
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
