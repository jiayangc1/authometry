import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Code2,
  Eye,
  Github,
  KeyRound,
  ListTree,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Terminal,
  Workflow,
} from "lucide-react";
import { AuthometryLogo } from "@authometry/ui";
import { SkipLink } from "@/components/layout/skip-link";
import styles from "./landing.module.css";

export const metadata: Metadata = {
  title: "Open-source OAuth 2.0 and OpenID Connect authorization server",
  description:
    "Self-host OAuth 2.0 and OpenID Connect with inspectable authorization traces, Git-native configuration, agent-aware grants, and a clear admin dashboard.",
  keywords: [
    "OAuth 2.0 server",
    "OpenID Connect provider",
    "self-hosted authentication",
    "open source authorization server",
    "OAuth authorization traces",
    "AI agent authorization",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    title: "Authometry — OAuth you can see",
    description:
      "Open-source OAuth 2.0 and OpenID Connect infrastructure with an explanation for every authorization decision.",
    url: "/",
  },
  twitter: {
    title: "Authometry — OAuth you can see",
    description:
      "Open-source OAuth 2.0 and OpenID Connect infrastructure with an explanation for every authorization decision.",
  },
};

const vaultFrames = Array.from(
  { length: 6 },
  (_, index) => `/landing/vault/vault-frame-${String(index).padStart(2, "0")}.webp`,
);

const capabilities = [
  {
    icon: ListTree,
    title: "Trace every decision",
    copy: "Follow client checks, PKCE, policy evaluation, scopes, consent, and token issuance in order.",
  },
  {
    icon: Code2,
    title: "Keep access in Git",
    copy: "Review applications, scopes, claims, and policies as manifests before they reach production.",
  },
  {
    icon: Workflow,
    title: "Authorize agents precisely",
    copy: "Give agents explicit identities, delegated grants, and reduced tokens without ambient authority.",
  },
] as const;

const protocolFeatures = [
  ["Authorization Code", "Mandatory S256 PKCE"],
  ["OpenID Connect", "Discovery, JWKS, ID tokens"],
  ["Refresh tokens", "Rotation and reuse detection"],
  ["Device flow", "For input-constrained clients"],
  ["DPoP", "Sender-constrained access tokens"],
  ["MCP", "OAuth-scoped management tools"],
] as const;

const faqs = [
  {
    question: "What is Authometry?",
    answer:
      "Authometry is a self-hosted OAuth 2.0 and OpenID Connect authorization platform. It combines a protocol server, administration dashboard, PostgreSQL persistence, Git-native configuration, and a CLI.",
  },
  {
    question: "Can I inspect why an authorization request failed?",
    answer:
      "Yes. Authometry records a redacted, ordered trace of each authorization decision, including client validation, redirect URI matching, PKCE, scopes, policy evaluation, consent, and issuance.",
  },
  {
    question: "Does Authometry support AI agents?",
    answer:
      "Yes. Agents can have registered identities, pushed task authorization, actor-aware DPoP tokens, delegation grants, and reduced one-level token exchange.",
  },
  {
    question: "Is Authometry open source?",
    answer:
      "Yes. The source is available on GitHub under the GNU Affero General Public License v3.0 only, and the configuration CLI can be installed with Homebrew or npm.",
  },
] as const;

