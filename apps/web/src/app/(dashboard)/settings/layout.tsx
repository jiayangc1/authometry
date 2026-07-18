"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@authometry/ui";
import { PageContainer, PageHeader } from "@/components/layout/page";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const items = [
    ["My account", "/settings/account"],
    ["General", "/settings/general"],
    ["Members", "/settings/members"],
    ["Domains", "/settings/domains"],
    ["Signing keys", "/settings/signing-keys"],
    ["API tokens", "/settings/tokens"],
    ["Webhooks", "/settings/webhooks"],
    ["Audit", "/settings/audit"],
    ["Danger zone", "/settings/danger"],
  ];
  return (
    <PageContainer>
      <PageHeader
        description="Configure your Authometry workspace and environments."
        title="Settings"
      />
      <div className="grid gap-8 lg:grid-cols-[180px_minmax(0,1fr)]">
        <nav className="flex gap-1 overflow-x-auto lg:flex-col" aria-label="Settings">
          {items.map(([label, href]) => (
            <Link
              className={cn(
                "shrink-0 rounded-md px-2.5 py-1.5 text-[13px] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]",
                pathname === href &&
                  "bg-[var(--surface-hover)] font-medium text-[var(--text-primary)]",
              )}
              href={href!}
              key={href}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </PageContainer>
  );
}
