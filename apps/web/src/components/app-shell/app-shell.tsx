"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Check,
  ChevronsUpDown,
  LogOut,
  Menu,
  MessageSquareText,
  Monitor,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  X,
} from "lucide-react";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AuthometryMark, Button, Kbd, StatusDot, cn } from "@authometry/ui";
import { navigation, utilityNavigation } from "@/config/navigation";
import { apiFetch, onSessionExpired, renewDashboardSession } from "@/lib/api";
import { useHydrated } from "@/lib/use-hydrated";
import { SkipLink } from "@/components/layout/skip-link";
import {
  menuContentClass,
  menuItemClass,
  menuLabelClass,
  menuSeparatorClass,
} from "@/components/ui/menu";
import { SegmentedControl } from "@/components/ui/tabs";
import { CommandMenu } from "./command-menu";

interface MeResponse {
  user: { id: string; name: string; email: string };
  workspaces: Array<{ id: string; name: string; slug: string; role: string }>;
  activeWorkspaceId: string;
}

interface EnvironmentResponse {
  data: Array<{
    id: string;
    slug: string;
    name: string;
    kind: string;
    issuer: string;
    is_default: boolean;
  }>;
}

const sessionRenewalInterval = 8 * 60 * 1000;
const sessionRenewalCheckInterval = 60 * 1000;
const navSpring = { type: "spring", stiffness: 600, damping: 45, mass: 0.7 } as const;

function initials(name?: string) {
  return (
    name
      ?.split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "A"
  );
}

