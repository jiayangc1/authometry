import type { SVGProps } from "react";
import { cn } from "./utils";

export function AuthometryMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      className={cn("size-5", className)}
      fill="none"
      viewBox="0 0 24 24"
      {...props}
    >
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 3.75a8.25 8.25 0 0 1 0 16.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="3"
      />
      <circle cx="12" cy="12" fill="currentColor" r="2.25" />
    </svg>
  );
}

export function AuthometryLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm font-semibold tracking-[-0.02em]">
      <AuthometryMark />
      {!compact && <span>Authometry</span>}
    </span>
  );
}
