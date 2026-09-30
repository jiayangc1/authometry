import { ArrowRight } from "lucide-react";
import Link from "next/link";
import base from "./landing.module.css";
import { cx } from "./primitives";
import styles from "./standards-summary.module.css";

const flows: Array<[string, string]> = [
  ["Authorization Code + PKCE", "S256 only"],
  ["OpenID Connect", "Discovery, JWKS, ID token, UserInfo"],
  ["Refresh tokens", "Rotated on every use"],
  ["Client Credentials", "Machine-to-machine"],
  ["Device Authorization", "TVs and CLIs"],
  ["Token Exchange + DPoP", "Bounded agent delegation"],
];

/** A short compatibility answer for the landing page; the full matrix lives on /platform. */
export function StandardsSummary() {
  return (
    <div aria-labelledby="standards-summary-title" className={styles.summary} role="region">
      <div className={styles.head}>
        <h3 className={base.h3} id="standards-summary-title">
          Works with any compliant OAuth 2.0 or OIDC library.
        </h3>
        <p className={styles.note}>
          Conformance-oriented tests ship with the code. Authometry is not OpenID Certified;
          certification is a separate submission to the OpenID Foundation.
        </p>
      </div>
      <ul className={styles.flows}>
        {flows.map(([name, detail]) => (
          <li key={name}>
            <strong>{name}</strong>
            <span>{detail}</span>
          </li>
        ))}
      </ul>
      <Link className={cx(base.textLink, styles.link)} href="/platform#standards">
        See the full standards matrix
        <ArrowRight aria-hidden="true" />
      </Link>
    </div>
  );
}