function WorkspaceAvatar({ name, className }: { name?: string | undefined; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-[5px] bg-gradient-to-br from-[var(--geist-gray-1000)] to-[var(--geist-gray-800)] text-[10px] font-semibold text-[var(--background)]",
        className,
      )}
    >
      {(name ?? "W").charAt(0).toUpperCase()}
    </span>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const hydrated = useHydrated();
  const reducedMotion = useReducedMotion();
  const { theme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [isMac, setIsMac] = useState(true);
  const [selectedEnvironmentSlug, setSelectedEnvironmentSlug] = useState<string>();
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<MeResponse>("/api/v1/auth/me"),
  });
  const { data: environments } = useQuery({
    queryKey: ["environments"],
    queryFn: () => apiFetch<EnvironmentResponse>("/api/v1/environments"),
  });
  const selectedEnvironment =
    environments?.data.find(({ slug }) => slug === selectedEnvironmentSlug) ??
    environments?.data.find(({ is_default }) => is_default);
  const activeWorkspace = me?.workspaces.find(({ id }) => id === me.activeWorkspaceId);

  useEffect(() => {
    setIsMac(/mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent));
    const persistedEnvironment = document.cookie
      .split("; ")
      .find((entry) => entry.startsWith("authometry_environment="))
      ?.split("=")
      .slice(1)
      .join("=");
    if (persistedEnvironment) setSelectedEnvironmentSlug(decodeURIComponent(persistedEnvironment));

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target?.matches("input, textarea, select, [contenteditable=true]");
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((value) => !value);
      } else if (event.key === "/" && !typing) {
        event.preventDefault();
        setCommandOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(
    () =>
      onSessionExpired(() => {
        const returnTo = `${window.location.pathname}${window.location.search}`;
        toast.info("Your session ended. Sign in again to continue.", { id: "session-expired" });
        window.location.assign(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      }),
    [],
  );

  useEffect(() => {
    let lastSuccessfulRenewal = Date.now();

    async function renewIfDue() {
      if (
        document.visibilityState === "hidden" ||
        Date.now() - lastSuccessfulRenewal < sessionRenewalInterval
      ) {
        return;
      }
      try {
        if (await renewDashboardSession()) lastSuccessfulRenewal = Date.now();
      } catch {
        // A temporary network failure should not end an otherwise valid session.
      }
    }

    const interval = window.setInterval(() => void renewIfDue(), sessionRenewalCheckInterval);
    const onVisibilityChange = () => void renewIfDue();
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onVisibilityChange);
    };
  }, []);

  async function logout() {
    await apiFetch("/api/v1/auth/logout", { method: "POST" }).catch(() => undefined);
    queryClient.clear();
    router.push("/login");
    router.refresh();
  }

  function selectEnvironment(slug: string) {
    if (slug === selectedEnvironment?.slug) return;
    document.cookie = `authometry_environment=${encodeURIComponent(slug)}; Path=/; Max-Age=31536000; SameSite=Lax`;
    setSelectedEnvironmentSlug(slug);
    void queryClient.invalidateQueries();
    const name = environments?.data.find((environment) => environment.slug === slug)?.name;
    toast.success(`Switched to ${name ?? slug}.`);
  }

  async function selectWorkspace(workspaceId: string) {
    if (workspaceId === me?.activeWorkspaceId) return;
    try {
      await apiFetch("/api/v1/auth/switch-workspace", {
        method: "POST",
        body: JSON.stringify({ workspaceId }),
      });
      document.cookie = "authometry_environment=production; Path=/; Max-Age=31536000; SameSite=Lax";
      queryClient.clear();
      window.location.assign("/overview");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not switch workspaces.");
    }
  }

  const workspaceMenu = (
    <DropdownMenu.Content align="start" className={cn(menuContentClass, "w-64")} sideOffset={6}>
      <p className={menuLabelClass}>Workspaces</p>
      {me?.workspaces.map((workspace) => (
        <DropdownMenu.Item
          className={menuItemClass}
          key={workspace.id}
          onSelect={() => void selectWorkspace(workspace.id)}
        >
          <WorkspaceAvatar name={workspace.name} />
          <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
          <span className="text-[11px] text-[var(--text-tertiary)] capitalize">
            {workspace.role}
          </span>
          {workspace.id === me.activeWorkspaceId && (
            <Check aria-label="Current workspace" className="!text-[var(--text-primary)]" />
          )}
        </DropdownMenu.Item>
      ))}
      <DropdownMenu.Separator className={menuSeparatorClass} />
      <DropdownMenu.Item asChild className={menuItemClass}>
        <Link href="/select-workspace">
          <Plus aria-hidden="true" /> Create or manage workspaces
        </Link>
      </DropdownMenu.Item>
    </DropdownMenu.Content>
  );

  const renderSidebar = (groupId: string) => (
    <div className="flex h-full flex-col">
      <nav
        aria-label="Dashboard navigation"
        className="flex-1 scrollbar-thin overflow-y-auto px-3 pt-3 pb-4"
      >
        <LayoutGroup id={groupId}>
          {navigation.map((group) => (
            <div className="mb-4" key={group.label}>
              <p className="mb-1 px-2 text-xs text-[var(--text-tertiary)]">{group.label}</p>
              <ul className="space-y-px">
                {group.items.map((item) => {
                  const base = item.href.startsWith("/settings") ? "/settings" : item.href;
                  const selected = pathname === base || pathname.startsWith(`${base}/`);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        aria-current={selected ? "page" : undefined}
                        className={cn(
                          "group relative flex h-8 items-center gap-2.5 rounded-[var(--radius-control)] px-2 text-[13px] transition-colors duration-[var(--motion-fast)] focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:outline-none",
                          selected
                            ? "font-medium text-[var(--text-primary)]"
                            : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]",
                        )}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                      >
                        {selected && (
                          <motion.span
                            className="absolute inset-0 rounded-[inherit] bg-[var(--surface-active)]"
                            layoutId="sidebar-active"
                            transition={reducedMotion ? { duration: 0 } : navSpring}
                          />
                        )}
                        <Icon
                          aria-hidden="true"
                          className={cn(
                            "relative size-4 transition-transform duration-[var(--motion-normal)] ease-[var(--ease-spring)] group-hover:scale-110 group-active:scale-95",
                            selected ? "text-[var(--text-primary)]" : "text-[var(--text-tertiary)]",
                          )}
                          strokeWidth={1.75}
                        />
                        <span className="relative">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </LayoutGroup>
      </nav>
      <div className="border-t border-[var(--border)] p-3">
        {utilityNavigation.map((item) => {
          const Icon = item.icon;
          const className =
            "group flex h-8 items-center gap-2.5 rounded-[var(--radius-control)] px-2 text-[13px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:outline-none";
          const content = (
            <>
              <Icon
                aria-hidden="true"
                className="size-4 text-[var(--text-tertiary)] transition-colors group-hover:text-[var(--text-primary)]"
                strokeWidth={1.75}
              />
              {item.label}
            </>
          );
          return item.external ? (
            <a
              className={className}
              href={item.href}
              key={item.href}
              rel="noreferrer"
              target="_blank"
            >
              {content}
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : (
            <Link
              className={className}
              href={item.href}
              key={item.href}
              onClick={() => setMobileOpen(false)}
            >
              {content}
            </Link>
          );
        })}
        <p className="technical-value px-2 pt-2 text-[11px] text-[var(--text-tertiary)]">
          Authometry v0.1.1
        </p>
      </div>
    </div>
  );

  return (
    <div className="h-dvh overflow-hidden bg-[var(--background)]">
      <SkipLink />
      <header className="fixed inset-x-0 top-0 z-[var(--z-header)] flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center border-b border-[var(--border)] bg-[var(--background)]/85 px-[max(.75rem,env(safe-area-inset-left))] pt-[env(safe-area-inset-top)] pr-[max(.75rem,env(safe-area-inset-right))] backdrop-blur-md backdrop-saturate-150 sm:px-4">
        <div className="flex w-full min-w-0 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1">
            <Button
              aria-label="Open navigation"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
              size="icon"
              variant="ghost"
            >
              <Menu aria-hidden="true" className="size-4" />
            </Button>
            <Link
              aria-label="Authometry overview"
              className="pressable mr-1 flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:outline-none"
              href="/overview"
            >
              <AuthometryMark className="size-[22px]" />
            </Link>
            <span
              aria-hidden="true"
              className="hidden text-lg font-light text-[var(--border-strong)] sm:inline"
            >
              /
            </span>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button
                  aria-label={`Workspace: ${activeWorkspace?.name ?? "loading"}`}
                  className="hidden max-w-52 gap-2 px-2 sm:inline-flex"
                  variant="ghost"
                >
                  <WorkspaceAvatar name={activeWorkspace?.name} />
                  <span className="truncate text-[var(--text-primary)]">
                    {activeWorkspace?.name ?? "Workspace"}
                  </span>
                  <ChevronsUpDown
                    aria-hidden="true"
                    className="size-3.5 text-[var(--text-tertiary)]"
                  />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>{workspaceMenu}</DropdownMenu.Portal>
            </DropdownMenu.Root>
            <span
              aria-hidden="true"
              className="hidden text-lg font-light text-[var(--border-strong)] sm:inline"
            >
              /
            </span>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button
                  aria-label={`Environment: ${selectedEnvironment?.name ?? "loading"}`}
                  className="min-w-0 gap-2 px-2"
                  variant="ghost"
                >
                  <StatusDot
                    tone={selectedEnvironment?.kind === "production" ? "success" : "warning"}
                  />
                  <span className="truncate text-[var(--text-primary)]">
                    {selectedEnvironment?.name ?? "Environment"}
                  </span>
                  <ChevronsUpDown
                    aria-hidden="true"
                    className="size-3.5 text-[var(--text-tertiary)]"
                  />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="start"
                  className={cn(menuContentClass, "w-60")}
                  sideOffset={6}
                >
                  <p className={menuLabelClass}>Environments</p>
                  <DropdownMenu.RadioGroup
                    onValueChange={selectEnvironment}
                    value={selectedEnvironment?.slug ?? ""}
                  >
                    {environments?.data.map((environment) => (
                      <DropdownMenu.RadioItem
                        className={menuItemClass}
                        key={environment.id}
                        value={environment.slug}
                      >
                        <StatusDot
                          tone={environment.kind === "production" ? "success" : "warning"}
                        />
                        <span className="min-w-0 flex-1 truncate">{environment.name}</span>
                        <span className="text-[11px] text-[var(--text-tertiary)] capitalize">
                          {environment.kind}
                        </span>
                        <DropdownMenu.ItemIndicator>
                          <Check aria-hidden="true" className="!text-[var(--text-primary)]" />
                        </DropdownMenu.ItemIndicator>
                      </DropdownMenu.RadioItem>
                    ))}
                  </DropdownMenu.RadioGroup>
                  <DropdownMenu.Separator className={menuSeparatorClass} />
                  <DropdownMenu.Item asChild className={menuItemClass}>
                    <Link href="/deployments">
                      <Settings aria-hidden="true" /> Manage deployments
                    </Link>
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              aria-label="Search"
              className="pressable hidden h-8 w-56 items-center gap-2 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface-raised)] pr-1.5 pl-2.5 text-[13px] text-[var(--text-tertiary)] hover:border-[var(--border-strong)] hover:text-[var(--text-secondary)] focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:outline-none md:flex"
              onClick={() => setCommandOpen(true)}
              type="button"
            >
              <Search aria-hidden="true" className="size-3.5" />
              <span className="flex-1 text-left">Search…</span>
              <Kbd>{hydrated && !isMac ? "Ctrl K" : "⌘K"}</Kbd>
            </button>
            <Button
              aria-label="Search"
              className="md:hidden"
              onClick={() => setCommandOpen(true)}
              size="icon"
              variant="ghost"
            >
              <Search aria-hidden="true" className="size-4" />
            </Button>
            <Button asChild className="hidden sm:inline-flex" size="icon" variant="ghost">
              <a
                aria-label="Send feedback"
                href="mailto:auth@cams.ch3n.cc?subject=Authometry%20feedback"
                title="Send feedback"
              >
                <MessageSquareText aria-hidden="true" className="size-4" />
              </a>
            </Button>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  aria-label="Open user menu"
                  className="pressable ml-1 flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-[var(--geist-blue-700)] to-[var(--geist-purple-700)] text-[11px] font-semibold text-white ring-offset-2 ring-offset-[var(--background)] hover:ring-2 hover:ring-[var(--border)] focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:outline-none"
                  type="button"
                >
                  {initials(me?.user.name)}
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  className={cn(menuContentClass, "w-64")}
                  sideOffset={6}
                >
                  <div className="px-2.5 pt-2 pb-2.5">
                    <p className="truncate text-[13px] font-medium">
                      {me?.user.name ?? "Authometry user"}
                    </p>
                    <p className="truncate text-[13px] text-[var(--text-secondary)]">
                      {me?.user.email}
                    </p>
                  </div>
                  <DropdownMenu.Separator className={menuSeparatorClass} />
                  <DropdownMenu.Item asChild className={menuItemClass}>
                    <Link href="/settings/account">
                      <Settings aria-hidden="true" /> Account settings
                    </Link>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item asChild className={menuItemClass}>
                    <Link href="/docs">
                      <BookOpen aria-hidden="true" /> Documentation
                    </Link>
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator className={menuSeparatorClass} />
                  <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
                    <span className="text-[13px]">Theme</span>
                    {hydrated && (
                      <SegmentedControl
                        label="Theme"
                        onChange={setTheme}
                        options={[
                          {
                            value: "system",
                            label: <Monitor aria-label="System" className="size-3.5" />,
                          },
                          {
                            value: "light",
                            label: <Sun aria-label="Light" className="size-3.5" />,
                          },
                          { value: "dark", label: <Moon aria-label="Dark" className="size-3.5" /> },
                        ]}
                        size="compact"
                        value={theme ?? "system"}
                      />
                    )}
                  </div>
                  <DropdownMenu.Separator className={menuSeparatorClass} />
                  <DropdownMenu.Item className={menuItemClass} onSelect={() => void logout()}>
                    <LogOut aria-hidden="true" /> Sign out
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </div>
      </header>
      <aside className="fixed top-[calc(3.5rem+env(safe-area-inset-top))] bottom-0 left-0 hidden w-60 border-r border-[var(--border)] bg-[var(--background)] lg:block">
        {renderSidebar("sidebar-desktop")}
      </aside>
      <Dialog.Root onOpenChange={setMobileOpen} open={mobileOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="motion-overlay fixed inset-0 z-[var(--z-overlay)] bg-[var(--overlay)] lg:hidden" />
          <Dialog.Content
            aria-describedby={undefined}
            className="motion-sheet fixed inset-y-0 left-0 z-[var(--z-overlay)] flex w-[calc(288px+env(safe-area-inset-left))] max-w-[calc(100vw-48px)] flex-col overscroll-contain border-r border-[var(--border)] bg-[var(--background)] pl-[env(safe-area-inset-left)] shadow-[var(--shadow-modal)] focus:outline-none lg:hidden"
          >
            <Dialog.Title className="sr-only">Navigation</Dialog.Title>
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border)] px-3">
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <Button className="min-w-0 gap-2 px-2" variant="ghost">
                    <WorkspaceAvatar name={activeWorkspace?.name} />
                    <span className="truncate text-[var(--text-primary)]">
                      {activeWorkspace?.name ?? "Workspace"}
                    </span>
                    <ChevronsUpDown
                      aria-hidden="true"
                      className="size-3.5 text-[var(--text-tertiary)]"
                    />
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>{workspaceMenu}</DropdownMenu.Portal>
              </DropdownMenu.Root>
              <Dialog.Close asChild>
                <Button aria-label="Close navigation" size="icon" variant="ghost">
                  <X aria-hidden="true" className="size-4" />
                </Button>
              </Dialog.Close>
            </div>
            <div className="min-h-0 flex-1">{renderSidebar("sidebar-mobile")}</div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <main
        className="h-dvh scroll-pt-20 overflow-y-auto pt-[calc(3.5rem+env(safe-area-inset-top))] lg:ml-60"
        id="main-content"
        tabIndex={-1}
      >
        {children}
      </main>
      <CommandMenu onOpenChange={setCommandOpen} open={commandOpen} />
    </div>
  );
}
