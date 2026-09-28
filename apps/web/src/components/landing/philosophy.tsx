import { scenario } from "./demo-data";
import base from "./landing.module.css";
import styles from "./philosophy.module.css";
import { Container, SectionLabel, cx } from "./primitives";

const comparisons: Array<{ sees: string; code: string; title: string; detail: string }> = [
  {
    sees: "error=access_denied",
    code: "policy_denied",
    title: `Policy ${scenario.policy.displayName} denied the request.`,
    detail: `user.groups did not contain "bellaire-media". Message: ${scenario.policy.denyMessage}`,
  },
  {
    sees: "400 redirect_uri_mismatch",
    code: "redirect_uri_mismatch",
    title: "The requested redirect URI is not registered for Itsagram Web.",
    detail:
      "Received https://itsagram.com/callback. Registered https://itsagram.com/auth/callback.",
  },
  {
    sees: "error=invalid_request",
    code: "pkce_required",
    title: "This application requires an S256 code challenge.",
    detail: "Generate a code verifier and send its S256 challenge with the authorization request.",
  },
  {
    sees: "400 invalid_grant",
    code: "refresh_token_reuse",
    title: "A rotated refresh token was reused. The token family was revoked.",
    detail: "Recorded as a high-severity security event in the audit log.",
  },
];

const principles = [
  "Standards over lock-in.",
  "Configuration over mystery.",
  "Evidence over assumptions.",
  "Decisions should be explainable.",
  "Infrastructure should be inspectable.",
];

export function Philosophy() {
  return (
    <section aria-labelledby="philosophy-title" className={styles.section} id="philosophy">
      <Container>
        <div className={styles.head}>
          <SectionLabel>philosophy</SectionLabel>
          <h2 className={cx(base.h2, styles.title)} id="philosophy-title">
            An error code is not an explanation.
          </h2>
          <p className={base.lead}>
            OAuth errors are deliberately terse on the wire — clients shouldn’t learn your
            configuration. Operators should. Authometry keeps both views.
          </p>
        </div>

        <div
          aria-label="What the client sees and what Authometry records"
          className={styles.compare}
          role="table"
        >
          <div className={styles.compareHead} role="row">
            <span role="columnheader">What the client sees</span>
            <span role="columnheader">What Authometry records</span>
          </div>
          {comparisons.map((row) => (
            <div className={styles.compareRow} key={row.code} role="row">
              <span className={styles.sees} role="cell">
                <code>{row.sees}</code>
              </span>
              <span className={styles.records} role="cell">
                <code className={styles.code}>{row.code}</code>
                <strong>{row.title}</strong>
                <span>{row.detail}</span>
              </span>
            </div>
          ))}
        </div>

        <ol aria-label="Principles" className={styles.principles}>
          {principles.map((principle, index) => (
            <li key={principle}>
              <span aria-hidden="true" className={styles.number}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className={styles.principle}>{principle}</span>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
