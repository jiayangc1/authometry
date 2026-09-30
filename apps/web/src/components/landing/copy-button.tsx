"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import styles from "./copy-button.module.css";
import { cx } from "./primitives";

export function CopyButton({
  value,
  label = "Copy",
  tone = "light",
  className,
}: {
  value: string;
  label?: string;
  tone?: "light" | "dark";
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      aria-label={copied ? "Copied" : label}
      className={cx(styles.button, tone === "dark" && styles.dark, className)}
      data-copied={copied}
      onClick={() => void copy()}
      type="button"
    >
      <Copy aria-hidden="true" className={styles.copy} />
      <Check aria-hidden="true" className={styles.check} />
      <span aria-live="polite" className={styles.status}>
        {copied ? "Copied" : ""}
      </span>
    </button>
  );
}
