import { cn } from "./utils";

/** Geist-style 12-bar spinner. Inherits `currentColor`. */
export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={cn("relative inline-block size-4 shrink-0", className)}
      role={label ? "status" : undefined}
    >
      {Array.from({ length: 12 }, (_, index) => (
        <span
          className="absolute top-[37%] left-[46%] h-[8%] w-[24%] rounded-full bg-current"
          key={index}
          style={{
            animation: "spinner-fade 1.2s linear infinite",
            animationDelay: `${-1.2 + index * 0.1}s`,
            transform: `rotate(${index * 30}deg) translate(146%)`,
            transformOrigin: "0 50%",
          }}
        />
      ))}
    </span>
  );
}

/** Three pulsing dots for inline "working" states. */
export function LoadingDots({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn("inline-flex items-center gap-[3px]", className)}>
      {[0, 1, 2].map((index) => (
        <span
          className="size-1 rounded-full bg-current"
          key={index}
          style={{ animation: `loading-dot 1.2s ${index * 0.16}s infinite var(--ease-in-out)` }}
        />
      ))}
    </span>
  );
}
