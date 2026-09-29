"use client";

import { ArrowRight, Check, CircleDashed, CircleX } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import styles from "./black-box.module.css";
import { scenario } from "./demo-data";
import base from "./landing.module.css";
import { Container, SectionLabel, cx } from "./primitives";
import { useScrollProgress } from "./use-motion";
import { usePrefersReducedMotion } from "./use-reduced-motion";

const STAGES = 7;

const symptoms = [
  "A login succeeds.",
  "A token fails.",
  "A scope disappears.",
  "A request is denied.",
];

/** Stages advance slightly ahead of the scroll so the last one has room to be read. */
const stageAt = (progress: number) =>
  Math.min(STAGES - 1, Math.max(0, Math.floor(progress * STAGES * 1.08 - 0.25)));

export function BlackBox() {
  const section = useRef<HTMLElement>(null);
  const reduceMotion = usePrefersReducedMotion();
  const [mode, setMode] = useState<"static" | "scroll">("static");
  const [stage, setStage] = useState(STAGES - 1);
  const progress = useRef(0);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 960px) and (min-height: 700px)");
    const update = () => {
      const scroll = query.matches && !reduceMotion;
      setMode(scroll ? "scroll" : "static");
      setStage(scroll ? stageAt(progress.current) : STAGES - 1);
    };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [reduceMotion]);

  const onProgress = useCallback(
    (value: number) => {
      progress.current = value;
      if (mode === "scroll") setStage(stageAt(value));
    },
    [mode],
  );
  useScrollProgress(section, onProgress);

  const shown = (index: number) => stage >= index;

  return (
    <section
      aria-labelledby="black-box-title"
      className={styles.section}
      data-mode={mode}
      ref={section}
    >
      <div className={styles.sticky}>
        <Container className={styles.grid}>
          <div className={styles.copy}>
            <SectionLabel>explanations</SectionLabel>
            <h2 className={cx(base.h2, styles.title)} id="black-box-title">
              Debug a denial in one read.
            </h2>
            <ul className={styles.symptoms}>
              {symptoms.map((symptom) => (
                <li key={symptom}>{symptom}</li>
              ))}
            </ul>
            <p className={base.lead}>
              The client only gets a terse error code. The trace shows which check failed, what it
              expected, and what to change.
            </p>
          </div>

          <div
            aria-label="An invalid_scope error, expanded into its recorded explanation"
            className={styles.stack}
            role="group"
            style={{ "--stage": stage } as CSSProperties}
          >
            <div aria-hidden="true" className={styles.gauge}>
              {Array.from({ length: STAGES }, (_, index) => (
                <i data-on={shown(index)} key={index} />
              ))}
            </div>

            <div className={styles.error} data-open={stage > 0}>
              <p className={styles.errorLine}>
                <span>HTTP/1.1</span> 302 Found
              </p>
              <p className={styles.errorLocation}>
                Location: {scenario.application.redirectUri}?<b>error=invalid_scope</b>&amp;state=…
              </p>
              <p className={styles.errorCode}>invalid_scope</p>
              <p className={styles.errorNote}>
                {stage > 0 ? (
                  <>
                    Trace <code>{scenario.scopeRequestId}</code>
                  </>
                ) : (
                  "All the client sees."
                )}
              </p>
            </div>

            <ol className={styles.layers}>
              <Layer index={1} label="Request" shown={shown(1)}>
                <p className={styles.mono}>GET /oauth/authorize</p>
                <p className={styles.kv}>
                  <span>scope</span>
                  <code>
                    openid profile <mark>media:write</mark>
                  </code>
                </p>
              </Layer>
              <Layer index={2} label="Application" shown={shown(2)} status="passed">
                <p>
                  Client verified <span className={styles.dim}>itsagram-web</span>
                </p>
                <p>
                  Redirect URI matched <span className={styles.dim}>exact</span>
                </p>
              </Layer>
              <Layer index={3} label="Scopes" shown={shown(3)} status="failed">
                <p>
                  Scope denied <code className={styles.bad}>media:write</code>
                </p>
                <p className={styles.dim}>The client requested scopes it is not assigned.</p>
              </Layer>
              <Layer index={4} label="Not run" shown={shown(4)} status="skipped">
                <p className={styles.skipped}>
                  <span>User authenticated</span>
                  <span>Consent evaluated</span>
                  <span>Authorization code issued</span>
                </p>
              </Layer>
              <Layer index={5} label="Decision" shown={shown(5)} status="failed">
                <p className={styles.explainTitle}>A requested scope is not assigned</p>
                <p>media:write is not assigned to {scenario.application.name}.</p>
                <div className={styles.compare}>
                  <div>
                    <span>Observed</span>
                    <code>media:write</code>
                  </div>
                  <div>
                    <span>Expected</span>
                    <code>openid profile media:read</code>
                  </div>
                </div>
              </Layer>
              <Layer index={6} label="How to fix it" shown={shown(6)} status="fix">
                <p>
                  Assign the scope to the application or remove it from the authorization request.
                </p>
                <p className={styles.action}>
                  Manage application scopes <ArrowRight aria-hidden="true" />
                </p>
              </Layer>
            </ol>
          </div>
        </Container>
      </div>
    </section>
  );
}

function Layer({
  index,
  label,
  shown,
  status,
  children,
}: {
  index: number;
  label: string;
  shown: boolean;
  status?: "passed" | "failed" | "skipped" | "fix";
  children: React.ReactNode;
}) {
  const Icon =
    status === "passed"
      ? Check
      : status === "failed"
        ? CircleX
        : status === "skipped"
          ? CircleDashed
          : null;
  return (
    <li
      className={styles.layer}
      data-shown={shown}
      data-status={status}
      style={{ "--i": index } as CSSProperties}
    >
      <p className={styles.layerLabel}>
        {Icon && <Icon aria-hidden="true" />}
        {label}
      </p>
      <div className={styles.layerBody}>{children}</div>
    </li>
  );
}
