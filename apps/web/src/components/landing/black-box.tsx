import { ArrowRight, Check, CircleDashed, CircleX } from "lucide-react";
import type { CSSProperties } from "react";
import styles from "./black-box.module.css";
import { scenario } from "./demo-data";
import base from "./landing.module.css";
import { ChapterMark, Container, DemoQuestion, cx } from "./primitives";

const STAGES = 7;

const symptoms = [
  "A login succeeds.",
  "A token fails.",
  "A scope disappears.",
  "A request is denied.",
];

/** Every layer is shown at once: the answer should not wait on scrolling. */
export function BlackBox() {
  return (
    <section
      aria-labelledby="black-box-title"
      className={cx(base.chapterStart, base.tone, styles.section)}
      id="denials"
    >
      <div className={styles.sticky}>
        <Container className={styles.grid}>
          <div className={styles.copy}>
            <ChapterMark number={2} />
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

          <div className={styles.demo}>
            <DemoQuestion
              answer={<>media:write isn’t assigned to {scenario.application.name}.</>}
              question="Why did the app get invalid_scope?"
            />
            <div
              aria-label="An invalid_scope error, expanded into its recorded explanation"
              className={styles.stack}
              role="group"
            >
              <div aria-hidden="true" className={styles.gauge}>
                {Array.from({ length: STAGES }, (_, index) => (
                  <i data-on="true" key={index} />
                ))}
              </div>

              <div className={styles.error} data-open="true">
                <p className={styles.errorLine}>
                  <span>HTTP/1.1</span> 302 Found
                </p>
                <p className={styles.errorLocation}>
                  Location: {scenario.application.redirectUri}?<b>error=invalid_scope</b>
                  &amp;state=…
                </p>
                <p className={styles.errorCode}>invalid_scope</p>
                <p className={styles.errorNote}>
                  Trace <code>{scenario.scopeRequestId}</code>
                </p>
              </div>

              <ol className={styles.layers}>
                <Layer index={1} label="Request">
                  <p className={styles.mono}>GET /oauth/authorize</p>
                  <p className={styles.kv}>
                    <span>scope</span>
                    <code>
                      openid profile <mark>media:write</mark>
                    </code>
                  </p>
                </Layer>
                <Layer index={2} label="Application" status="passed">
                  <p>
                    Client verified <span className={styles.dim}>itsagram-web</span>
                  </p>
                  <p>
                    Redirect URI matched <span className={styles.dim}>exact</span>
                  </p>
                </Layer>
                <Layer index={3} label="Scopes" status="failed">
                  <p>
                    Scope denied <code className={styles.bad}>media:write</code>
                  </p>
                  <p className={styles.dim}>The client requested scopes it is not assigned.</p>
                </Layer>
                <Layer index={4} label="Not run" status="skipped">
                  <p className={styles.skipped}>
                    <span>User authenticated</span>
                    <span>Consent evaluated</span>
                    <span>Authorization code issued</span>
                  </p>
                </Layer>
                <Layer index={5} label="Decision" status="failed">
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
                <Layer index={6} label="How to fix it" status="fix">
                  <p>
                    Assign the scope to the application or remove it from the authorization request.
                  </p>
                  <p className={styles.action}>
                    Manage application scopes <ArrowRight aria-hidden="true" />
                  </p>
                </Layer>
              </ol>
            </div>
          </div>
        </Container>
      </div>
    </section>
  );
}

function Layer({
  index,
  label,
  status,
  children,
}: {
  index: number;
  label: string;
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
    <li className={styles.layer} data-status={status} style={{ "--i": index } as CSSProperties}>
      <p className={styles.layerLabel}>
        {Icon && <Icon aria-hidden="true" />}
        {label}
      </p>
      <div className={styles.layerBody}>{children}</div>
    </li>
  );
}
