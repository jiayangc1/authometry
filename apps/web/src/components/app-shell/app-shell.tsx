"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, ChevronDown, Menu, MessageSquareText, Moon, Search, Sun, X } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthometryLogo, Button, cn } from "@authometry/ui";
import { navigation, utilityNavigation } from "@/config/navigation";
import { apiFetch } from "@/lib/api";
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

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { resolvedTheme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
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

  useEffect(() => {
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

  async function logout() {
    await apiFetch("/api/v1/auth/logout", { method: "POST" }).catch(() => undefined);
    router.push("/login");
    router.refresh();
  }

  function selectEnvironment(slug: string) {
    document.cookie = `authometry_environment=${encodeURIComponent(slug)}; Path=/; Max-Age=31536000; SameSite=Lax`;
    setSelectedEnvironmentSlug(slug);
    void queryClient.invalidateQueries();
  }

  async function selectWorkspace(workspaceId: string) {
    await apiFetch("/api/v1/auth/switch-workspace", {
      method: "POST",
      body: JSON.stringify({ workspaceId }),
    });
    document.cookie = "authometry_environment=production; Path=/; Max-Age=31536000; SameSite=Lax";
    queryClient.clear();
    window.location.assign("/overview");
  }

  const sidebar = (
    <div className="flex h-full flex-col bg-[var(--surface)]">
      <nav
        className="flex-1 scrollbar-thin overflow-y-auto px-2 py-4"
        aria-label="Dashboard navigation"
      >
        {navigation.map((group) => (
          <div className="mb-5" key={group.label}>
            <p className="mb-1.5 px-2 text-[11px] font-medium text-[var(--text-tertiary)]">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const selected = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <Link
                    className={cn(
                      "relative flex h-[34px] items-center gap-[9px] rounded-[6px] px-2.5 text-[13px] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:outline-none",
                      selected
                        ? "bg-[var(--accent-soft)] font-medium text-[var(--text-primary)] before:absolute before:top-2 before:bottom-2 before:left-0 before:w-0.5 before:rounded-full before:bg-[var(--accent)]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]",
                    )}
                    href={item.href}
                    key={item.href}
                    onClick={() => setMobileOpen(false)}
                  >
                    <Icon
                      className={cn("size-4", selected && "text-[var(--accent)]")}
                      strokeWidth={1.75}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-[var(--border-subtle)] p-2">
        {utilityNavigation.map((item) => {
          const Icon = item.icon;
          const content = (
            <>
              <Icon className="size-4" strokeWidth={1.75} /> {item.label}
            </>
          );
          const className =
            "flex h-8 items-center gap-2.5 rounded-[6px] px-2.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]";
          return item.external ? (
            <a
              className={className}
              href={item.href}
              key={item.href}
              rel="noreferrer"
              target="_blank"
            >
              {content}
            </a>
          ) : (
            <Link className={className} href={item.href} key={item.href}>
              {content}
            </Link>
          );
        })}
        <p className="px-2.5 pt-2 text-[10px] text-[var(--text-tertiary)]">Authometry v0.1.1</p>
      </div>
    </div>
  );

  return (
    <div className="h-dvh overflow-hidden bg-[var(--background)]">
      <a
        className="fixed top-2 left-2 z-[100] -translate-y-16 rounded bg-[var(--foreground)] px-3 py-2 text-xs text-[var(--background)] focus:translate-y-0"
        href="#main-content"
      >
        Skip to content
      </a>
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center border-b border-[var(--border)] bg-[var(--background)] px-3 sm:px-4">
        <div className="flex w-full min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              aria-label="Open navigation"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
              size="icon"
              variant="ghost"
            >
              <Menu className="size-4" />
            </Button>
            <Link
              className="mr-2 shrink-0 rounded-md focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:outline-none"
              href="/overview"
            >
              <AuthometryLogo />
            </Link>
            <span className="hidden text-[var(--border-strong)] sm:inline">/</span>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button
                  aria-label="Workspace"
                  className="hidden max-w-44 truncate px-2 sm:inline-flex"
                  variant="ghost"
                >
                  <span className="truncate">
                    {me?.workspaces.find(({ id }) => id === me.activeWorkspaceId)?.name ??
                      "Workspace"}
                  </span>
                  <ChevronDown className="size-3" />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="start"
                  className="z-50 min-w-52 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-1 shadow-[0_12px_30px_rgba(0,0,0,0.10)]"
                >
                  {me?.workspaces.map((workspace) => (
                    <DropdownMenu.Item
                      className="cursor-default rounded-md px-2.5 py-2 text-[13px] outline-none hover:bg-[var(--surface-hover)] focus:bg-[var(--surface-hover)]"
                      key={workspace.id}
                      onSelect={() => void selectWorkspace(workspace.id)}
                    >
                      <span className="flex-1">{workspace.name}</span>
                      <span className="ml-5 text-[11px] text-[var(--text-tertiary)] capitalize">
                        {workspace.role}
                      </span>
                    </DropdownMenu.Item>
                  ))}
                  <DropdownMenu.Separator className="my-1 h-px bg-[var(--border)]" />
                  <DropdownMenu.Item asChild>
                    <Link
                      className="block cursor-default rounded-md px-2.5 py-2 text-[13px] outline-none hover:bg-[var(--surface-hover)] focus:bg-[var(--surface-hover)]"
                      href="/select-workspace"
                    >
                      Manage workspaces
                    </Link>
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
            <span className="hidden text-[var(--border-strong)] sm:inline">/</span>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button aria-label="Environment" className="px-2" variant="ghost">
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      selectedEnvironment?.kind === "production"
                        ? "bg-[var(--success)]"
                        : "bg-[var(--warning)]",
                    )}
                  />
                  {selectedEnvironment?.name ?? "Environment"}
                  <ChevronDown className="size-3" />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="start"
                  className="z-50 min-w-48 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-1 shadow-[0_12px_30px_rgba(0,0,0,0.10)]"
                >
                  {environments?.data.map((environment) => (
                    <DropdownMenu.Item
                      className="cursor-default rounded-md px-2.5 py-2 text-[13px] outline-none hover:bg-[var(--surface-hover)] focus:bg-[var(--surface-hover)]"
                      key={environment.id}
                      onSelect={() => selectEnvironment(environment.slug)}
                    >
                      <span className="flex-1">{environment.name}</span>
                      <span className="ml-5 text-[11px] text-[var(--text-tertiary)]">
                        {environment.kind}
                      </span>
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              aria-label="Search"
              className="hidden gap-2 px-2.5 text-[var(--text-secondary)] md:inline-flex"
              onClick={() => setCommandOpen(true)}
              variant="ghost"
            >
              <Search className="size-4" />
              <span className="text-xs">Search</span>
              <kbd className="ml-2 rounded border border-[var(--border)] px-1.5 font-sans text-[10px] text-[var(--text-tertiary)]">
                ⌘ K
              </kbd>
            </Button>
            <Button aria-label="Send feedback" size="icon" variant="ghost">
              <MessageSquareText className="size-4" />
            </Button>
            <Button aria-label="Notifications" size="icon" variant="ghost">
              <Bell className="size-4" />
            </Button>
            <Button
              aria-label="Toggle theme"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              size="icon"
              variant="ghost"
            >
              {resolvedTheme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button
                  aria-label="Open user menu"
                  className="ml-1 rounded-full bg-[var(--surface-subtle)] text-xs"
                  size="icon"
                >
                  {me?.user.name
                    ?.split(" ")
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join("") ?? "A"}
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  className="z-50 w-56 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-1 shadow-[0_12px_30px_rgba(0,0,0,0.10)]"
                >
                  <div className="border-b border-[var(--border-subtle)] px-2.5 py-2">
                    <p className="text-[13px] font-medium">{me?.user.name ?? "Authometry user"}</p>
                    <p className="truncate text-xs text-[var(--text-secondary)]">
                      {me?.user.email}
                    </p>
                  </div>
                  <DropdownMenu.Item
                    className="cursor-default rounded-md px-2.5 py-2 text-[13px] outline-none focus:bg-[var(--surface-hover)]"
                    onSelect={() => void logout()}
                  >
                    Sign out
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </div>
      </header>
      <aside className="fixed top-14 bottom-0 left-0 hidden w-[232px] border-r border-[var(--border)] lg:block">
        {sidebar}
      </aside>
      <Dialog.Root onOpenChange={setMobileOpen} open={mobileOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-50 w-[280px] border-r border-[var(--border)] bg-[var(--surface)] shadow-xl"
          >
            <Dialog.Title className="sr-only">Navigation</Dialog.Title>
            <div className="flex h-14 items-center justify-between border-b border-[var(--border)] px-4">
              <AuthometryLogo />
              <Dialog.Close asChild>
                <Button aria-label="Close navigation" size="icon" variant="ghost">
                  <X className="size-4" />
                </Button>
              </Dialog.Close>
            </div>
            <div className="h-[calc(100%-56px)]">{sidebar}</div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <main
        className="h-[calc(100dvh-56px)] overflow-y-auto pt-14 lg:ml-[232px]"
        id="main-content"
        tabIndex={-1}
      >
        {children}
      </main>
      <CommandMenu onOpenChange={setCommandOpen} open={commandOpen} />
    </div>
  );
}
