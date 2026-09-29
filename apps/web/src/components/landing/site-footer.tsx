import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { GITHUB_URL, githubDoc } from "./demo-data";
import base from "./landing.module.css";
import { Container, MarkTile, cx } from "./primitives";
import styles from "./site-footer.module.css";

interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
}

const columns: Array<{ title: string; links: FooterLink[] }> = [
  {
    title: "Product",
    links: [
      { label: "Authorization traces", href: "#traces" },
      { label: "Policy decisions", href: "#decisions" },
      { label: "Protocol flow", href: "/platform#flow" },
      { label: "Configuration as code", href: "/platform#configuration" },
      { label: "Events", href: "/platform#events" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "Documentation", href: "/docs" },
      { label: "Quickstart", href: "/docs/getting-started" },
      { label: "Manifests and CLI", href: "/docs/configuration-as-code" },
      { label: "MCP server", href: "/docs/mcp" },
      { label: "Webhooks", href: "/docs/webhooks" },
      { label: "API reference", href: githubDoc("docs/api.md"), external: true },
    ],
  },
  {
    title: "Project",
    links: [
      { label: "Source", href: GITHUB_URL, external: true },
      { label: "Contributing", href: githubDoc("CONTRIBUTING.md"), external: true },
      { label: "Security model", href: githubDoc("docs/security.md"), external: true },
      { label: "CLI on npm", href: "https://www.npmjs.com/package/authometry", external: true },
      { label: "AGPL-3.0 license", href: githubDoc("LICENSE"), external: true },
    ],
  },
  {
    title: "Access",
    links: [
      { label: "Console sign in", href: "/login" },
      { label: "Employee portal", href: "/portal" },
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className={cx(base.night, styles.footer)}>
      <Container>
        <div className={styles.top}>
          <div className={styles.brand}>
            <Link aria-label="Authometry home" className={styles.brandLink} href="/">
              <MarkTile className={styles.tile} size={30} />
              <span>Authometry</span>
            </Link>
            <p>Open-source OAuth 2.0 and OpenID Connect infrastructure you can inspect.</p>
          </div>
          <nav aria-label="Footer" className={styles.columns}>
            {columns.map((column) => (
              <div key={column.title}>
                <h2>{column.title}</h2>
                <ul>
                  {column.links.map((link) => (
                    <li key={link.label}>
                      {link.external ? (
                        <a href={link.href} rel="noreferrer" target="_blank">
                          {link.label}
                          <ArrowUpRight aria-hidden="true" />
                          <span className={base.srOnly}>(opens in a new tab)</span>
                        </a>
                      ) : link.href.startsWith("#") ? (
                        <a href={link.href}>{link.label}</a>
                      ) : (
                        <Link href={link.href}>{link.label}</Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div aria-hidden="true" className={styles.ruler}>
          <span />
        </div>

        <div className={styles.bottom}>
          <div className={styles.meta}>
            <p className={styles.tagline}>Authentication, measured.</p>
            <p>© 2026 Authometry contributors</p>
          </div>
          <p aria-hidden="true" className={styles.wordmark}>
            Authometry
          </p>
        </div>
      </Container>
    </footer>
  );
}
