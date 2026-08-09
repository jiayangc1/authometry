"use client";

import {
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Code2,
  Copy,
  Fingerprint,
  Github,
  GitPullRequest,
  KeyRound,
  ListTree,
  LockKeyhole,
  Menu,
  Network,
  Radar,
  ScrollText,
  Server,
  ShieldCheck,
  Sparkles,
  Terminal,
  Users,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { AuthometryLogo, AuthometryMark } from "@authometry/ui";
import { SkipLink } from "@/components/layout/skip-link";
import styles from "./landing.module.css";

const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.25 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
} as const;

const capabilities: Array<{
  icon: LucideIcon;
  label: string;
  title: string;
  copy: string;
  detail: string;
}> = [
  {
    icon: ListTree,
    label: "Observe",
    title: "See why access was granted.",
    copy: "Follow every client check, redirect match, policy rule, consent step, and token claim in one ordered trace.",
    detail: "Redacted by default",
  },
  {
    icon: GitPullRequest,
    label: "Control",
    title: "Review authorization like code.",
    copy: "Define applications, scopes, claims, and policies in manifests. Preview every change before it reaches production.",
    detail: "Plan before apply",
  },
  {
    icon: Bot,
    label: "Delegate",
    title: "Give agents less, on purpose.",
    copy: "Issue short-lived, sender-constrained grants to registered agents without handing over a user’s full authority.",
    detail: "Actor-aware tokens",
  },
];

const standards = [
  [KeyRound, "OAuth 2.0"],
  [Fingerprint, "OpenID Connect"],
  [ShieldCheck, "S256 PKCE"],
  [Network, "DPoP"],
] as const;

const traceSteps = [
  { label: "Client credentials", meta: "confidential client", status: "passed", time: "2 ms" },
  { label: "Redirect URI", meta: "exact match", status: "passed", time: "1 ms" },
  { label: "PKCE challenge", meta: "S256 verified", status: "passed", time: "3 ms" },
  { label: "Workspace policy", meta: "admin:write not assigned", status: "denied", time: "6 ms" },
] as const;

const footerGroups = [
  {
    title: "Product",
    links: [
      ["Dashboard", "/login"],
      ["Applications", "/applications"],
      ["Authorization traces", "/traces"],
      ["Agent grants", "/agent-grants"],
    ],
  },
  {
    title: "Learn",
    links: [
      ["Documentation", "/docs"],
      ["Quickstart", "/docs/getting-started"],
      ["OAuth & OIDC", "/docs/oauth-and-oidc"],
      ["MCP server", "/docs/mcp"],
    ],
  },
  {
    title: "Project",
    links: [
      ["GitHub", "https://github.com/jiayangc1/authometry"],
      ["Contributing", "https://github.com/jiayangc1/authometry/blob/main/CONTRIBUTING.md"],
      ["Privacy", "/privacy"],
      ["Terms", "/terms"],
    ],
  },
] as const;

const agentPrompt = "Add Authometry OAuth to my app: https://authometry.ch3n.cc/SKILL.md";

