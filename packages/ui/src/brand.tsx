import type { SVGProps } from "react";
import { cn } from "./utils";

export function AuthometryMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      className={cn("size-5 shrink-0", className)}
      fill="none"
      viewBox="0 0 32 32"
      {...props}
    >
      <path
        d="M14.25 3.35A12.75 12.75 0 1 0 27.55 18.75"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.35"
      />
      <path
        d="M17.8 3.65a12.75 12.75 0 0 1 9.65 9.2"
        stroke="#635bff"
        strokeLinecap="round"
        strokeWidth="2.35"
      />
      <path
        d="M23.45 11.7a8.5 8.5 0 1 0 0 8.6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.9"
      />
      <path d="M16 16h9.2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="16" cy="16" fill="#635bff" r="2.15" />
      <circle cx="25.2" cy="16" fill="#635bff" r="1.75" />
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
