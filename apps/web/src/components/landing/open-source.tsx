import { ArrowUpRight } from "lucide-react";
import { GITHUB_URL, githubDoc } from "./demo-data";
import base from "./landing.module.css";
import styles from "./open-source.module.css";
import { Container, MarkTile, SectionLabel, cx } from "./primitives";

const facts: Array<[string, string]> = [
  ["License", "AGPL-3.0-only"],
  ["Runs as", "Web and server images on Node.js 24"],
  ["Data", "Your PostgreSQL database"],
  ["Configuration", "YAML manifests, exportable"],
  ["Protocols", "OAuth 2.0 and OpenID Connect only"],
];

const clients = ["itsagram-web", "api.itsagram.com", "MCP clients", "authometry CLI"];

const services = [
  ["Authorization server", "/oauth/*, discovery, JWKS"],
  ["Policy engine", "conditions per application"],
  ["Trace recorder", "redacted, per request"],
  ["Management API", "/api/v1, personal tokens"],
  ["MCP server", "/mcp, OAuth-scoped tools"],
  ["Workers", "webhooks, retention, key expiry"],
];

export function OpenSource() {
  return (
    <section
      aria-labelledby="open-source-title"
      className={cx(base.night, styles.section)}
      id="open-source"
    >
      <Container>
        <div className={styles.head}>
          <div className={styles.copy}>
            <SectionLabel>source</SectionLabel>
            <h2 className={base.h2} id="open-source-title">
              Your identity layer.
              <span className={base.h2Muted}> Your infrastructure.</span>
            </h2>
            <p className={base.lead}>
              Authometry is open source and self-hosted. The code that evaluates a policy, signs a
              token, or redacts a trace is the code you can read, run, and change.
            </p>
            <div className={styles.actions}>
              <a
                className={cx(base.button, base.primary)}
                href={GITHUB_URL}
                rel="noreferrer"
                target="_blank"
              >
                View source on GitHub
                <ArrowUpRight aria-hidden="true" />
                <span className={base.srOnly}>(opens in a new tab)</span>
              </a>
              <a
                className={cx(base.button, base.secondary)}
                href={githubDoc("docs/deployment.md")}
                rel="noreferrer"
                target="_blank"
              >
                Deployment guide
                <ArrowUpRight aria-hidden="true" />
                <span className={base.srOnly}>(opens in a new tab)</span>
              </a>
            </div>
          </div>
          <dl className={styles.facts}>
            {facts.map(([term, value]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <figure className={styles.diagram} aria-labelledby="architecture-caption">
          <div className={styles.tier}>
            <p className={styles.tierLabel}>Your applications</p>
            <ul className={styles.clients}>
              {clients.map((client) => (
                <li key={client}>{client}</li>
              ))}
            </ul>
          </div>

          <div aria-hidden="true" className={styles.link}>
            <span>OAuth 2.0 / OIDC</span>
            <span>Management API</span>
          </div>

          <div className={styles.boundary}>
            <p className={styles.boundaryLabel}>Your network</p>
            <div className={styles.system}>
              <div className={styles.systemHead}>
                <MarkTile size={24} />
                <strong>Authometry</strong>
              </div>
              <div className={styles.layer}>
                <p>
                  Web origin <code>Next.js :3000</code>
                </p>
                <span>Dashboard, sign-in, consent, and device pages. Rewrites protocol paths.</span>
              </div>
              <div className={styles.layer}>
                <p>
                  Protocol and API server <code>Express :4000, private</code>
                </p>
                <ul className={styles.services}>
                  {services.map(([name, detail]) => (
                    <li key={name}>
                      <strong>{name}</strong>
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div aria-hidden="true" className={styles.down} />
            <div className={styles.stores}>
              <div className={styles.store}>
                <strong>PostgreSQL</strong>
                <span>Source of truth. Secrets stored as hashes or AES-256-GCM.</span>
              </div>
            </div>
          </div>

          <div className={styles.outside}>
            <div className={styles.store}>
              <strong>Webhook endpoints</strong>
              <span>HMAC-signed deliveries</span>
            </div>
            <div className={styles.store}>
              <strong>SMTP</strong>
              <span>Optional, for invites and resets</span>
            </div>
          </div>
          <figcaption className={base.caption} id="architecture-caption">
            Runtime topology from the repository’s architecture guide. Only the web origin faces the
            internet.
          </figcaption>
        </figure>
      </Container>
    </section>
  );
}