export function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(agentPrompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={styles.page}>
      <SkipLink />
      <header className={styles.header}>
        <nav aria-label="Main navigation" className={styles.nav}>
          <Link aria-label="Authometry home" className={styles.logo} href="/">
            <AuthometryLogo />
          </Link>
          <div className={styles.navLinks}>
            <a href="#product">Product</a>
            <a href="#agents">Agents</a>
            <Link href="/docs">Docs</Link>
            <a href="https://github.com/jiayangc1/authometry">GitHub</a>
          </div>
          <div className={styles.navActions}>
            <Link className={styles.signIn} href="/portal">
              Sign in
            </Link>
            <Link className={styles.navButton} href="/login">
              Open dashboard <ArrowRight aria-hidden="true" />
            </Link>
            <button
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
              className={styles.menuButton}
              onClick={() => setMobileOpen((value) => !value)}
              type="button"
            >
              {mobileOpen ? <X /> : <Menu />}
            </button>
          </div>
        </nav>
        <AnimatePresence>
          {mobileOpen && (
            <motion.nav
              animate={{ opacity: 1, y: 0 }}
              aria-label="Mobile navigation"
              className={styles.mobileNav}
              exit={{ opacity: 0, y: -8 }}
              initial={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <a href="#product" onClick={() => setMobileOpen(false)}>
                Product
              </a>
              <a href="#agents" onClick={() => setMobileOpen(false)}>
                Agents
              </a>
              <Link href="/docs">Documentation</Link>
              <a href="https://github.com/jiayangc1/authometry">GitHub</a>
              <Link href="/login">
                Open dashboard <ArrowRight />
              </Link>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      <main id="main-content" tabIndex={-1}>
        <section className={styles.hero}>
          <div aria-hidden="true" className={styles.heroGrid} />
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className={styles.heroCopy}
            initial={{ opacity: 0, y: 18 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <a className={styles.releasePill} href="https://github.com/jiayangc1/authometry">
              <span>
                <Sparkles aria-hidden="true" /> Open-source authorization infrastructure
              </span>
              <ChevronRight aria-hidden="true" />
            </a>
            <h1>
              Access decisions,
              <br />
              <span>without the guesswork.</span>
            </h1>
            <p>
              Authometry is a self-hosted OAuth and OpenID Connect control plane that makes every
              authorization decision visible, reviewable, and yours.
            </p>
            <div className={styles.heroActions}>
              <Link className={styles.primaryButton} href="/docs/getting-started">
                Start building <ArrowRight aria-hidden="true" />
              </Link>
              <Link className={styles.secondaryButton} href="/login">
                Explore the dashboard
              </Link>
            </div>
            <div className={styles.heroProof}>
              <div className={styles.proofAvatars} aria-hidden="true">
                <span>
                  <Code2 />
                </span>
                <span>
                  <Terminal />
                </span>
                <span>
                  <Server />
                </span>
              </div>
              <p>
                <strong>Built for teams that own their trust boundary.</strong>
                <br />
                Standards-first. No black-box decisions.
              </p>
            </div>
          </motion.div>

          <motion.div
            animate={{ opacity: 1, x: 0, rotateY: 0 }}
            className={styles.heroVisual}
            initial={{ opacity: 0, x: 36, rotateY: -5 }}
            transition={{ duration: 0.85, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className={styles.traceWindow}>
              <div className={styles.windowHeader}>
                <div>
                  <i />
                  <i />
                  <i />
                </div>
                <span>Authorization trace</span>
                <code>req_a72b9c</code>
              </div>
              <div className={styles.traceSummary}>
                <span className={styles.decisionIcon}>
                  <XCircle aria-hidden="true" />
                </span>
                <div>
                  <small>Decision</small>
                  <strong>Request denied</strong>
                </div>
                <span className={styles.traceDuration}>12 ms</span>
              </div>
              <div className={styles.tracePath}>
                {traceSteps.map((step, index) => (
                  <div className={styles.traceStep} key={step.label}>
                    <span
                      className={`${styles.stepDot} ${step.status === "denied" ? styles.stepDenied : ""}`}
                    >
                      {step.status === "passed" ? <Check /> : <X />}
                    </span>
                    <div>
                      <strong>{step.label}</strong>
                      <small>{step.meta}</small>
                    </div>
                    <time>{step.time}</time>
                    {index < traceSteps.length - 1 && <i aria-hidden="true" />}
                  </div>
                ))}
              </div>
              <div className={styles.traceFix}>
                <span>
                  <Radar aria-hidden="true" />
                </span>
                <div>
                  <strong>How to fix it</strong>
                  <p>
                    Assign <code>admin:write</code> to this workspace, or remove it from the
                    request.
                  </p>
                </div>
                <ArrowRight aria-hidden="true" />
              </div>
            </div>
            <div className={styles.floatingTag}>
              <CircleDot /> Live decision path
            </div>
          </motion.div>
        </section>

        <section aria-label="Supported standards" className={styles.standards}>
          <p>Built on the standards your stack already speaks</p>
          <div>
            {standards.map(([Icon, name]) => (
              <span key={name}>
                <Icon aria-hidden="true" /> {name}
              </span>
            ))}
          </div>
        </section>

        <section className={styles.productSection} id="product">
          <motion.div className={styles.sectionHeading} {...reveal}>
            <span className={styles.eyebrow}>One control plane</span>
            <h2>Authorization should explain itself.</h2>
            <p>
              Configure the system, watch it decide, and know exactly what to change—without
              stitching together another maze of tools.
            </p>
          </motion.div>
          <div className={styles.capabilityGrid}>
            {capabilities.map((item, index) => (
              <motion.article
                className={styles.capabilityCard}
                key={item.title}
                {...reveal}
                transition={{ ...reveal.transition, delay: index * 0.08 }}
              >
                <div className={styles.capabilityTop}>
                  <span>
                    <item.icon aria-hidden="true" />
                  </span>
                  <small>{item.label}</small>
                </div>
                <h3>{item.title}</h3>
                <p>{item.copy}</p>
                <div className={styles.cardMeta}>
                  <CheckCircle2 aria-hidden="true" /> {item.detail}
                </div>
              </motion.article>
            ))}
          </div>
        </section>

        <section className={styles.flowSection}>
          <motion.div className={styles.flowCopy} {...reveal}>
            <span className={styles.eyebrow}>From request to reason</span>
            <h2>One path. Every answer.</h2>
            <p>
              Authometry keeps the protocol, policy, and evidence together. The same path that
              issues a token also produces the trace your team can inspect.
            </p>
            <ul>
              <li>
                <Check aria-hidden="true" /> Exact redirect matching and PKCE
              </li>
              <li>
                <Check aria-hidden="true" /> Central session and refresh-token lifecycle
              </li>
              <li>
                <Check aria-hidden="true" /> Redacted audit evidence for every decision
              </li>
            </ul>
            <Link className={styles.textLink} href="/docs/oauth-and-oidc">
              Explore OAuth &amp; OIDC <ArrowRight />
            </Link>
          </motion.div>
          <motion.div className={styles.flowMap} {...reveal}>
            <FlowNode icon={Users} label="Identity" meta="verified" />
            <FlowConnector label="claims" />
            <FlowNode icon={ShieldCheck} label="Policy" meta="evaluated" featured />
            <FlowConnector label="decision" />
            <FlowNode icon={KeyRound} label="Token" meta="issued" />
            <div className={styles.flowTrace}>
              <ListTree /> Trace recorded <span>12 ms</span>
            </div>
          </motion.div>
        </section>

        <section className={styles.agentSection} id="agents">
          <div aria-hidden="true" className={styles.agentGlow} />
          <motion.div className={styles.agentCopy} {...reveal}>
            <span className={styles.darkEyebrow}>
              <Bot /> Agent authorization
            </span>
            <h2>
              Delegate the task.
              <br />
              Keep the authority.
            </h2>
            <p>
              Register agent identities, reduce human grants to exactly what the task needs, and
              bind access to the agent that requested it.
            </p>
            <div className={styles.agentPrompt}>
              <code>{agentPrompt}</code>
              <button
                aria-label={copied ? "Prompt copied" : "Copy agent prompt"}
                onClick={() => void copyPrompt()}
                type="button"
              >
                {copied ? <Check /> : <Copy />}
              </button>
            </div>
            <Link className={styles.darkLink} href="/docs/mcp">
              Read the agent authorization guide <ArrowRight />
            </Link>
          </motion.div>
          <motion.div className={styles.grantCard} {...reveal}>
            <div className={styles.grantHeader}>
              <span>
                <AuthometryMark />
              </span>
              <div>
                <small>Delegated grant</small>
                <strong>Release assistant</strong>
              </div>
              <em>Active</em>
            </div>
            <div className={styles.grantActor}>
              <div>
                <Users />
                <span>
                  <small>ACTOR</small>
                  <strong>Jiayang</strong>
                </span>
              </div>
              <ArrowRight />
              <div>
                <Bot />
                <span>
                  <small>DELEGATE</small>
                  <strong>Release agent</strong>
                </span>
              </div>
            </div>
            <div className={styles.grantScopes}>
              <p>
                <span>Granted scopes</span>
                <strong>2 of 3</strong>
              </p>
              <div>
                <code>deployments:read</code>
                <Check />
              </div>
              <div>
                <code>deployments:create</code>
                <Check />
              </div>
              <div className={styles.scopeDenied}>
                <code>secrets:write</code>
                <LockKeyhole />
              </div>
            </div>
            <div className={styles.grantFooter}>
              <ShieldCheck />
              <span>
                <strong>Reduced by policy</strong>Expires in 18 minutes
              </span>
            </div>
          </motion.div>
        </section>

        <section className={styles.ctaSection}>
          <motion.div {...reveal}>
            <span className={styles.eyebrow}>Your trust boundary</span>
            <h2>
              Own the decision.
              <br />
              Understand the outcome.
            </h2>
            <p>
              Deploy Authometry, register your first application, and follow an authorization
              request from start to finish.
            </p>
            <div className={styles.heroActions}>
              <Link className={styles.primaryButton} href="/docs/getting-started">
                Get started <ArrowRight />
              </Link>
              <a className={styles.secondaryButton} href="https://github.com/jiayangc1/authometry">
                <Github /> View on GitHub
              </a>
            </div>
          </motion.div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerBrand}>
          <Link aria-label="Authometry home" href="/">
            <AuthometryLogo />
          </Link>
          <p>Transparent authorization infrastructure for applications, teams, and AI agents.</p>
          <span>
            <i /> Open source · AGPL-3.0
          </span>
        </div>
        <div className={styles.footerLinks}>
          {footerGroups.map((group) => (
            <div key={group.title}>
              <h2>{group.title}</h2>
              {group.links.map(([label, href]) => (
                <Link href={href} key={label}>
                  {label}
                </Link>
              ))}
            </div>
          ))}
        </div>
        <div className={styles.footerBottom}>
          <span>© 2026 Authometry</span>
          <div>
            <a aria-label="GitHub" href="https://github.com/jiayangc1/authometry">
              <Github />
            </a>
            <Link aria-label="Documentation" href="/docs">
              <ScrollText />
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FlowNode({
  featured = false,
  icon: Icon,
  label,
  meta,
}: {
  featured?: boolean;
  icon: LucideIcon;
  label: string;
  meta: string;
}) {
  return (
    <div className={`${styles.flowNode} ${featured ? styles.flowNodeFeatured : ""}`}>
      <span>
        <Icon />
      </span>
      <strong>{label}</strong>
      <small>{meta}</small>
    </div>
  );
}

function FlowConnector({ label }: { label: string }) {
  return (
    <div className={styles.flowConnector}>
      <span>{label}</span>
      <i>
        <b />
      </i>
      <ArrowRight />
    </div>
  );
}
