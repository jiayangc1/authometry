import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { AuthFlow } from "./auth-flow";
import { GITHUB_URL } from "./demo-data";
import styles from "./hero.module.css";
import base from "./landing.module.css";
import { Container, DemoBadge, SectionLabel, cx } from "./primitives";

/** The one recommended path; the quickstart page walks through each step. */
const quickstart = [
  "Install and authorize the CLI",
  "Provision a client",
  "Point your OIDC library at it",
];

const model = [
  ["In", "an authorization request"],
  ["Checked", "client, identity, policy, consent"],
  ["Out", "a token and its trace"],
] as const;

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className={styles.hero}>
      <Container>
        <div className={styles.top}>
          <SectionLabel>Open-source OAuth 2.0 and OpenID Connect</SectionLabel>
          <div className={styles.headline}>
            <h1 className={cx(base.display, styles.title)} id="hero-title">
              <span>Authentication,</span>
              <span>measured.</span>
            </h1>
            <div className={styles.aside}>
              <p className={base.lead}>
                See every authorization request, policy decision, scope, token, and denial — then
                understand exactly why it happened.
              </p>
              <div className={styles.actions}>
                <Link className={cx(base.button, base.primary)} href="/docs/getting-started">
                  Read the quickstart
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
              <ol aria-label="The quickstart" className={styles.path}>
                {quickstart.map((step, index) => (
                  <li key={step}>
                    <span aria-hidden="true">{index + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
        <div className={styles.flow} id="product">
          <div className={styles.model}>
            <p className={styles.modelLead}>
              Authometry is the authorization server between your app and its users. Each request
              leaves a trace of every check it ran.
            </p>
            <ol aria-label="What happens in one request" className={styles.modelSteps}>
              {model.map(([term, detail]) => (
                <li key={term}>
                  <span>{term}</span>
                  {detail}
                </li>
              ))}
            </ol>
            <DemoBadge className={styles.modelBadge} />
          </div>
          <AuthFlow />
        </div>
      </Container>
    </section>
  );
}
