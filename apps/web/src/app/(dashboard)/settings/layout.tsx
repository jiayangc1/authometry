"use client";

import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@authometry/ui";
import { PageContainer, PageHeader } from "@/components/layout/page";

const groups = [
  {
    label: "Account",
    items: [["My account", "/settings/account"]],
  },
  {
    label: "Workspace",
    items: [
      ["General", "/settings/general"],
      ["Members", "/settings/members"],
      ["Domains", "/settings/domains"],
      ["API tokens", "/settings/tokens"],
    ],
  },
  {
    label: "Security",
    items: [
      ["Signing keys", "/settings/signing-keys"],
      ["Audit log", "/settings/audit"],
    ],
  },
  {
    label: "Integrations",
    items: [
      ["Provisioning", "/settings/provisioning"],
      ["Webhooks", "/settings/webhooks"],
    ],
  },
  {
    label: "",
    items: [["Danger zone", "/settings/danger"]],
  },
] as const;

const spring = { type: "spring", stiffness: 600, damping: 45, mass: 0.7 } as const;

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  return (
    <PageContainer>
      <PageHeader
        description="Your account, this workspace, and its integrations."
        title="Settings"
      />
      <div className="grid gap-8 lg:grid-cols-[200px_minmax(0,1fr)]">
        <LayoutGroup id="settings-nav">
          <nav
            aria-label="Settings"
            className="-mx-1 flex scrollbar-thin gap-1 overflow-x-auto px-1 pb-1 lg:sticky lg:top-6 lg:mx-0 lg:flex-col lg:gap-4 lg:self-start lg:overflow-visible lg:px-0"
          >
            {groups.map((group, index) => (
              <div className="flex shrink-0 gap-1 lg:flex-col lg:gap-px" key={group.label || index}>
                {group.label && (
                  <p className="hidden px-2.5 pb-1 text-xs text-[var(--text-tertiary)] lg:block">
                    {group.label}
                  </p>
                )}
                {group.items.map(([label, href]) => {
                  const active = pathname === href;
                  const danger = href === "/settings/danger";
                  return (
                    <Link
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex h-8 shrink-0 items-center rounded-[var(--radius-control)] px-2.5 text-[13px] transition-colors duration-[var(--motion-fast)] focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:outline-none",
                        active
                          ? "font-medium text-[var(--text-primary)]"
                          : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]",
                        danger && !active && "hover:text-[var(--danger)]",
                        danger && active && "text-[var(--danger)]",
                      )}
                      href={href}
                      key={href}
                    >
                      {active && (
                        <motion.span
                          className="absolute inset-0 rounded-[inherit] bg-[var(--surface-active)]"
                          layoutId="settings-active"
                          transition={reduced ? { duration: 0 } : spring}
                        />
                      )}
                      <span className="relative">{label}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </LayoutGroup>
        <div
          className="min-w-0 animate-[fade-in_var(--motion-normal)_var(--ease-out)] space-y-6"
          key={pathname}
        >
          {children}
        </div>
      </div>
    </PageContainer>
  );
}
