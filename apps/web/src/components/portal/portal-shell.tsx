"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppWindow, LogOut, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { AuthometryLogo, Button } from "@authometry/ui";
import { TabNav } from "@/components/ui/tabs";
import { ApiClientError } from "@/lib/api";
import { portalApiFetch } from "@/lib/portal-api";
import type { PortalMe } from "./types";
import { PortalAvatar } from "./portal-avatar";

const navigation = [
  { href: "/portal", label: "My apps", icon: AppWindow, exact: true },
  { href: "/portal/profile", label: "Profile", icon: UserRound },
  { href: "/portal/security", label: "Security", icon: ShieldCheck },
] as const;

export function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const me = useQuery({
    queryKey: ["portal-me"],
    queryFn: () => portalApiFetch<PortalMe>("/me"),
    retry: false,
  });

  useEffect(() => {
    if (me.error instanceof ApiClientError && me.error.status === 401) {
      window.location.assign(
        `/api/v1/portal/auth/clear-session?return_to=${encodeURIComponent(`/portal/login?returnTo=${pathname}`)}`,
      );
    }
  }, [me.error, pathname, router]);

  async function logout() {
    await portalApiFetch("/auth/logout", { method: "POST" }).catch(() => undefined);
    queryClient.removeQueries({ queryKey: ["portal-me"] });
    router.push("/portal/login");
    router.refresh();
  }

  return (
    <div className="portal-surface flex min-h-dvh flex-col text-[var(--portal-ink)]">
      <a
        className="fixed top-2 left-2 z-50 -translate-y-20 rounded-[var(--radius-control)] bg-[var(--portal-ink)] px-3 py-2 text-xs text-[var(--background)] focus:translate-y-0"
        href="#portal-main"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-[var(--portal-line)] bg-[var(--portal-paper)]/85 backdrop-blur-md backdrop-saturate-150">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4 sm:px-6">
          <Link
            className="shrink-0 rounded-[var(--radius-control)] focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:outline-none"
            href="/portal"
          >
            <AuthometryLogo />
          </Link>
          {me.data?.workspace.name && (
            <>
              <span aria-hidden="true" className="text-lg font-light text-[var(--border-strong)]">
                /
              </span>
              <span className="truncate text-[13px] text-[var(--portal-muted)]">
                {me.data.workspace.name}
              </span>
            </>
          )}
          <div className="ml-auto flex min-w-0 items-center gap-1">
            <div className="mr-2 hidden min-w-0 text-right md:block">
              <p className="truncate text-[13px] font-medium">{me.data?.user.name}</p>
              <p className="max-w-52 truncate text-xs text-[var(--portal-muted)]">
                {me.data?.user.email}
              </p>
            </div>
            <Link
              aria-label="Open profile"
              className="pressable rounded-full focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2 focus-visible:outline-none"
              href="/portal/profile"
            >
              <PortalAvatar
                className="size-8"
                decorative
                initialsClassName="text-[11px]"
                name={me.data?.user.name ?? "User"}
                src={me.data?.user.avatarUrl ?? null}
              />
            </Link>
            <Button
              aria-label="Sign out"
              className="[&:hover_svg]:translate-x-0.5"
              onClick={() => void logout()}
              size="icon"
              title="Sign out"
              variant="ghost"
            >
              <LogOut aria-hidden="true" className="size-4" />
            </Button>
          </div>
        </div>
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <TabNav
            className="border-b-0"
            items={navigation.map((item) => {
              const Icon = item.icon;
              return {
                href: item.href,
                active:
                  item.href === "/portal" ? pathname === item.href : pathname.startsWith(item.href),
                label: (
                  <span className="flex items-center gap-1.5">
                    <Icon aria-hidden="true" className="size-3.5" />
                    {item.label}
                  </span>
                ),
              };
            })}
            label="Portal navigation"
          />
        </div>
      </header>
      <main
        className="mx-auto w-full max-w-5xl flex-1 animate-[enter_var(--motion-slow)_var(--ease-out)] px-4 py-8 sm:px-6 sm:py-12"
        id="portal-main"
        key={pathname}
      >
        {children}
      </main>
      <footer className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 border-t border-[var(--portal-line)] px-4 py-6 text-xs text-[var(--portal-muted)] sm:px-6">
        <span>Secured by Authometry</span>
        <span>
          {me.data?.workspace.name} · {me.data?.environment.name}
        </span>
      </footer>
    </div>
  );
}
