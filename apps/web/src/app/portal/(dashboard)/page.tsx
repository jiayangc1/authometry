"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, AppWindow, Clock3 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState, Spinner, StatusBadge, cn } from "@authometry/ui";
import { SearchInput } from "@/components/data-display/search-input";
import type { PortalMe } from "@/components/portal/types";
import { RelativeTime } from "@/components/data-display/formatted-time";
import { ErrorState, Skeleton } from "@/components/data-display/states";
import { createPortalLaunchHandoff } from "@/components/portal/launch-handoff";
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
    <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-card)] bg-gradient-to-br from-[var(--geist-gray-1000)] to-[var(--geist-gray-800)] text-sm font-semibold text-[var(--background)] ring-1 ring-[var(--border)] transition-transform duration-[var(--motion-normal)] ease-[var(--ease-spring)] group-hover:scale-105">
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
  const [filter, setFilter] = useState("");
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
    const handoff = createPortalLaunchHandoff(tab, application, {
      dark: document.documentElement.classList.contains("dark"),
      userEmail: me.data?.user.email,
      workspaceName: me.data?.workspace.name,
    });
    setLaunching(application.id);
    try {
      const result = await portalApiFetch<{ url: string }>(
        `/applications/${application.id}/launch`,
        {
          method: "POST",
        },
      );
      handoff.showRedirecting();
      tab.location.replace(result.url);
      void applications.refetch();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "The application could not be opened. Try again.";
      handoff.showError(message);
      toast.error(message);
    } finally {
      setLaunching(undefined);
    }
  }

  const firstName = me.data?.user.name.split(/\s+/)[0] ?? "there";
  const list = applications.data?.data ?? [];
  const needle = filter.trim().toLowerCase();
  const visible = list.filter(
    (application) =>
      !needle ||
      application.name.toLowerCase().includes(needle) ||
      (application.description ?? "").toLowerCase().includes(needle),
  );
  return (
    <div>
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl leading-8 font-semibold tracking-[-0.03em] text-balance sm:text-[32px] sm:leading-10">
            Welcome back, {firstName}
          </h1>
          <p className="mt-1 text-sm text-[var(--portal-muted)]">
            Open a company app — your Authometry session signs you in.
          </p>
        </div>
        {list.length > 6 && (
          <SearchInput
            className="sm:w-64"
            onChange={(event) => setFilter(event.target.value)}
            onClear={() => setFilter("")}
            placeholder="Find an app…"
            value={filter}
          />
        )}
      </header>

      <section aria-label="Your apps">
        {applications.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((item) => (
              <div
                className="flex h-[132px] flex-col justify-between rounded-[var(--radius-card)] border border-[var(--portal-line)] bg-[var(--portal-paper)] p-4"
                key={item}
              >
                <div className="flex gap-3">
                  <Skeleton className="size-11" />
                  <div className="flex-1 space-y-2 pt-1">
                    <Skeleton className="h-3.5 w-1/2" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                </div>
                <Skeleton className="h-7 w-20 self-end" />
              </div>
            ))}
          </div>
        ) : applications.isError ? (
          <ErrorState
            description="Your assigned applications could not be loaded. Check your connection, then retry."
            headingLevel="h2"
            onRetry={() => void applications.refetch()}
            title="Unable to load applications"
          />
        ) : visible.length ? (
          <ul className="stagger grid gap-3 sm:grid-cols-2">
            {visible.map((application) => {
              const ready = application.provisioning_enabled;
              return (
                <li key={application.id}>
                  <button
                    className={cn(
                      "group flex h-full w-full flex-col gap-4 rounded-[var(--radius-card)] border border-[var(--portal-line)] bg-[var(--portal-paper)] p-4 text-left focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:outline-none",
                      ready ? "lift cursor-pointer" : "cursor-not-allowed opacity-70",
                    )}
                    disabled={!ready || launching === application.id}
                    onClick={() => void launch(application)}
                    title={
                      ready ? `Open ${application.name}` : "Your administrator is finishing setup"
                    }
                    type="button"
                  >
                    <span className="flex w-full min-w-0 items-start gap-3">
                      <ApplicationLogo application={application} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          {application.name}
                        </span>
                        <span className="mt-0.5 line-clamp-2 text-[13px] leading-5 text-[var(--portal-muted)]">
                          {application.description || "Company-managed access"}
                        </span>
                      </span>
                      {launching === application.id ? (
                        <Spinner className="size-4 text-[var(--text-tertiary)]" />
                      ) : ready ? (
                        <ArrowUpRight
                          aria-hidden="true"
                          className="size-4 shrink-0 text-[var(--text-tertiary)] transition-[transform,color] duration-[var(--motion-normal)] ease-[var(--ease-spring)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[var(--text-primary)]"
                        />
                      ) : null}
                    </span>
                    <span className="mt-auto flex w-full items-center justify-between gap-3 text-xs text-[var(--portal-muted)]">
                      <span className="flex items-center gap-1.5">
                        <Clock3 aria-hidden="true" className="size-3" />
                        {application.last_launched_at ? (
                          <>
                            Opened <RelativeTime value={application.last_launched_at} />
                          </>
                        ) : (
                          "Not opened yet"
                        )}
                      </span>
                      {!ready && <StatusBadge label="Setup pending" tone="warning" />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            description={
              list.length
                ? "No apps match your search."
                : "Your workspace administrator hasn’t assigned any apps to you yet."
            }
            icon={AppWindow}
            title={list.length ? "No matching apps" : "No apps assigned"}
          />
        )}
      </section>
    </div>
  );
}
