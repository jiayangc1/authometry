"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppWindow, LogOut, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { AuthometryLogo, Button, cn } from "@authometry/ui";
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
    <div className="portal-surface min-h-dvh text-[var(--portal-ink)]">
      <a
        className="fixed top-2 left-2 z-50 -translate-y-20 rounded-md bg-[var(--portal-ink)] px-3 py-2 text-xs text-white focus:translate-y-0"
        href="#portal-main"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-[var(--portal-line)] bg-[color:var(--portal-paper)/.88] backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-5xl items-center gap-4 px-4 sm:px-6">
          <Link
            className="shrink-0 rounded-md focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:outline-none"
            href="/portal"
          >
            <AuthometryLogo />
          </Link>
          <span className="hidden text-xs text-[var(--portal-muted)] sm:inline">
            {me.data?.workspace.name ?? "Identity portal"}
          </span>
          <nav
            aria-label="Portal navigation"
            className="absolute bottom-0 left-1/2 hidden h-full -translate-x-1/2 items-center gap-1 md:flex"
          >
            {navigation.map((item) => {
              const active =
                item.href === "/portal" ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-full items-center px-3 text-xs font-medium text-[var(--portal-muted)] transition-colors hover:text-[var(--portal-ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:outline-none focus-visible:ring-inset",
                    active &&
                      "text-[var(--portal-ink)] after:absolute after:right-3 after:bottom-0 after:left-3 after:h-0.5 after:rounded-full after:bg-[var(--portal-accent)]",
                  )}
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex min-w-0 items-center gap-2">
            <div className="hidden min-w-0 text-right md:block">
              <p className="truncate text-xs font-medium">{me.data?.user.name}</p>
              <p className="max-w-52 truncate text-[11px] text-[var(--portal-muted)]">
                {me.data?.user.email}
              </p>
            </div>
            <Link
              aria-label="Open profile"
              className="rounded-full focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2 focus-visible:outline-none"
              href="/portal/profile"
            >
              <PortalAvatar
                className="size-9"
                decorative
                initialsClassName="text-[11px]"
                name={me.data?.user.name ?? "User"}
                src={me.data?.user.avatarUrl ?? null}
              />
            </Link>
            <Button aria-label="Sign out" onClick={() => void logout()} size="icon" variant="ghost">
              <LogOut aria-hidden="true" className="size-4" />
            </Button>
          </div>
        </div>
        <nav
          aria-label="Portal navigation"
          className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-3 md:hidden"
        >
          {navigation.map((item) => {
            const active =
              item.href === "/portal" ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-11 shrink-0 items-center gap-2 px-3 text-xs font-medium text-[var(--portal-muted)] transition-colors hover:text-[var(--portal-ink)] focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:outline-none",
                  active &&
                    "text-[var(--portal-ink)] after:absolute after:right-3 after:bottom-0 after:left-3 after:h-0.5 after:bg-[var(--portal-accent)]",
                )}
                href={item.href}
                key={item.href}
              >
                <Icon aria-hidden="true" className="size-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-9 sm:px-6 sm:py-14" id="portal-main">
        {children}
      </main>
      <footer className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 border-t border-[var(--portal-line)] px-4 py-6 text-[11px] text-[var(--portal-muted)] sm:px-6">
        <span>Secured by Authometry</span>
        <span>
          {me.data?.workspace.name} · {me.data?.environment.name}
        </span>
      </footer>
    </div>
  );
}
