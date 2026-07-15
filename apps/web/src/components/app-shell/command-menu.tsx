"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useQuery } from "@tanstack/react-query";
import { Command } from "cmdk";
import {
  AppWindow,
  ArrowRight,
  ListTree,
  Search,
  Settings,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@authometry/ui";
import { apiFetch } from "@/lib/api";

export function CommandMenu({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const { data } = useQuery({
    queryKey: ["command-search", search],
    queryFn: () =>
      apiFetch<{
        data: Array<{ id: string; name: string; slug: string; type: "application" | "trace" }>;
      }>(`/api/v1/search?q=${encodeURIComponent(search)}`),
    enabled: open && search.length > 1,
  });
  const destinations: Array<[string, string, LucideIcon]> = [
    ["Applications", "/applications", AppWindow],
    ["Authorization traces", "/traces", ListTree],
    ["Users", "/users", Users],
    ["Settings", "/settings/general", Settings],
  ];
  function go(path: string) {
    onOpenChange(false);
    router.push(path);
  }
  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-[1px]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-[15vh] left-1/2 z-[60] w-[calc(100%-24px)] max-w-xl -translate-x-1/2 overflow-hidden rounded-[10px] border border-[var(--border-strong)] bg-[var(--surface-raised)] shadow-[0_24px_70px_rgba(0,0,0,0.18)]"
        >
          <Dialog.Title className="sr-only">Search Authometry</Dialog.Title>
          <Command loop shouldFilter>
            <div className="flex h-12 items-center gap-3 border-b border-[var(--border)] px-4">
              <Search className="size-4 text-[var(--text-tertiary)]" />
              <Command.Input
                autoFocus
                className="h-full flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-tertiary)]"
                onValueChange={setSearch}
                placeholder="Search applications, traces, and navigation…"
                value={search}
              />
              <Dialog.Close asChild>
                <Button aria-label="Close search" size="icon" variant="ghost">
                  <X className="size-4" />
                </Button>
              </Dialog.Close>
            </div>
            <Command.List className="max-h-[420px] scrollbar-thin overflow-y-auto p-2">
              <Command.Empty className="px-3 py-10 text-center text-[13px] text-[var(--text-secondary)]">
                No results found.
              </Command.Empty>
              <Command.Group
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-[var(--text-tertiary)]"
                heading="Navigation"
              >
                {destinations.map(([label, href, Icon]) => (
                  <Command.Item
                    className="flex cursor-default items-center gap-3 rounded-md px-2 py-2 text-[13px] aria-selected:bg-[var(--surface-hover)]"
                    key={String(href)}
                    onSelect={() => go(String(href))}
                    value={String(label)}
                  >
                    <Icon className="size-4 text-[var(--text-secondary)]" /> {String(label)}
                    <ArrowRight className="ml-auto size-3 text-[var(--text-tertiary)]" />
                  </Command.Item>
                ))}
              </Command.Group>
              {data?.data.length ? (
                <Command.Group
                  className="mt-2 border-t border-[var(--border-subtle)] pt-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-[var(--text-tertiary)]"
                  heading="Results"
                >
                  {data.data.map((result) => (
                    <Command.Item
                      className="flex cursor-default items-center gap-3 rounded-md px-2 py-2 text-[13px] aria-selected:bg-[var(--surface-hover)]"
                      key={result.id}
                      onSelect={() =>
                        go(
                          result.type === "application"
                            ? `/applications/${result.id}`
                            : `/traces/${result.id}`,
                        )
                      }
                      value={`${result.name} ${result.slug}`}
                    >
                      {result.type === "application" ? (
                        <AppWindow className="size-4" />
                      ) : (
                        <ListTree className="size-4" />
                      )}
                      <span>
                        <span className="block">{result.name}</span>
                        <span className="technical-value block text-[var(--text-tertiary)]">
                          {result.slug}
                        </span>
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
