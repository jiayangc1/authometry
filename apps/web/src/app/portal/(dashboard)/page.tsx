"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, AppWindow, Check, Clock3, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button, EmptyState } from "@authometry/ui";
import type { PortalMe } from "@/components/portal/types";
import { RelativeTime } from "@/components/data-display/formatted-time";
import { ErrorState } from "@/components/data-display/states";
import { portalApiFetch } from "@/lib/portal-api";

interface PortalApplication {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo_uri?: string | null;
  last_launched_at?: string;
  provisioning_enabled: boolean;
}

function ApplicationLogo({ application }: { application: PortalApplication }) {
  const [failed, setFailed] = useState(false);
  const fallback = application.name.slice(0, 2).toUpperCase();

  return (
    <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-[15px] bg-[var(--portal-accent)] text-base font-semibold text-white ring-1 ring-black/5">
      {application.logo_uri && !failed ? (
        <img
          alt=""
          className="size-full object-cover"
          onError={() => setFailed(true)}
          referrerPolicy="no-referrer"
          src={application.logo_uri}
        />
      ) : (
        fallback
      )}
    </span>
  );
}

export default function PortalApplicationsPage() {
  const [launching, setLaunching] = useState<string>();
  const me = useQuery({
    queryKey: ["portal-me"],
    queryFn: () => portalApiFetch<PortalMe>("/me"),
  });
  const applications = useQuery({
    queryKey: ["portal-applications"],
    queryFn: () => portalApiFetch<{ data: PortalApplication[] }>("/applications"),
  });

  async function launch(application: PortalApplication) {
    const tab = window.open("about:blank", "_blank");
    if (!tab) {
      toast.error("Allow pop-ups for this portal, then try again.");
      return;
    }
    tab.opener = null;
    tab.document.title = `Opening ${application.name}…`;
    tab.document.body.textContent = `Opening ${application.name}…`;
    setLaunching(application.id);
    try {
      const result = await portalApiFetch<{ url: string }>(
        `/applications/${application.id}/launch`,
        {
          method: "POST",
        },
      );
      tab.location.replace(result.url);
      void applications.refetch();
    } catch (error) {
      tab.close();
      toast.error(error instanceof Error ? error.message : "The application could not be opened.");
    } finally {
      setLaunching(undefined);
    }
  }

  const firstName = me.data?.user.name.split(/\s+/)[0] ?? "there";
  return (
    <div className="mx-auto max-w-4xl">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="portal-caption mb-2">{me.data?.workspace.name ?? "YOUR WORKSPACE"}</p>
          <h1 className="text-[34px] leading-[1.08] font-semibold tracking-[-0.05em] text-balance sm:text-[42px]">
            Welcome back, {firstName}.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--portal-muted)]">
            Open a company app. Your Authometry session signs you in securely.
          </p>
        </div>
        <div className="flex w-fit items-center gap-2 rounded-full border border-[var(--portal-line)] bg-[var(--portal-paper)] py-1.5 pr-3 pl-1.5 text-[11px] font-medium shadow-[0_1px_2px_rgba(20,20,30,.04)]">
          <span className="flex size-6 items-center justify-center rounded-full bg-[#e7f7f1] text-[var(--portal-ready)] dark:bg-[#17352c]">
            <Check aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
          </span>
          Session verified
        </div>
      </header>

      <section className="mt-14 sm:mt-16">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold tracking-[-0.025em]">Your apps</h2>
            <p className="mt-1 text-xs text-[var(--portal-muted)]">
              Access approved for {me.data?.user.email}
            </p>
          </div>
          <p className="text-xs text-[var(--portal-muted)]">
            {applications.data?.data.length ?? 0} assigned
          </p>
        </div>
        {applications.isLoading ? (
          <div className="grid gap-3">
            {[0, 1, 2, 3].map((item) => (
              <div
                className="h-28 animate-pulse rounded-2xl border border-[var(--portal-line)] bg-[var(--portal-paper)]"
                key={item}
              />
            ))}
          </div>
        ) : applications.isError ? (
          <div className="rounded-xl border border-[var(--portal-line)] bg-[var(--portal-paper)]">
            <ErrorState
              description="Your assigned applications could not be loaded. Check your connection, then retry."
              onRetry={() => void applications.refetch()}
              title="Unable to load applications"
            />
          </div>
        ) : applications.data?.data.length ? (
          <div className="grid gap-3">
            {applications.data.data.map((application) => (
              <article
                className="group flex flex-col gap-5 rounded-2xl border border-[var(--portal-line)] bg-[var(--portal-paper)] p-4 shadow-[0_1px_2px_rgba(20,20,30,.03)] transition-[border-color,box-shadow] hover:border-[color:var(--portal-accent)/.35] hover:shadow-[0_12px_32px_rgba(32,30,60,.07)] sm:flex-row sm:items-center sm:p-5"
                key={application.id}
              >
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <ApplicationLogo application={application} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-semibold">{application.name}</h3>
                      <span
                        className={`size-1.5 shrink-0 rounded-full ${application.provisioning_enabled ? "bg-[var(--portal-ready)]" : "bg-[var(--warning)]"}`}
                        title={application.provisioning_enabled ? "Ready" : "Provisioning required"}
                      />
                    </div>
                    <p className="mt-1 line-clamp-2 max-w-lg text-xs leading-5 text-[var(--portal-muted)]">
                      {application.description || "Company-managed access"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 sm:justify-end">
                  <p className="flex min-w-0 items-center gap-1.5 text-[11px] whitespace-nowrap text-[var(--portal-muted)]">
                    <Clock3 aria-hidden="true" className="size-3" />
                    {application.last_launched_at ? (
                      <>
                        Opened <RelativeTime value={application.last_launched_at} />
                      </>
                    ) : (
                      "Not opened yet"
                    )}
                  </p>
                  <Button
                    className="rounded-full px-4"
                    disabled={!application.provisioning_enabled || launching === application.id}
                    onClick={() => void launch(application)}
                    size="compact"
                    variant={application.provisioning_enabled ? "primary" : "secondary"}
                  >
                    {launching === application.id ? (
                      <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
                    ) : application.provisioning_enabled ? (
                      <>
                        Open <ArrowUpRight aria-hidden="true" className="size-3.5" />
                      </>
                    ) : (
                      "Setup pending"
                    )}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--portal-line)] bg-[var(--portal-paper)]">
            <EmptyState
              description="Your workspace administrator has not assigned any portal applications yet."
              icon={AppWindow}
              title="No applications assigned"
            />
          </div>
        )}
      </section>
    </div>
  );
}
