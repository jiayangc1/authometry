import type { ReactNode } from "react";

export function SettingsSection({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="grid gap-5 border-t border-[var(--border)] py-7 first:border-0 first:pt-0 lg:grid-cols-[240px_1fr]">
      <div>
        <h2 className="text-sm font-semibold text-balance">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{description}</p>
      </div>
      <div>
        <div className="space-y-5">{children}</div>
        {footer && (
          <div className="mt-5 flex justify-end border-t border-[var(--border-subtle)] pt-4">
            {footer}
          </div>
        )}
      </div>
    </section>
  );
}
