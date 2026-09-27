"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useQuery } from "@tanstack/react-query";
import { Command } from "cmdk";
import {
  AppWindow,
  ArrowRight,
  CornerDownLeft,
  ListTree,
  Moon,
  Plus,
  Search,
  ShieldCheck,
  Sun,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useDeferredValue, useRef, useState } from "react";
import { Kbd, Spinner } from "@authometry/ui";
import { navigation, utilityNavigation } from "@/config/navigation";
import { apiFetch } from "@/lib/api";

const groupClass =
  "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-[var(--text-tertiary)]";
const itemClass =
  "group flex h-10 cursor-default items-center gap-3 rounded-[var(--radius-control)] px-2 text-[13px] text-[var(--text-secondary)] transition-colors duration-[var(--motion-instant)] data-[selected=true]:bg-[var(--surface-hover)] data-[selected=true]:text-[var(--text-primary)]";

function Item({
  icon: Icon,
  label,
  onSelect,
  hint,
  keywords,
}: {
  icon: LucideIcon;
  label: string;
  onSelect: () => void;
  hint?: string;
  keywords?: string[];
}) {
  return (
    <Command.Item className={itemClass} keywords={keywords ?? []} onSelect={onSelect} value={label}>
      <Icon aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.75} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {hint && <span className="text-xs text-[var(--text-tertiary)]">{hint}</span>}
      <ArrowRight
        aria-hidden="true"
        className="size-3.5 -translate-x-1 text-[var(--text-tertiary)] opacity-0 transition-[opacity,transform] duration-[var(--motion-fast)] group-data-[selected=true]:translate-x-0 group-data-[selected=true]:opacity-100"
      />
    </Command.Item>
  );
}

export function CommandMenu({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const results = useQuery({
    queryKey: ["command-search", deferredSearch],
    queryFn: () =>
      apiFetch<{
        data: Array<{ id: string; name: string; slug: string; type: "application" | "trace" }>;
      }>(`/api/v1/search?q=${encodeURIComponent(deferredSearch)}`),
    enabled: open && deferredSearch.length > 1,
    placeholderData: (previous) => previous,
  });

  function change(next: boolean) {
    if (!next) setSearch("");
    onOpenChange(next);
  }

  function go(path: string) {
    change(false);
    router.push(path);
  }

  const actions: Array<{ label: string; href: string; icon: LucideIcon; keywords: string[] }> = [
    {
      label: "Create application",
      href: "/applications/new",
      icon: Plus,
      keywords: ["new", "client", "add"],
    },
    {
      label: "Add user",
      href: "/users/new",
      icon: UserPlus,
      keywords: ["new", "invite", "create"],
    },
    { label: "Create policy", href: "/policies/new", icon: ShieldCheck, keywords: ["new", "rule"] },
    { label: "Create scope", href: "/scopes/new", icon: Plus, keywords: ["new", "permission"] },
  ];
  const searchResults = deferredSearch.length > 1 ? (results.data?.data ?? []) : [];

  return (
    <Dialog.Root onOpenChange={change} open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="motion-overlay fixed inset-0 z-[var(--z-overlay)] bg-[var(--overlay)]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="motion-popover fixed top-[12vh] left-1/2 z-[var(--z-overlay)] w-[calc(100%-24px)] max-w-[640px] -translate-x-1/2 overflow-hidden overscroll-contain rounded-[var(--radius-panel)] bg-[var(--surface-raised)] shadow-[var(--shadow-modal)] [--popover-shift:-8px] focus:outline-none"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus();
          }}
          style={{ transformOrigin: "top center" }}
        >
          <Dialog.Title className="sr-only">Search Authometry</Dialog.Title>
          <Command loop>
            <div className="flex h-14 items-center gap-3 border-b border-[var(--border)] px-4">
              {results.isFetching ? (
                <Spinner className="size-4 text-[var(--text-tertiary)]" />
              ) : (
                <Search aria-hidden="true" className="size-4 text-[var(--text-tertiary)]" />
              )}
              <Command.Input
                aria-label="Search applications, traces, and pages"
                autoComplete="off"
                className="h-full flex-1 bg-transparent text-[15px] outline-none placeholder:text-[var(--text-tertiary)]"
                name="command-search"
                onValueChange={setSearch}
                placeholder="Search applications, traces, pages, or actions…"
                ref={inputRef}
                spellCheck={false}
                value={search}
              />
              <Kbd className="hidden sm:inline-flex">Esc</Kbd>
            </div>
            <Command.List className="max-h-[min(440px,60dvh)] scrollbar-thin overflow-y-auto overscroll-contain p-2 transition-[height] duration-[var(--motion-fast)]">
              <Command.Empty className="px-3 py-12 text-center text-[13px] text-[var(--text-secondary)]">
                {results.isFetching ? "Searching…" : `No results for “${search}”.`}
              </Command.Empty>
              {searchResults.length > 0 && (
                <Command.Group className={groupClass} heading="Results">
                  {searchResults.map((result) => {
                    const href =
                      result.type === "application"
                        ? `/applications/${result.id}`
                        : `/traces/${result.id}`;
                    return (
                      <Command.Item
                        className={itemClass}
                        key={`${result.type}-${result.id}`}
                        onSelect={() => go(href)}
                        value={`${result.type} ${result.name} ${result.slug} ${result.id}`}
                      >
                        {result.type === "application" ? (
                          <AppWindow aria-hidden="true" className="size-4 shrink-0" />
                        ) : (
                          <ListTree aria-hidden="true" className="size-4 shrink-0" />
                        )}
                        <span className="min-w-0 flex-1 truncate text-[var(--text-primary)]">
                          {result.name}
                        </span>
                        <span className="technical-value truncate text-[var(--text-tertiary)]">
                          {result.slug}
                        </span>
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              )}
              <Command.Group className={groupClass} heading="Actions">
                {actions.map((action) => (
                  <Item
                    icon={action.icon}
                    key={action.href}
                    keywords={action.keywords}
                    label={action.label}
                    onSelect={() => go(action.href)}
                  />
                ))}
                <Item
                  icon={resolvedTheme === "dark" ? Sun : Moon}
                  keywords={["theme", "dark", "light", "appearance"]}
                  label={
                    resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"
                  }
                  onSelect={() => {
                    setTheme(resolvedTheme === "dark" ? "light" : "dark");
                    change(false);
                  }}
                />
              </Command.Group>
              {navigation.map((group) => (
                <Command.Group className={groupClass} heading={group.label} key={group.label}>
                  {group.items.map((item) => (
                    <Item
                      icon={item.icon}
                      key={item.href}
                      keywords={[group.label]}
                      label={item.label}
                      onSelect={() => go(item.href)}
                    />
                  ))}
                </Command.Group>
              ))}
              <Command.Group className={groupClass} heading="Help">
                {utilityNavigation
                  .filter((item) => !item.external)
                  .map((item) => (
                    <Item
                      icon={item.icon}
                      key={item.href}
                      label={item.label}
                      onSelect={() => go(item.href)}
                    />
                  ))}
              </Command.Group>
            </Command.List>
            <div className="hidden h-10 items-center gap-4 border-t border-[var(--border)] bg-[var(--surface-subtle)] px-4 text-xs text-[var(--text-tertiary)] sm:flex">
              <span className="flex items-center gap-1.5">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd> to navigate
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd>
                  <CornerDownLeft aria-label="Enter" className="size-3" />
                </Kbd>
                to select
              </span>
            </div>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
