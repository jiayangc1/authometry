import { SkipLink } from "@/components/layout/skip-link";
import { Agents } from "./agents";
import { EventStream } from "./event-stream";
import { FlowExplorer } from "./flow-explorer";
import { GitConfig } from "./git-config";
import base from "./landing.module.css";
import { OpenSource } from "./open-source";
import { Philosophy } from "./philosophy";
import styles from "./platform-page.module.css";
import { Container, SectionLabel, cx } from "./primitives";
import { Protocols } from "./protocols";
import { Security } from "./security";
import { SiteFooter } from "./site-footer";
import { SiteNav } from "./site-nav";

export const platformSections = [
  { id: "flow", label: "Protocol flow", detail: "Authorization Code with PKCE, hop by hop" },
  { id: "standards", label: "Standards", detail: "Every supported grant, endpoint, and RFC" },
  { id: "configuration", label: "Configuration", detail: "YAML manifests, plan, and apply" },
  { id: "agents", label: "Agents and MCP", detail: "Delegated, bounded agent identities" },
  { id: "events", label: "Events", detail: "Signed webhooks, API, and MCP access" },
  { id: "security", label: "Security", detail: "The controls, stated precisely" },
  { id: "open-source", label: "Self-hosting", detail: "Runtime topology and deployment" },
  {
    id: "philosophy",
    label: "Error explanations",
    detail: "What the client sees vs. what is recorded",
  },
] as const;

/** The reference chapters that used to extend the landing page, kept whole on their own page. */
export function PlatformPage() {
  return (
    <div className={base.root}>
      <SkipLink />
      <SiteNav />
      <main id="main-content" tabIndex={-1}>
        <header className={styles.intro}>
          <Container>
            <SectionLabel>platform.reference</SectionLabel>
            <h1 className={cx(base.h2, styles.title)}>How Authometry works, in detail.</h1>
            <p className={base.lead}>
              The protocol flow, standards coverage, configuration workflow, agent delegation,
              events, and security controls behind every trace — for when you want to verify the
              claims on the front page.
            </p>
            <nav aria-label="On this page" className={styles.toc}>
              <ol>
                {platformSections.map((section) => (
                  <li key={section.id}>
                    <a href={`#${section.id}`}>
                      <strong>{section.label}</strong>
                      <span>{section.detail}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </Container>
        </header>
        <FlowExplorer />
        <Protocols />
        <GitConfig />
        <Agents />
        <EventStream />
        <Security />
        <OpenSource />
        <Philosophy />
      </main>
      <SiteFooter />
    </div>
  );
}
