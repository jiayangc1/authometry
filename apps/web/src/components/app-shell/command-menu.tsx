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
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
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
  const inputRef = useRef<HTMLInputElement>(null);
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
          className="fixed top-[15vh] left-1/2 z-[60] w-[calc(100%-24px)] max-w-xl -translate-x-1/2 overflow-hidden overscroll-contain rounded-[10px] border border-[var(--border-strong)] bg-[var(--surface-raised)] shadow-[0_24px_70px_rgba(0,0,0,0.18)]"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            if (window.matchMedia("(min-width: 768px)").matches) inputRef.current?.focus();
          }}
        >
          <Dialog.Title className="sr-only">Search Authometry</Dialog.Title>
          <Command loop shouldFilter>
            <div className="flex h-12 items-center gap-3 border-b border-[var(--border)] px-4 focus-within:ring-2 focus-within:ring-[var(--focus)] focus-within:ring-inset">
              <Search aria-hidden="true" className="size-4 text-[var(--text-tertiary)]" />
              <Command.Input
                aria-label="Search applications, traces, and navigation"
                autoComplete="off"
                className="h-full flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-tertiary)]"
                name="command-search"
                onValueChange={setSearch}
                placeholder="Search applications, traces, and navigation…"
                ref={inputRef}
                spellCheck={false}
                value={search}
              />
              <Dialog.Close asChild>
                <Button aria-label="Close search" size="icon" variant="ghost">
                  <X aria-hidden="true" className="size-4" />
                </Button>
              </Dialog.Close>
            </div>
            <Command.List className="max-h-[420px] scrollbar-thin overflow-y-auto overscroll-contain p-2">
              <Command.Empty className="px-3 py-10 text-center text-[13px] text-[var(--text-secondary)]">
                No results found.
              </Command.Empty>
              <Command.Group
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-[var(--text-tertiary)]"
                heading="Navigation"
              >
                {destinations.map(([label, href, Icon]) => (
                  <Command.Item
                    className="cursor-default rounded-md text-[13px] aria-selected:bg-[var(--surface-hover)]"
                    key={String(href)}
                    onSelect={() => go(String(href))}
                    value={String(label)}
                  >
                    <Link
                      className="flex w-full items-center gap-3 px-2 py-2"
                      href={String(href)}
                      onMouseDown={(event) => {
                        if (event.button !== 0) event.stopPropagation();
                      }}
                      onClick={(event) => {
                        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
                          event.stopPropagation();
                          onOpenChange(false);
                          return;
                        }
                        event.preventDefault();
                        event.stopPropagation();
                        const path = event.currentTarget.getAttribute("href");
                        if (path) go(path);
                      }}
                    >
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
                      className="cursor-default rounded-md text-[13px] aria-selected:bg-[var(--surface-hover)]"
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
                      <Link
                        className="flex w-full min-w-0 items-center gap-3 px-2 py-2"
                        href={
                          result.type === "application"
                            ? `/applications/${result.id}`
                            : `/traces/${result.id}`
                        }
                        onClick={() => onOpenChange(false)}
                      >
                        {result.type === "application" ? (
                          <AppWindow aria-hidden="true" className="size-4 shrink-0" />
                        ) : (
                          <ListTree aria-hidden="true" className="size-4 shrink-0" />
                        )}
                        <span className="min-w-0">
                          <span className="block truncate">{result.name}</span>
                          <span className="technical-value block truncate text-[var(--text-tertiary)]">
                            {result.slug}
                          </span>
                        </span>
                      </Link>
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
