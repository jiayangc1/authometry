import base from "./landing.module.css";
import { ChapterMark, Container, cx } from "./primitives";
import { TraceWindow } from "./trace-window";
import styles from "./traces.module.css";

const properties = [
  ["Ordered", "Every check is recorded in the order it ran, with its offset and duration."],
  ["Explained", "A denial carries what was observed, what was expected, and how to fix it."],
  [
    "Redacted",
    "Codes, tokens, secrets, cookies, and assertions are replaced before anything is stored.",
  ],
] as const;

export function Traces() {
  return (
    <section
      aria-labelledby="traces-title"
      className={cx(base.chapterStart, styles.section)}
      id="traces"
    >
      <Container>
        <div className={styles.head}>
          <div>
            <ChapterMark number={1} />
            <h2 className={cx(base.h2, styles.title)} id="traces-title">
              Every decision leaves a trace.
            </h2>
          </div>
          <div className={styles.copy}>
            <p className={base.lead}>
              When a sign-in misbehaves, you shouldn’t have to guess. Authometry records every
              authorization and token request as it runs — each check, what it saw, how long it
              took, and the decision it reached.
            </p>
            <dl className={styles.properties}>
              {properties.map(([term, detail]) => (
                <div key={term}>
                  <dt>{term}</dt>
                  <dd>{detail}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
        <TraceWindow />
      </Container>
    </section>
  );
}
