import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { AuthFlow } from "./auth-flow";
import { CopyButton } from "./copy-button";
import { GITHUB_URL } from "./demo-data";
import styles from "./hero.module.css";
import base from "./landing.module.css";
import { Container, SectionLabel, cx } from "./primitives";

const installCommand = "npx authometry@latest init";

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
              <div className={styles.install}>
                <code>
                  <span aria-hidden="true">$ </span>
                  {installCommand}
                </code>
                <CopyButton label="Copy install command" value={installCommand} />
              </div>
            </div>
          </div>
        </div>
        <div className={styles.flow}>
          <AuthFlow />
        </div>
      </Container>
    </section>
  );
}
