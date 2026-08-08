"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, AppWindow, Clock3, LoaderCircle, ShieldCheck, Sparkles } from "lucide-react";
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

const cardTones = [
  "from-[#635bff] to-[#817bff]",
  "from-[#167c66] to-[#2aa887]",
  "from-[#3559a8] to-[#5478c9]",
  "from-[#8a4d73] to-[#af6c95]",
] as const;

function ApplicationLogo({ application, tone }: { application: PortalApplication; tone: string }) {
  const [failed, setFailed] = useState(false);
  const fallback = application.name.slice(0, 2).toUpperCase();

  return (
    <span
      className={`flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-gradient-to-br ${tone} text-sm font-semibold text-white shadow-sm`}
    >
      {application.logo_uri && !failed ? (
        <img
          alt=""
          className="size-full bg-white object-contain p-1.5"
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
    <div>
      <section className="relative overflow-hidden rounded-[20px] border border-[var(--portal-line)] bg-[var(--portal-paper)]">
        <div className="absolute inset-y-0 left-0 w-1.5 bg-[var(--portal-accent)]" />
        <div className="grid gap-6 px-6 py-6 sm:px-8 sm:py-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="mb-4 flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-[var(--portal-accent-soft)] text-[var(--portal-accent)]">
                <Sparkles aria-hidden="true" className="size-3.5" />
              </span>
              <p className="portal-caption">
                ACCESS PASS / {me.data?.workspace.slug.toUpperCase() ?? "WORKSPACE"}
              </p>
            </div>
            <h1 className="text-[30px] leading-9 font-semibold tracking-[-0.045em] text-balance">
              Good to see you, {firstName}.
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--portal-muted)]">
              These are the services your company has approved for you. Open one and your current
              Authometry session handles sign-in.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-[var(--portal-line)] bg-[var(--portal-canvas)] px-4 py-3">
            <span className="flex size-8 items-center justify-center rounded-full bg-[#e8f7f1] text-[var(--portal-ready)] dark:bg-[#17352c]">
              <ShieldCheck aria-hidden="true" className="size-4" />
            </span>
            <div>
              <p className="text-xs font-semibold">Session verified</p>
              <p className="text-[11px] text-[var(--portal-muted)]">{me.data?.user.email}</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 border-t border-[var(--portal-line)] sm:grid-cols-3">
          <div className="px-6 py-3 sm:px-8">
            <p className="portal-caption">WORKSPACE</p>
            <p className="mt-0.5 truncate text-xs font-medium">{me.data?.workspace.name ?? "—"}</p>
          </div>
          <div className="border-l border-[var(--portal-line)] px-6 py-3">
            <p className="portal-caption">ENVIRONMENT</p>
            <p className="mt-0.5 truncate text-xs font-medium">
              {me.data?.environment.name ?? "—"}
            </p>
          </div>
          <div className="hidden border-l border-[var(--portal-line)] px-6 py-3 sm:block">
            <p className="portal-caption">SECURITY</p>
            <p className="mt-0.5 truncate text-xs font-medium">
              {me.data?.user.mfaEnabled ? "MFA protected" : "Password protected"}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="portal-caption mb-1">LAUNCH RUNWAY</p>
            <h2 className="text-lg font-semibold tracking-[-0.025em]">Your applications</h2>
          </div>
          <p className="text-xs text-[var(--portal-muted)]">
            {applications.data?.data.length ?? 0} assigned
          </p>
        </div>
        {applications.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((item) => (
              <div
                className="h-36 animate-pulse rounded-xl border border-[var(--portal-line)] bg-[var(--portal-paper)]"
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
          <div className="grid gap-3 sm:grid-cols-2">
            {applications.data.data.map((application, index) => (
              <article
                className="group flex min-h-36 flex-col rounded-xl border border-[var(--portal-line)] bg-[var(--portal-paper)] p-4 transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(40,40,70,.08)]"
                key={application.id}
              >
                <div className="flex items-start gap-3">
                  <ApplicationLogo
                    application={application}
                    tone={cardTones[index % cardTones.length] ?? cardTones[0]}
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold">{application.name}</h3>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-[var(--portal-muted)]">
                      {application.description || "Company-managed access"}
                    </p>
                  </div>
                  <span
                    className={`mt-1 size-2 rounded-full ${application.provisioning_enabled ? "bg-[var(--portal-ready)]" : "bg-[var(--warning)]"}`}
                    title={application.provisioning_enabled ? "Ready" : "Provisioning required"}
                  />
                </div>
                <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                  <p className="flex min-w-0 items-center gap-1.5 text-[11px] text-[var(--portal-muted)]">
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
