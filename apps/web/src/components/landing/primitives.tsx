import type { ReactNode } from "react";
import { AuthometryMark } from "@authometry/ui";
import styles from "./landing.module.css";

export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function Container({
  children,
  className,
}: {
  children: ReactNode;
  className?: string | undefined;
}) {
  return <div className={cx(styles.container, className)}>{children}</div>;
}

/** Measurement ticks crossed by a single event, followed by a resource-style identifier. */
export function SectionLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <p className={cx(styles.label, className)}>
      <span aria-hidden="true" className={styles.ruler} />
      <span>{children}</span>
    </p>
  );
}

/** Marks a recreated product surface so its names and timings are not mistaken for real data. */
export function DemoBadge({
  children = "Interactive example · demo data",
  className,
}: {
  children?: ReactNode;
  className?: string | undefined;
}) {
  return <p className={cx(styles.demoBadge, className)}>{children}</p>;
}

/** The existing gauge mark, set in an ink tile with the signal accent. */
export function MarkTile({
  size = 28,
  className,
}: {
  size?: number;
  className?: string | undefined;
}) {
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        flex: "none",
        borderRadius: Math.round(size * 0.26),
        background: "var(--ink)",
        color: "var(--paper)",
      }}
    >
      <AuthometryMark
        accent="#ccf24a"
        style={{ width: Math.round(size * 0.72), height: Math.round(size * 0.72) }}
      />
    </span>
  );
}

export { highlightLine, type Language } from "./highlight";
