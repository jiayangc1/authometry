import { ArrowRight } from "lucide-react";
import Link from "next/link";
import styles from "./go-deeper.module.css";
import base from "./landing.module.css";
import { Container, SectionLabel, cx } from "./primitives";

const topics: Array<{ title: string; detail: string; href: string }> = [
  {
    title: "Protocol flow",
    detail: "Every hop of Authorization Code with PKCE and what is checked at each.",
    href: "/platform#flow",
  },
  {
    title: "Configuration as code",
    detail: "Applications, scopes, and policies as YAML. Validate, plan, apply.",
    href: "/platform#configuration",
  },
  {
    title: "Agents and MCP",
    detail: "Registered agent identities with reduced, sender-constrained grants.",
    href: "/platform#agents",
  },
  {
    title: "Events and webhooks",
    detail: "Traces and audit events through the API, MCP, or signed webhooks.",
    href: "/platform#events",
  },
  {
    title: "Security model",
    detail: "Token rotation, key handling, redaction, and rate limits, stated precisely.",
    href: "/platform#security",
  },
  {
    title: "Self-hosting",
    detail: "AGPL-3.0, your PostgreSQL, and only the web origin on the internet.",
    href: "/platform#open-source",
  },
];

/** One compact index in place of the reference chapters that now live on /platform. */
export function GoDeeper() {
  return (
    <section aria-labelledby="deeper-title" className={styles.section} id="deeper">
      <Container>
        <div className={styles.head}>
          <SectionLabel>platform.reference</SectionLabel>
          <h2 className={cx(base.h3, styles.title)} id="deeper-title">
            Want the detail behind the trace?
          </h2>
        </div>
        <ul className={styles.grid}>
          {topics.map((topic) => (
            <li key={topic.href}>
              <Link href={topic.href}>
                <strong>
                  {topic.title}
                  <ArrowRight aria-hidden="true" />
                </strong>
                <span>{topic.detail}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
