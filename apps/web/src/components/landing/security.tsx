import { ArrowUpRight } from "lucide-react";
import { githubDoc } from "./demo-data";
import base from "./landing.module.css";
import { Container, SectionLabel, cx } from "./primitives";
import styles from "./security.module.css";

const groups: Array<{ title: string; items: Array<[string, string]> }> = [
  {
    title: "Protocol",
    items: [
      ["PKCE", "S256 only. Public clients must send a challenge."],
      ["Redirect URIs", "Complete, exact matching. HTTPS unless the host is localhost."],
      [
        "Authorization codes",
        "Single use, 60 s by default, bound to client, redirect URI, user, scopes, and challenge.",
      ],
      [
        "Refresh tokens",
        "Rotate on every use. Reuse revokes the whole family and records a high-severity event.",
      ],
      ["Revocation", "Non-enumerating: unknown tokens still receive success."],
    ],
  },
  {
    title: "Keys and secrets",
    items: [
      [
        "Signing keys",
        "One active RS256 key per environment. Rotated keys stay in JWKS until they retire.",
      ],
      [
        "Stored credentials",
        "Passwords with bcrypt (cost 12). Codes, refresh tokens, and client secrets as HMAC-SHA-256 digests.",
      ],
      ["Encrypted at rest", "Private signing keys and webhook secrets with AES-256-GCM."],
      [
        "Trace redaction",
        "Fields named like tokens, codes, secrets, cookies, passwords, or assertions are replaced before storage.",
      ],
    ],
  },
  {
    title: "Operations",
    items: [
      ["Environments", "Separate issuers, keys, applications, and policies for each."],
      [
        "Configuration",
        "Applied in one transaction under an advisory lock, with deployment provenance.",
      ],
      [
        "Dashboard sessions",
        "HTTP-only cookies, signed double-submit CSRF, 10-minute access tokens.",
      ],
      ["Rate limits", "30 credential attempts per 15 minutes; 120 token requests per minute."],
      ["Webhooks", "HTTPS only. Private and reserved addresses are rejected at delivery time."],
    ],
  },
];

export function Security() {
  return (
    <section aria-labelledby="security-title" className={styles.section} id="security">
      <Container>
        <div className={styles.head}>
          <div>
            <SectionLabel>security</SectionLabel>
            <h2 className={cx(base.h2, styles.title)} id="security-title">
              Secure because the behavior is explicit.
            </h2>
          </div>
          <div className={styles.intro}>
            <p className={base.lead}>
              No badges, no adjectives. These are the controls in the code, stated precisely enough
              to verify.
            </p>
            <a
              className={base.textLink}
              href={githubDoc("docs/security.md")}
              rel="noreferrer"
              target="_blank"
            >
              Read the security model
              <ArrowUpRight aria-hidden="true" />
              <span className={base.srOnly}>(opens in a new tab)</span>
            </a>
          </div>
        </div>
        <div className={styles.sheet}>
          {groups.map((group) => (
            <div className={styles.group} key={group.title}>
              <h3>{group.title}</h3>
              <dl>
                {group.items.map(([term, detail]) => (
                  <div key={term}>
                    <dt>{term}</dt>
                    <dd>{detail}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
