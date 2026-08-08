"use client";

import { useEffect, useState } from "react";
import { cn } from "@authometry/ui";

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U"
  );
}

export function PortalAvatar({
  name,
  src,
  className,
  initialsClassName,
  decorative = false,
}: {
  name: string;
  src?: string | null;
  className?: string;
  initialsClassName?: string;
  decorative?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--portal-accent-soft)] text-[var(--portal-accent)] ring-1 ring-[color:var(--portal-accent)/.16]",
        className,
      )}
    >
      {src && !failed ? (
        <img
          alt={decorative ? "" : `${name}'s profile picture`}
          className="size-full object-cover"
          onError={() => setFailed(true)}
          src={src}
        />
      ) : (
        <span className={cn("font-semibold tracking-[-0.04em]", initialsClassName)}>
          {initials(name)}
        </span>
      )}
    </span>
  );
}
