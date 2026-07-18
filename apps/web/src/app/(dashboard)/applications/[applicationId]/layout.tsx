"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Activity,
  ChevronRight,
  Clipboard,
  FlaskConical,
  GitBranch,
  MoreHorizontal,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { toast } from "sonner";
import { Button, StatusBadge, cn } from "@authometry/ui";
import { ApplicationProvider, useApplication } from "@/components/applications/application-context";
import { ErrorState, PageSkeleton } from "@/components/data-display/states";
import { PageContainer } from "@/components/layout/page";

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
  const { application, loading, error, refetch } = useApplication();
  if (loading)
    return (
      <PageContainer>
        <PageSkeleton />
      </PageContainer>
    );
  if (error || !application)
    return (
      <PageContainer>
        <ErrorState
          title="Application Not Found"
          description="This application may have been deleted or belong to another environment. Check the application URL, then retry."
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
      <div className="mb-5 flex items-center gap-1 text-xs text-[var(--text-secondary)]">
        <Link className="hover:text-[var(--text-primary)]" href="/applications">
          Applications
        </Link>
        <ChevronRight aria-hidden="true" className="size-3" />
        <span className="truncate">{application.name}</span>
      </div>
      <header className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl leading-8 font-semibold tracking-[-0.035em] text-balance break-words">
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
          <p className="technical-value mt-1 text-[var(--text-secondary)]">{application.slug}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href={playgroundHref}>
              <FlaskConical aria-hidden="true" className="size-3.5" /> Test Authorization
            </Link>
          </Button>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button aria-label="More actions" size="icon">
                <MoreHorizontal aria-hidden="true" className="size-4" />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                className="z-50 min-w-48 overscroll-contain rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-1 shadow-[0_12px_30px_rgba(0,0,0,0.10)]"
                sideOffset={6}
              >
                <DropdownMenu.Item asChild>
                  <Link
                    className="flex cursor-default items-center gap-2 rounded-md px-2.5 py-2 text-[13px] outline-none focus:bg-[var(--surface-hover)]"
                    href={`/applications/${application.id}/configuration`}
                  >
                    <Settings
                      aria-hidden="true"
                      className="size-3.5 text-[var(--text-secondary)]"
                    />{" "}
                    Edit Configuration
                  </Link>
                </DropdownMenu.Item>
                <DropdownMenu.Item asChild>
                  <Link
                    className="flex cursor-default items-center gap-2 rounded-md px-2.5 py-2 text-[13px] outline-none focus:bg-[var(--surface-hover)]"
                    href={`/applications/${application.id}/activity`}
                  >
                    <Activity
                      aria-hidden="true"
                      className="size-3.5 text-[var(--text-secondary)]"
                    />{" "}
                    View Activity
                  </Link>
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="my-1 h-px bg-[var(--border)]" />
                <DropdownMenu.Item
                  className="flex cursor-default items-center gap-2 rounded-md px-2.5 py-2 text-[13px] outline-none focus:bg-[var(--surface-hover)]"
                  onSelect={() => void copyClientId()}
                >
                  <Clipboard aria-hidden="true" className="size-3.5 text-[var(--text-secondary)]" />{" "}
                  Copy Client ID
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </header>
      {application.ownership === "manifest" && (
        <div className="mb-5 flex items-center gap-3 border border-[var(--info-border)] bg-[var(--info-soft)] px-3 py-2.5 text-[13px]">
          <GitBranch aria-hidden="true" className="size-4 text-[var(--info)]" />
          <span className="flex-1">
            Configuration is managed by{" "}
            <code className="technical-value">
              {application.manifest_path ?? `applications/${application.slug}.yaml`}
            </code>
            .
          </span>
          <Button asChild size="compact">
            <Link href={`/applications/${application.id}/configuration`}>View Configuration</Link>
          </Button>
        </div>
      )}
      <nav
        className="mb-7 flex gap-5 overflow-x-auto border-b border-[var(--border)]"
        aria-label="Application sections"
      >
        {tabs.map(([label, href], index) => {
          const active = index === 0 ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              className={cn(
                "relative shrink-0 pb-2.5 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                active &&
                  "font-medium text-[var(--text-primary)] after:absolute after:right-0 after:bottom-[-1px] after:left-0 after:h-0.5 after:bg-[var(--accent)]",
              )}
              href={href}
              aria-current={active ? "page" : undefined}
              key={href}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      {children}
    </PageContainer>
  );
}
