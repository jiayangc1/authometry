import type { ReactNode } from "react";
import { Card, CardFooter } from "@/components/ui/card";

/**
 * Vercel-style settings card: title + description + controls, with an optional footer
 * that carries a hint on the left and the primary action on the right.
 */
export function SettingsSection({
  title,
  description,
  children,
  footer,
  footerHint,
  tone = "neutral",
}: {
  title: string;
  description: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  footerHint?: ReactNode;
  tone?: "neutral" | "danger";
}) {
  return (
    <Card
      className={tone === "danger" ? "border-[var(--danger-border)]" : undefined}
      role="region"
      aria-label={title}
    >
      <div className="p-4 sm:p-5">
        <h2 className="text-base leading-6 font-semibold tracking-[-0.01em] text-balance">
          {title}
        </h2>
        <p className="mt-1 max-w-2xl text-[13px] leading-5 text-pretty text-[var(--text-secondary)]">
          {description}
        </p>
        {children && <div className="mt-4 space-y-4">{children}</div>}
      </div>
      {(footer || footerHint) && (
        <CardFooter hint={footerHint} tone={tone}>
          {footer}
        </CardFooter>
      )}
    </Card>
  );
}