const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Authometry",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Linux, macOS, Docker",
  description:
    "Self-hosted OAuth 2.0 and OpenID Connect authorization infrastructure with inspectable traces and Git-native configuration.",
  url: process.env.PUBLIC_ORIGIN ?? "http://localhost:3000",
  codeRepository: "https://github.com/jiayangc1/authometry",
  license: "https://www.gnu.org/licenses/agpl-3.0.html",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export default function LandingPage() {
  return (
    <div className={styles.page}>
      <SkipLink />
      <script
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
        type="application/ld+json"
      />

      <header className={styles.header}>
        <Link aria-label="Authometry home" className={styles.brandLink} href="/">
          <AuthometryLogo />
        </Link>
        <nav aria-label="Primary" className={styles.primaryNav}>
          <a href="#product">Product</a>
          <a href="#protocols">Protocols</a>
          <Link href="/docs">Docs</Link>
          <a href="https://github.com/jiayangc1/authometry" rel="noreferrer">
            Open source
          </a>
        </nav>
        <div className={styles.headerActions}>
          <Link className={styles.signInLink} href="/login">
            Sign in
          </Link>
          <Link className={styles.headerCta} href="/docs/getting-started">
            Start building <ArrowRight aria-hidden="true" size={14} />
          </Link>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        <section className={styles.hero}>
          <div className={styles.heroGlow} />
          <p className={styles.eyebrow}>
            <span /> Open-source authorization infrastructure
          </p>
          <h1>
            Authorization you can
            <span> actually see.</span>
          </h1>
          <p className={styles.heroCopy}>
            Run OAuth 2.0 and OpenID Connect on infrastructure you control—with every policy, token,
            and decision open to inspection.
          </p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryCta} href="/docs/getting-started">
              Start building <ArrowRight aria-hidden="true" size={17} />
            </Link>
            <Link className={styles.secondaryCta} href="/docs/getting-started">
              Read the quickstart <BookOpen aria-hidden="true" size={16} />
            </Link>
          </div>
          <p className={styles.heroNote}>
            <Check aria-hidden="true" size={14} /> Self-hosted
            <span /> <Check aria-hidden="true" size={14} /> AGPL-3.0
            <span /> <Check aria-hidden="true" size={14} /> No hosted lock-in
          </p>
        </section>

        <div aria-label="Supported standards" className={styles.standardStrip}>
          <span>Built for the modern trust stack</span>
          <div>
            <strong>OAuth 2.0</strong>
            <strong>OpenID Connect</strong>
            <strong>PKCE</strong>
            <strong>DPoP</strong>
            <strong>MCP</strong>
          </div>
        </div>

        <section aria-labelledby="vault-title" className={styles.vaultScroll} id="product">
          <div className={styles.vaultSticky}>
            <div className={styles.vaultCopy}>
              <p className={styles.sectionEyebrow}>The trust vault</p>
              <h2 id="vault-title">Security is stronger when it can explain itself.</h2>
              <p className={styles.vaultIntro}>
                Authometry turns an opaque protocol exchange into a sequence your team can follow,
                review, and fix.
              </p>
              <div className={styles.vaultStages}>
                <article className={`${styles.vaultStage} ${styles.stageOne}`}>
                  <span>01</span>
                  <div>
                    <h3>Seal the boundary</h3>
                    <p>Verify the client, redirect URI, and PKCE challenge before access moves.</p>
                  </div>
                </article>
                <article className={`${styles.vaultStage} ${styles.stageTwo}`}>
                  <span>02</span>
                  <div>
                    <h3>Apply the policy</h3>
                    <p>Resolve scopes, claims, consent, and environment rules in one clear path.</p>
                  </div>
                </article>
                <article className={`${styles.vaultStage} ${styles.stageThree}`}>
                  <span>03</span>
                  <div>
                    <h3>Open the evidence</h3>
                    <p>
                      See what ran, what stopped, and the exact correction that unlocks the flow.
                    </p>
                  </div>
                </article>
              </div>
              <p className={styles.scrollCue}>
                <span /> Scroll to open the vault
              </p>
            </div>

            <div className={styles.vaultVisual}>
              <div className={styles.vaultHalo} />
              <div className={styles.vaultFrames}>
                {vaultFrames.map((src, index) => (
                  <Image
                    alt=""
                    aria-hidden="true"
                    className={`${styles.vaultFrame} ${styles[`frame${index}`]}`}
                    height={512}
                    key={src}
                    priority={index < 2}
                    sizes="(max-width: 768px) 88vw, 46vw"
                    src={src}
                    width={512}
                  />
                ))}
              </div>
              <div className={styles.vaultBadge}>
                <ShieldCheck aria-hidden="true" size={18} />
                <span>
                  <strong>Decision explained</strong>
                  req_a72b9c · 8 ms
                </span>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="control-title" className={styles.controlSection}>
          <div className={styles.sectionHeading}>
            <p className={styles.sectionEyebrow}>One inspectable control plane</p>
            <h2 id="control-title">Build trust without building a black box.</h2>
            <p>
              Operate the protocol, policy, and audit surface from one place—without giving up the
              source or the story behind a decision.
            </p>
          </div>

          <div className={styles.capabilityGrid}>
            {capabilities.map(({ icon: Icon, title, copy }, index) => (
              <article className={styles.capabilityCard} key={title}>
                <div className={styles.cardTopline}>
                  <span>0{index + 1}</span>
                  <Icon aria-hidden="true" size={19} />
                </div>
                <div className={styles.cardVisual}>
                  {index === 0 && <TracePreview />}
                  {index === 1 && <ManifestPreview />}
                  {index === 2 && <AgentPreview />}
                </div>
                <h3>{title}</h3>
                <p>{copy}</p>
                <Link href={index === 1 ? "/docs/configuration" : "/docs/oauth-and-oidc"}>
                  Explore the feature <ChevronRight aria-hidden="true" size={15} />
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="protocol-title" className={styles.protocolSection} id="protocols">
          <div className={styles.protocolHeader}>
            <p className={styles.sectionEyebrow}>Standards on the outside</p>
            <h2 id="protocol-title">Protocol-hard. Human-readable.</h2>
            <p>
              Modern OAuth and OpenID Connect behavior, with the operational clarity teams need to
              run it safely.
            </p>
          </div>
          <div className={styles.protocolGrid}>
            {protocolFeatures.map(([title, copy], index) => (
              <article key={title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </div>
                <Check aria-hidden="true" size={17} />
              </article>
            ))}
          </div>
          <div className={styles.protocolFooter}>
            <div>
              <LockKeyhole aria-hidden="true" size={20} />
              Exact redirect matching
            </div>
            <div>
              <KeyRound aria-hidden="true" size={20} />
              Signing-key rotation
            </div>
            <div>
              <Eye aria-hidden="true" size={20} />
              Secret-redacted traces
            </div>
          </div>
        </section>

        <section aria-labelledby="git-title" className={styles.gitSection}>
          <div className={styles.gitCopy}>
            <p className={styles.sectionEyebrow}>Configuration as code</p>
            <h2 id="git-title">Your authorization model belongs in review.</h2>
            <p>
              Plan manifest changes, inspect the diff, and apply the same policy through local,
              staging, and production environments.
            </p>
            <ul>
              <li>
                <Check aria-hidden="true" size={15} /> Review access changes before deployment
              </li>
              <li>
                <Check aria-hidden="true" size={15} /> Keep secrets out of committed manifests
              </li>
              <li>
                <Check aria-hidden="true" size={15} /> Use the same model in CI and the dashboard
              </li>
            </ul>
            <Link className={styles.textLink} href="/docs/configuration">
              Explore configuration as code <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </div>
          <div className={styles.terminalCard}>
            <div className={styles.terminalBar}>
              <span /> <span /> <span />
              <p>authometry.yaml</p>
            </div>
            <pre>
              <code>
                <span>application</span>: dashboard{"\n"}
                {"  "}
                <span>redirectUris</span>:{"\n"}
                {"    "}- $&#123;DASHBOARD_CALLBACK&#125;{"\n"}
                {"  "}
                <span>scopes</span>:{"\n"}
                {"    "}- profile:read{"\n"}
                {"    "}- workspace:manage{"\n"}
                {"  "}
                <span>policy</span>: team-members{"\n"}
                {"  "}
                <span>pkce</span>: required
              </code>
            </pre>
            <div className={styles.terminalResult}>
              <Terminal aria-hidden="true" size={16} />
              <span>
                <strong>Plan ready</strong> 3 resources · 0 destructive changes
              </span>
            </div>
          </div>
        </section>

        <section aria-labelledby="faq-title" className={styles.faqSection}>
          <div>
            <p className={styles.sectionEyebrow}>Questions, answered plainly</p>
            <h2 id="faq-title">Before you open the vault.</h2>
          </div>
          <div className={styles.faqList}>
            {faqs.map(({ question, answer }, index) => (
              <details key={question} open={index === 0}>
                <summary>
                  {question} <span>+</span>
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section aria-labelledby="cta-title" className={styles.finalCta}>
          <div className={styles.ctaOrbOne} />
          <div className={styles.ctaOrbTwo} />
          <Sparkles aria-hidden="true" className={styles.ctaIcon} size={24} />
          <p>Open source. Self-hosted. Inspectable.</p>
          <h2 id="cta-title">Put authorization where your team can see it.</h2>
          <div className={styles.heroActions}>
            <Link className={styles.primaryCta} href="/docs/getting-started">
              Start building <ArrowRight aria-hidden="true" size={17} />
            </Link>
            <a
              className={styles.secondaryCta}
              href="https://github.com/jiayangc1/authometry"
              rel="noreferrer"
            >
              <Github aria-hidden="true" size={16} /> View on GitHub
            </a>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div>
          <Link aria-label="Authometry home" className={styles.brandLink} href="/">
            <AuthometryLogo />
          </Link>
          <p>OAuth you can see.</p>
        </div>
        <nav aria-label="Footer">
          <Link href="/docs">Documentation</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/data-deletion">Data deletion</Link>
          <a href="https://github.com/jiayangc1/authometry" rel="noreferrer">
            GitHub
          </a>
        </nav>
        <p>AGPL-3.0 only</p>
      </footer>
    </div>
  );
}

function TracePreview() {
  return (
    <div className={styles.tracePreview}>
      {[
        ["Client verified", "passed"],
        ["Redirect matched", "passed"],
        ["PKCE validated", "passed"],
        ["Policy evaluated", "active"],
      ].map(([label, status]) => (
        <div key={label}>
          <span className={status === "active" ? styles.activeDot : ""} />
          <p>{label}</p>
          <small>{status === "active" ? "8 ms" : "Passed"}</small>
        </div>
      ))}
    </div>
  );
}

function ManifestPreview() {
  return (
    <div className={styles.manifestPreview}>
      <p>
        <span>+</span> scope: <strong>workspace:manage</strong>
      </p>
      <p>
        <span>+</span> policy: <strong>team-members</strong>
      </p>
      <p>
        <i>~</i> environment: <strong>production</strong>
      </p>
      <div>
        <Check aria-hidden="true" size={13} /> Safe to apply
      </div>
    </div>
  );
}

function AgentPreview() {
  return (
    <div className={styles.agentPreview}>
      <div>A</div>
      <span />
      <div className={styles.agentGrant}>
        <small>Delegated grant</small>
        <strong>repo:read</strong>
      </div>
      <span />
      <div>✓</div>
    </div>
  );
}
