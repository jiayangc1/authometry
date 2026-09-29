"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { GITHUB_URL } from "./demo-data";
import styles from "./final-cta.module.css";
import base from "./landing.module.css";
import { Container, cx } from "./primitives";
import { useInView } from "./use-motion";
import { usePrefersReducedMotion } from "./use-reduced-motion";

const recap = [
  "See every authorization decision",
  "Debug denials from the trace",
  "Keep your OIDC library",
];

type Phase = "idle" | "request" | "policy" | "allow" | "mark";

const sequence: Array<[Phase, number]> = [
  ["request", 150],
  ["policy", 700],
  ["allow", 1250],
  ["mark", 2100],
];

const order: Phase[] = ["idle", "request", "policy", "allow", "mark"];

export function FinalCta() {
  const stage = useRef<HTMLDivElement>(null);
  const inView = useInView(stage, { once: true, amount: 0.6 });
  const reduceMotion = usePrefersReducedMotion();
  const [phase, setPhase] = useState<Phase>("mark");

  useEffect(() => {
    if (reduceMotion) {
      setPhase("mark");
      return;
    }
    if (!inView) {
      setPhase("idle");
      return;
    }
    const timers = sequence.map(([next, delay]) => window.setTimeout(() => setPhase(next), delay));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [inView, reduceMotion]);

  const reached = (target: Phase) => order.indexOf(phase) >= order.indexOf(target);

  return (
    <section aria-labelledby="cta-title" className={styles.section}>
      <Container className={styles.inner}>
        <div aria-hidden="true" className={styles.stage} data-phase={phase} ref={stage}>
          <div className={styles.flow}>
            <span className={styles.node} data-on={reached("request")}>
              Request
            </span>
            <span className={styles.wire} data-on={reached("policy")} />
            <span className={styles.node} data-on={reached("policy")}>
              Policy
            </span>
            <span className={styles.wire} data-on={reached("allow")} />
            <span className={cx(styles.node, styles.allow)} data-on={reached("allow")}>
              Allow
            </span>
          </div>
          <div className={styles.mark}>
            <svg fill="none" viewBox="0 0 32 32">
              <path
                d="M14.25 3.35A12.75 12.75 0 1 0 27.55 18.75"
                pathLength={1}
                strokeLinecap="round"
                strokeWidth="2.35"
              />
              <path
                d="M17.8 3.65a12.75 12.75 0 0 1 9.65 9.2"
                className={styles.accent}
                pathLength={1}
                strokeLinecap="round"
                strokeWidth="2.35"
              />
              <path
                d="M23.45 11.7a8.5 8.5 0 1 0 0 8.6"
                pathLength={1}
                strokeLinecap="round"
                strokeWidth="1.9"
              />
              <path d="M16 16h9.2" pathLength={1} strokeWidth="1.5" />
              <circle cx="16" cy="16" r="2.15" />
              <circle cx="25.2" cy="16" r="1.75" />
            </svg>
          </div>
          <p className={styles.tagline}>Authentication, measured.</p>
        </div>

        <h2 className={cx(base.display, styles.title)} id="cta-title">
          Trace your first request.
        </h2>
        <ul aria-label="What you get" className={styles.recap}>
          {recap.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <div className={styles.actions}>
          <Link className={cx(base.button, base.primary)} href="/docs/getting-started">
            Start building
          </Link>
          <a
            className={cx(base.button, base.secondary)}
            href={GITHUB_URL}
            rel="noreferrer"
            target="_blank"
          >
            View on GitHub
            <ArrowUpRight aria-hidden="true" />
            <span className={base.srOnly}>(opens in a new tab)</span>
          </a>
        </div>
      </Container>
    </section>
  );
}
