"use client";

import {
  Activity,
  AppWindow,
  ArrowRight,
  Bot,
  Braces,
  Check,
  ChevronDown,
  CircleGauge,
  Cloud,
  Code2,
  Copy,
  Database,
  FileClock,
  Fingerprint,
  Github,
  GitPullRequest,
  Globe2,
  KeyRound,
  ListTree,
  Menu,
  Network,
  Orbit,
  ScanLine,
  ScrollText,
  Server,
  ShieldCheck,
  Terminal,
  UserRoundCheck,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthometryLogo, AuthometryMark } from "@authometry/ui";
import { SkipLink } from "@/components/layout/skip-link";
import styles from "./landing.module.css";

const componentTabs = [
  {
    label: "Authorization Traces",
    code: "<AuthorizationTrace />",
    description:
      "Follow client validation, redirect matching, PKCE, policy evaluation, consent, and token issuance in order.",
  },
  {
    label: "Configuration as Code",
    code: "authometry plan",
    description:
      "Review applications, scopes, claims, and policies as Git-managed manifests before they reach production.",
  },
  {
    label: "Agent Authorization",
    code: "<AgentGrant />",
    description:
      "Give every agent an explicit identity, delegated grant, and reduced token without ambient authority.",
  },
] as const;

const securityCards: Array<{
  title: string;
  description: string;
  icon: LucideIcon;
  visual:
    "trace" | "session" | "policy" | "social" | "abuse" | "keys" | "mcp" | "claims" | "device";
}> = [
  {
    title: "Authorization traces",
    description: "See what ran, what stopped, and the exact correction that unlocks the flow.",
    icon: ListTree,
    visual: "trace",
  },
  {
    title: "Session lifecycle",
    description:
      "Rotate refresh tokens, detect family reuse, and revoke active sessions centrally.",
    icon: FileClock,
    visual: "session",
  },
  {
    title: "Policy evaluation",
    description: "Resolve scopes, claims, consent, and environment rules through one clear path.",
    icon: ShieldCheck,
    visual: "policy",
  },
  {
    title: "Social sign-on",
    description: "Connect Google and GitHub identities without losing control of your user model.",
    icon: Globe2,
    visual: "social",
  },
  {
    title: "Abuse prevention",
    description: "Enforce exact redirect matching, PKCE, rate limits, and safe outbound requests.",
    icon: ScanLine,
    visual: "abuse",
  },
  {
    title: "Signing keys",
    description: "Rotate keys safely and publish standards-compliant JWKS from your own instance.",
    icon: KeyRound,
    visual: "keys",
  },
  {
    title: "OAuth-scoped MCP",
    description:
      "Let authorized AI clients inspect and manage the same resources as the dashboard.",
    icon: Bot,
    visual: "mcp",
  },
  {
    title: "Custom claims",
    description: "Map only the claims each application needs into ID and access tokens.",
    icon: Braces,
    visual: "claims",
  },
  {
    title: "Device authorization",
    description: "Support input-constrained clients with a secure, familiar device flow.",
    icon: Fingerprint,
    visual: "device",
  },
];

const workspaceCards = [
  {
    icon: Users,
    title: "Custom roles and membership",
    copy: "Keep owners, administrators, and viewers aligned to the access each workspace needs.",
    visual: "roles",
  },
  {
    icon: Cloud,
    title: "Environment separation",
    copy: "Move between development and production without mixing issuers, keys, or policy state.",
    visual: "environment",
  },
  {
    icon: UserRoundCheck,
    title: "Invitations",
    copy: "Invite teammates into the right workspace with a clear role from the first session.",
    visual: "invite",
  },
  {
    icon: Activity,
    title: "Audit events",
    copy: "Keep a durable record of the configuration and membership changes made by your team.",
    visual: "audit",
  },
] as const;

const platformTiles = [
  { icon: Code2, label: "Next.js" },
  { icon: AppWindow, label: "React" },
  { icon: Server, label: "Express" },
  { icon: Terminal, label: "CLI" },
  { icon: Database, label: "PostgreSQL" },
  { icon: Github, label: "GitHub" },
  { icon: Globe2, label: "Google" },
  { icon: Network, label: "MCP" },
] as const;

const trustStandards = [
  { name: "OAuth 2.0", icon: KeyRound },
  { name: "OpenID Connect", icon: Orbit },
  { name: "S256 PKCE", icon: ShieldCheck },
  { name: "DPoP", icon: Network },
] as const;

const agentPrompt = "Add Authometry OAuth to my app: https://authometry.ch3n.cc/SKILL.md";

const principleCards = [
  {
    eyebrow: "Every request",
    title: "A decision should come with evidence.",
    copy: "Authometry records a redacted, ordered trace through client checks, PKCE, consent, policy, and issuance.",
    icon: ListTree,
  },
  {
    eyebrow: "Every environment",
    title: "Configuration should survive review.",
    copy: "Plan and apply OAuth resources from manifests so access changes move through the same process as code.",
    icon: GitPullRequest,
  },
  {
    eyebrow: "Every actor",
    title: "Agents should never inherit ambient authority.",
    copy: "Register agent identities and constrain delegated tasks with actor-aware DPoP tokens and reduced grants.",
    icon: Bot,
  },
  {
    eyebrow: "Every deployment",
    title: "The protocol surface stays yours.",
    copy: "Run the authorization server, dashboard, database, keys, and audit trail on infrastructure you control.",
    icon: Server,
  },
] as const;

const footerColumns = [
  {
    title: "Product",
    links: [
      ["Authorization traces", "/traces"],
      ["Applications", "/applications"],
      ["Agent grants", "/agent-grants"],
      ["Configuration", "/docs/configuration"],
    ],
  },
  {
    title: "Protocols",
    links: [
      ["OAuth 2.0", "/docs/oauth-and-oidc"],
      ["OpenID Connect", "/docs/oauth-and-oidc"],
      ["Device flow", "/docs/oauth-and-oidc"],
      ["MCP server", "/docs/mcp"],
    ],
  },
  {
    title: "Resources",
    links: [
      ["Documentation", "/docs"],
      ["Getting started", "/docs/getting-started"],
      ["API reference", "/docs/api"],
      ["Security", "/docs/security"],
    ],
  },
  {
    title: "Project",
    links: [
      ["GitHub", "https://github.com/jiayangc1/authometry"],
      ["Contributing", "https://github.com/jiayangc1/authometry/blob/main/CONTRIBUTING.md"],
      ["License", "https://github.com/jiayangc1/authometry/blob/main/LICENSE"],
      ["Dashboard", "/login"],
    ],
  },
  {
    title: "Legal",
    links: [
      ["Terms", "/terms"],
      ["Privacy", "/privacy"],
      ["Data deletion", "/data-deletion"],
      ["Security policy", "/docs/security"],
    ],
  },
] as const;

export function LandingPage() {
  const [activeComponent, setActiveComponent] = useState(0);
  const [agentPromptStatus, setAgentPromptStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navDark, setNavDark] = useState(false);

  async function copyAgentPrompt() {
    try {
      await navigator.clipboard.writeText(agentPrompt);
      setAgentPromptStatus("copied");
      window.setTimeout(() => setAgentPromptStatus("idle"), 1800);
    } catch {
      setAgentPromptStatus("failed");
    }
  }

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const probe = 29;
      const dark = Array.from(
        document.querySelectorAll<HTMLElement>("[data-nav-theme='dark']"),
      ).some((element) => {
        const rect = element.getBoundingClientRect();
        return rect.top <= probe && rect.bottom >= probe;
      });
      setNavDark(dark);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div className={styles.page}>
      <SkipLink />
      <a className={styles.announcement} href="https://github.com/jiayangc1/authometry">
        <span>Authometry is open source</span>
        <i />
        <strong>Explore the repository</strong>
        <ArrowRight aria-hidden="true" />
      </a>

      <header className={`${styles.header} ${navDark ? styles.headerDark : ""}`}>
        <div className={styles.navBar}>
          <Link aria-label="Authometry home" className={styles.logoLink} href="/">
            <AuthometryLogo />
          </Link>
          <span className={styles.navRule} />
          <nav aria-label="Main" className={styles.desktopNav}>
            <a href="#product">Product</a>
            <Link href="/docs">Docs</Link>
            <a href="#protocols">Protocols</a>
            <a href="#workspaces">Workspaces</a>
            <a href="https://github.com/jiayangc1/authometry">GitHub</a>
          </nav>
          <div className={styles.navActions}>
            <Link className={styles.signIn} href="/login">
              Sign in
            </Link>
            <ArrowLink className={styles.navCta} href="/login">
              Open dashboard
            </ArrowLink>
            <button
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
              className={styles.mobileMenuButton}
              onClick={() => setMobileOpen((open) => !open)}
              type="button"
            >
              {mobileOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        <AnimatePresence>
          {mobileOpen && (
            <motion.nav
              animate={{ opacity: 1, y: 0 }}
              aria-label="Mobile"
              className={styles.mobileNav}
              exit={{ opacity: 0, y: -8 }}
              initial={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.33, 1, 0.68, 1] }}
            >
              <a href="#product" onClick={() => setMobileOpen(false)}>
                Product
              </a>
              <Link href="/docs">Docs</Link>
              <a href="#protocols" onClick={() => setMobileOpen(false)}>
                Protocols
              </a>
              <a href="#workspaces" onClick={() => setMobileOpen(false)}>
                Workspaces
              </a>
              <a href="https://github.com/jiayangc1/authometry">GitHub</a>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      <main id="main-content" tabIndex={-1}>
        <section className={styles.hero}>
          <CircuitBackdrop />
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className={styles.heroInner}
            initial={{ opacity: 0, y: 14 }}
            transition={{ duration: 0.65, delay: 0.08, ease: [0.33, 1, 0.68, 1] }}
          >
            <h1>
              More than authentication,
              <br />
              Complete Access <span className={styles.mobileHeadlineBreak}>Control</span>
            </h1>
            <p>
              Need more than sign-in? Authometry gives you OAuth, OpenID Connect, policy, and audit
              infrastructure—so every identity and access decision stays visible.
            </p>
            <div className={styles.heroActions}>
              <ArrowLink className={styles.primaryButton} href="/docs/getting-started">
                Start building for free
              </ArrowLink>
              <ArrowLink className={styles.secondaryButton} href="/login">
                Explore the dashboard
              </ArrowLink>
            </div>
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className={styles.agentPrompt}
              initial={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.55, delay: 0.35, ease: [0.33, 1, 0.68, 1] }}
            >
              <div className={styles.agentPromptCard}>
                <div className={styles.agentPromptHeader}>
                  <span>
                    <Bot aria-hidden="true" /> Agent
                  </span>
                  <Link href="/SKILL.md">
                    Read SKILL.md <ArrowRight aria-hidden="true" />
                  </Link>
                </div>
                <div className={styles.agentPromptRow}>
                  <code>{agentPrompt}</code>
                  <button
                    aria-label={
                      agentPromptStatus === "copied"
                        ? "Agent prompt copied"
                        : agentPromptStatus === "failed"
                          ? "Clipboard unavailable. Select and copy the prompt."
                          : "Copy agent prompt"
                    }
                    className={agentPromptStatus === "copied" ? styles.promptCopied : ""}
                    onClick={() => void copyAgentPrompt()}
                    title={
                      agentPromptStatus === "failed"
                        ? "Clipboard unavailable — select the prompt and copy it"
                        : undefined
                    }
                    type="button"
                  >
                    {agentPromptStatus === "copied" ? (
                      <Check aria-hidden="true" />
                    ) : (
                      <Copy aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>
              <div aria-live="polite" className={styles.agentPromptGuide}>
                {agentPromptStatus === "failed" ? (
                  <span>Select the prompt and copy it manually.</span>
                ) : (
                  <>
                    <span>Or start building with the</span>
                    <Link href="/docs/getting-started">
                      Quickstart guide <ArrowRight aria-hidden="true" />
                    </Link>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        </section>

        <section aria-label="Authometry standards" className={styles.trustStrip}>
          <p>Built on standards your stack already trusts.</p>
          <div className={styles.trustTrack}>
            {trustStandards.map(({ icon: Icon, name }) => (
              <div className={styles.trustItem} key={name}>
                <Icon aria-hidden="true" />
                <strong>{name}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.componentsSection} id="product">
          <div className={styles.componentsInner}>
            <motion.div
              className={styles.componentCopy}
              initial={{ opacity: 0, y: 24 }}
              transition={{ duration: 0.6, ease: [0.33, 1, 0.68, 1] }}
              viewport={{ amount: 0.3, once: true }}
              whileInView={{ opacity: 1, y: 0 }}
            >
              <p className={styles.purpleEyebrow}>Authometry control plane</p>
              <h2>Observable OAuth, configured in minutes</h2>
              <p className={styles.sectionLead}>
                Register applications, manage identities and scopes, enforce policy, and inspect
                every authorization path from a control plane that matches your infrastructure.
              </p>
              <ArrowLink className={styles.textLink} href="/login">
                Explore the dashboard
              </ArrowLink>
              <div className={styles.componentAccordion}>
                {componentTabs.map((tab, index) => {
                  const active = activeComponent === index;
                  return (
                    <div className={styles.accordionItem} key={tab.label}>
                      <button
                        aria-expanded={active}
                        className={styles.accordionTrigger}
                        onClick={() => setActiveComponent(index)}
                        type="button"
                      >
                        <span className={active ? styles.activeDot : ""} />
                        {tab.label}
                        <ChevronDown aria-hidden="true" />
                      </button>
                      <div className={`${styles.accordionPanel} ${active ? styles.panelOpen : ""}`}>
                        <div>
                          <p>{tab.description}</p>
                          <code>{tab.code}</code>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            <div className={styles.componentStage}>
              <div className={styles.stageGrid} />
              <AnimatePresence mode="wait">
                <motion.div
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  className={styles.stageContent}
                  exit={{ opacity: 0, x: -28, scale: 0.98 }}
                  initial={{ opacity: 0, x: 34, scale: 0.98 }}
                  key={activeComponent}
                  transition={{ duration: 0.5, ease: [0.33, 1, 0.68, 1] }}
                >
                  {activeComponent === 0 && <TraceStage />}
                  {activeComponent === 1 && <ManifestStage />}
                  {activeComponent === 2 && <AgentStage />}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </section>

        <NotchedDivider dark />

        <section className={styles.securitySection} data-nav-theme="dark" id="protocols">
          <div className={styles.securityBackdrop} />
          <motion.div
            className={styles.darkHeading}
            initial={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.6, ease: [0.33, 1, 0.68, 1] }}
            viewport={{ amount: 0.4, once: true }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            <p>Authorization infrastructure</p>
            <h2>Everything you need for trustworthy access</h2>
            <span>
              Authometry keeps protocol correctness, security defaults, and operational evidence
              together from sign-in through token issuance.
            </span>
            <ArrowLink className={styles.darkTextLink} href="/docs/oauth-and-oidc">
              Explore OAuth and OpenID Connect
            </ArrowLink>
          </motion.div>
          <div className={styles.securityGrid}>
            {securityCards.map((card, index) => (
              <motion.article
                className={`${styles.securityCard} ${styles[`securityCard${index + 1}`]}`}
                initial={{ opacity: 0, y: 28 }}
                key={card.title}
                transition={{ duration: 0.55, delay: (index % 3) * 0.05, ease: [0.33, 1, 0.68, 1] }}
                viewport={{ amount: 0.15, once: true }}
                whileInView={{ opacity: 1, y: 0 }}
              >
                <CardVisual type={card.visual} />
                <div className={styles.securityCardCopy}>
                  <card.icon aria-hidden="true" />
                  <h3>{card.title}</h3>
                  <p>{card.description}</p>
                </div>
              </motion.article>
            ))}
          </div>
        </section>

        <NotchedDivider />

        <section className={styles.workspaceSection} id="workspaces">
          <motion.div
            className={styles.lightHeading}
            initial={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.6, ease: [0.33, 1, 0.68, 1] }}
            viewport={{ amount: 0.4, once: true }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            <p className={styles.purpleEyebrow}>Workspace authorization</p>
            <h2>The clear solution to multi-tenancy</h2>
            <span>
              Manage the people, roles, environments, and audit history behind every application
              from one consistent workspace model.
            </span>
            <ArrowLink className={styles.textLink} href="/settings/members">
              Explore workspace controls
            </ArrowLink>
          </motion.div>
          <div className={styles.workspaceGrid}>
            {workspaceCards.map((card, index) => (
              <motion.article
                className={styles.workspaceCard}
                initial={{ opacity: 0, y: 24 }}
                key={card.title}
                transition={{ duration: 0.55, delay: index * 0.05, ease: [0.33, 1, 0.68, 1] }}
                viewport={{ amount: 0.2, once: true }}
                whileInView={{ opacity: 1, y: 0 }}
              >
                <WorkspaceVisual type={card.visual} />
                <div>
                  <card.icon aria-hidden="true" />
                  <h3>{card.title}</h3>
                  <p>{card.copy}</p>
                </div>
              </motion.article>
            ))}
          </div>
        </section>

        <section className={styles.agentSection}>
          <motion.div
            className={styles.agentCopy}
            initial={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.65, ease: [0.33, 1, 0.68, 1] }}
            viewport={{ amount: 0.35, once: true }}
            whileInView={{ opacity: 1, x: 0 }}
          >
            <p className={styles.purpleEyebrow}>Agent authorization</p>
            <h2>Delegate work, without delegating control</h2>
            <p>
              Give agents registered identities, task-scoped grants, actor-aware tokens, and a
              complete trace of every delegated authorization decision.
            </p>
            <ul>
              <li>
                <Check aria-hidden="true" /> Explicit agent identities
              </li>
              <li>
                <Check aria-hidden="true" /> Reduced one-level token exchange
              </li>
              <li>
                <Check aria-hidden="true" /> Sender-constrained DPoP access
              </li>
            </ul>
            <ArrowLink className={styles.textLink} href="/agents">
              Explore agent authorization
            </ArrowLink>
          </motion.div>
          <motion.div
            className={styles.agentWindow}
            initial={{ opacity: 0, x: 40, rotateY: -4 }}
            transition={{ duration: 0.75, ease: [0.33, 1, 0.68, 1] }}
            viewport={{ amount: 0.3, once: true }}
            whileInView={{ opacity: 1, x: 0, rotateY: 0 }}
          >
            <div className={styles.windowBar}>
              <i /> <i /> <i />
              <span>Authometry · Agent grant</span>
            </div>
            <div className={styles.windowBody}>
              <div className={styles.agentIdentity}>
                <span className={styles.agentAvatar}>
                  <Bot aria-hidden="true" />
                </span>
                <div>
                  <strong>Deployment assistant</strong>
                  <small>agent_deploy_01</small>
                </div>
                <em>Active</em>
              </div>
              <div className={styles.grantFlow}>
                <FlowNode icon={Users} label="Jiayang" meta="actor" />
                <span className={styles.flowLine}>
                  <i />
                </span>
                <FlowNode icon={Bot} label="Deploy agent" meta="delegate" />
                <span className={styles.flowLine}>
                  <i />
                </span>
                <FlowNode icon={Cloud} label="Production" meta="resource" />
              </div>
              <div className={styles.scopePanel}>
                <div>
                  <span>Granted scopes</span>
                  <strong>2 of 6 requested</strong>
                </div>
                <div className={styles.scopePills}>
                  <code>deployment:read</code>
                  <code>deployment:create</code>
                  <code className={styles.deniedScope}>secrets:write</code>
                </div>
              </div>
              <div className={styles.agentDecision}>
                <ShieldCheck aria-hidden="true" />
                <span>
                  <strong>Grant reduced by policy</strong>
                  secrets:write removed · 12 ms
                </span>
                <ArrowRight aria-hidden="true" />
              </div>
            </div>
          </motion.div>
        </section>

        <NotchedDivider dark />

        <section className={styles.platformSection} data-nav-theme="dark">
          <div className={styles.platformColumns}>
            <div className={styles.platformIntro}>
              <p>Frameworks</p>
              <h2>Build with the stack you already use</h2>
              <span>
                A same-origin web dashboard, an Express protocol server, and standards any client
                can speak.
              </span>
              <ArrowLink className={styles.darkTextLink} href="/docs/getting-started">
                Read the quickstart
              </ArrowLink>
            </div>
            <div className={styles.platformIntro}>
              <p>Integrations</p>
              <h2>Connect the tools behind your trust boundary</h2>
              <span>
                Keep identity, storage, deployment, and AI access connected without surrendering
                your source of truth.
              </span>
              <ArrowLink className={styles.darkTextLink} href="/docs">
                Browse documentation
              </ArrowLink>
            </div>
          </div>
          <div className={styles.platformGrid}>
            {platformTiles.map((tile, index) => (
              <motion.div
                className={styles.platformTile}
                initial={{ opacity: 0, scale: 0.94 }}
                key={tile.label}
                transition={{ duration: 0.45, delay: (index % 4) * 0.04, ease: [0.33, 1, 0.68, 1] }}
                viewport={{ amount: 0.2, once: true }}
                whileInView={{ opacity: 1, scale: 1 }}
              >
                <tile.icon aria-hidden="true" />
                <strong>{tile.label}</strong>
              </motion.div>
            ))}
          </div>
        </section>

        <NotchedDivider />

        <section className={styles.principlesSection}>
          <div className={styles.principlesIntro}>
            <p className={styles.purpleEyebrow}>Trust, made inspectable</p>
            <h2>Built around the things authorization teams should never have to guess</h2>
            <p>
              Authometry keeps control, evidence, and standards together across every request,
              environment, actor, and deployment.
            </p>
            <ArrowLink className={styles.primaryButton} href="/docs/getting-started">
              Start building for free
            </ArrowLink>
          </div>
          <div className={styles.principleGrid}>
            {principleCards.map((card, index) => (
              <motion.article
                className={styles.principleCard}
                initial={{ opacity: 0, y: 24 }}
                key={card.title}
                transition={{ duration: 0.55, delay: index * 0.05, ease: [0.33, 1, 0.68, 1] }}
                viewport={{ amount: 0.2, once: true }}
                whileInView={{ opacity: 1, y: 0 }}
              >
                <div>
                  <card.icon aria-hidden="true" />
                  <span>{card.eyebrow}</span>
                </div>
                <h3>{card.title}</h3>
                <p>{card.copy}</p>
              </motion.article>
            ))}
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerGrid}>
          <Link aria-label="Authometry home" className={styles.footerLogo} href="/">
            <AuthometryLogo />
          </Link>
          {footerColumns.map((column) => (
            <div className={styles.footerColumn} key={column.title}>
              <h2>{column.title}</h2>
              {column.links.map(([label, href]) => (
                <Link href={href} key={label}>
                  {label}
                </Link>
              ))}
            </div>
          ))}
        </div>
        <div className={styles.footerBottom}>
          <span>© 2026 Authometry. Released under AGPL-3.0.</span>
          <div>
            <a aria-label="Authometry on GitHub" href="https://github.com/jiayangc1/authometry">
              <Github />
            </a>
            <Link aria-label="Authometry documentation" href="/docs">
              <ScrollText />
            </Link>
            <Link aria-label="Open Authometry dashboard" href="/login">
              <CircleGauge />
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ArrowLink({
  children,
  className,
  href,
}: {
  children: React.ReactNode;
  className: string | undefined;
  href: string;
}) {
  return (
    <Link className={`${styles.arrowLink} ${className ?? ""}`} href={href}>
      <span>{children}</span>
      <span className={styles.arrowSwap}>
        <ArrowRight aria-hidden="true" />
        <ArrowRight aria-hidden="true" />
      </span>
    </Link>
  );
}

function NotchedDivider({ dark = false }: { dark?: boolean }) {
  return (
    <div aria-hidden="true" className={`${styles.notchedDivider} ${dark ? styles.toDark : ""}`} />
  );
}

function CircuitBackdrop() {
  return (
    <div aria-hidden="true" className={styles.circuitBackdrop}>
      <svg preserveAspectRatio="xMidYMid slice" viewBox="0 0 1280 600">
        <g className={styles.circuitLines}>
          <path d="M0 210h104l40-40h182l54 54h136l36-36h185l43 43h196l43-43h111" />
          <path d="M0 430h136l44-44h212l32-32h160l38 38h178l46-46h250l42 42h132" />
          <path d="M260 0v124l42 42v106m0 62v88l40 40v138" />
          <path d="M640 0v116l-42 42v95m0 78v108l42 42v119" />
          <path d="M1018 0v116l-38 38v120m0 56v114l38 38v118" />
          <rect height="22" rx="4" width="22" x="291" y="273" />
          <rect height="18" rx="3" width="18" x="589" y="267" />
          <rect height="22" rx="4" width="22" x="969" y="277" />
          <circle cx="380" cy="224" r="6" />
          <circle cx="780" cy="231" r="6" />
          <circle cx="424" cy="354" r="6" />
          <circle cx="806" cy="346" r="6" />
        </g>
        <g className={styles.circuitPulses}>
          <circle cx="380" cy="224" r="4" />
          <circle cx="780" cy="231" r="4" />
          <circle cx="424" cy="354" r="4" />
          <circle cx="806" cy="346" r="4" />
        </g>
      </svg>
    </div>
  );
}

function TraceStage() {
  const steps = [
    ["Client verified", "passed"],
    ["Redirect URI matched", "passed"],
    ["PKCE challenge validated", "passed"],
    ["Scope admin:write denied", "failed"],
  ] as const;
  return (
    <div className={styles.traceStage}>
      <div className={styles.miniWindowBar}>
        <span>Authorization trace</span>
        <code>req_a72b9c</code>
      </div>
      <div className={styles.traceColumns}>
        <aside>
          <strong>Request</strong>
          <span>Overview</span>
          <span className={styles.traceNavActive}>Decision path</span>
          <span>Token claims</span>
          <span>Raw event</span>
        </aside>
        <div className={styles.traceList}>
          <p>Decision path</p>
          {steps.map(([label, status], index) => (
            <div className={styles.traceRow} key={label}>
              <i className={status === "failed" ? styles.traceFailed : ""} />
              <span>
                <strong>{label}</strong>
                <small>
                  {status === "failed" ? "Missing workspace assignment" : `${index + 2} ms`}
                </small>
              </span>
              {status === "passed" ? <Check aria-hidden="true" /> : <X aria-hidden="true" />}
            </div>
          ))}
        </div>
      </div>
      <div className={styles.traceAlert}>
        <ShieldCheck aria-hidden="true" />
        <span>
          <strong>Request denied safely</strong>
          Assign admin:write or remove it from the request.
        </span>
      </div>
    </div>
  );
}

function ManifestStage() {
  return (
    <div className={styles.manifestStage}>
      <div className={styles.miniWindowBar}>
        <span>authometry.yaml</span>
        <code>production</code>
      </div>
      <div className={styles.codeFrame}>
        <div className={styles.lineNumbers}>
          1<br />2<br />3<br />4<br />5<br />6<br />7<br />8<br />9<br />
          10
        </div>
        <pre>
          <code>
            <b>application</b>: dashboard{"\n"}
            {"  "}
            <b>redirectUris</b>:{"\n"}
            {"    "}- $&#123;DASHBOARD_CALLBACK&#125;{"\n"}
            {"  "}
            <b>scopes</b>:{"\n"}
            {"    "}- profile:read{"\n"}
            {"    "}- workspace:manage{"\n"}
            {"  "}
            <b>policy</b>: team-members{"\n"}
            {"  "}
            <b>claims</b>:{"\n"}
            {"    "}- email{"\n"}
            {"    "}- workspace_role
          </code>
        </pre>
      </div>
      <div className={styles.planBar}>
        <Terminal aria-hidden="true" />
        <span>
          <strong>Plan complete</strong>2 additions · 1 update · 0 destructive changes
        </span>
        <button type="button">Apply plan</button>
      </div>
    </div>
  );
}

function AgentStage() {
  return (
    <div className={styles.agentStage}>
      <div className={styles.miniWindowBar}>
        <span>Agent grant</span>
        <code>grant_01HT...</code>
      </div>
      <div className={styles.agentStageHero}>
        <span>
          <Bot aria-hidden="true" />
        </span>
        <div>
          <strong>Release assistant</strong>
          <small>Delegated by Jiayang · expires in 18 minutes</small>
        </div>
        <em>Constrained</em>
      </div>
      <div className={styles.permissionMatrix}>
        <div>
          <span>Resource</span>
          <span>Requested</span>
          <span>Granted</span>
        </div>
        <div>
          <strong>Deployments</strong>
          <code>write</code>
          <Check />
        </div>
        <div>
          <strong>Applications</strong>
          <code>read</code>
          <Check />
        </div>
        <div>
          <strong>Signing keys</strong>
          <code>rotate</code>
          <X />
        </div>
      </div>
      <div className={styles.delegationPath}>
        <span>Human actor</span>
        <i />
        <span>Agent identity</span>
        <i />
        <span>Resource</span>
      </div>
    </div>
  );
}

function CardVisual({ type }: { type: (typeof securityCards)[number]["visual"] }) {
  switch (type) {
    case "trace":
      return (
        <div className={`${styles.cardVisual} ${styles.traceVisual}`}>
          {["Client", "PKCE", "Policy", "Consent", "Token"].map((label, index) => (
            <span key={label} style={{ "--delay": `${index * 0.45}s` } as React.CSSProperties}>
              <i /> {label}
            </span>
          ))}
        </div>
      );
    case "session":
      return (
        <div className={`${styles.cardVisual} ${styles.sessionVisual}`}>
          <div>
            <span>Device</span>
            <strong>MacBook Pro</strong>
          </div>
          <div>
            <span>Browser</span>
            <strong>Chrome</strong>
          </div>
          <div>
            <span>Location</span>
            <strong>Shanghai, CN</strong>
          </div>
          <button type="button">Revoke session</button>
        </div>
      );
    case "policy":
      return (
        <div className={`${styles.cardVisual} ${styles.policyVisual}`}>
          <ShieldCheck />
          <span className={styles.policyRing} />
          <code>workspace.role == &quot;admin&quot;</code>
          <strong>Allowed</strong>
        </div>
      );
    case "social":
      return (
        <div className={`${styles.cardVisual} ${styles.socialVisual}`}>
          <span>
            <Github />
          </span>
          <i />
          <span>
            <AuthometryMark />
          </span>
          <i />
          <span>
            <Globe2 />
          </span>
        </div>
      );
    case "abuse":
      return (
        <div className={`${styles.cardVisual} ${styles.abuseVisual}`}>
          <ScanLine />
          <span className={styles.scanBeam} />
          <code>redirect_uri</code>
          <strong>Exact match</strong>
        </div>
      );
    case "keys":
      return (
        <div className={`${styles.cardVisual} ${styles.keysVisual}`}>
          <span>
            <KeyRound />
          </span>
          <i />
          <div>
            <code>kid_7fd2</code>
            <small>Rotates in 14 days</small>
          </div>
        </div>
      );
    case "mcp":
      return (
        <div className={`${styles.cardVisual} ${styles.mcpVisual}`}>
          <div>
            <Bot />
            <span>Authenticating...</span>
          </div>
          <i>
            <b />
          </i>
          <code>scope: mcp:tools</code>
        </div>
      );
    case "claims":
      return (
        <div className={`${styles.cardVisual} ${styles.claimsVisual}`}>
          <pre>{`{\n  "sub": "usr_42",\n  "role": "admin",\n  "aud": "dashboard"\n}`}</pre>
        </div>
      );
    case "device":
      return (
        <div className={`${styles.cardVisual} ${styles.deviceVisual}`}>
          <Fingerprint />
          <span>Enter code</span>
          <strong>HTQF–LXPK</strong>
        </div>
      );
  }
}

function WorkspaceVisual({ type }: { type: (typeof workspaceCards)[number]["visual"] }) {
  if (type === "roles") {
    return (
      <div className={`${styles.workspaceVisual} ${styles.rolesVisual}`}>
        {["Owner", "Administrator", "Viewer", "Developer"].map((role, index) => (
          <span className={index === 1 ? styles.roleActive : ""} key={role}>
            {role}
          </span>
        ))}
        <div>
          <i>JC</i>
          <i>AK</i>
          <i>MS</i>
          <i>+4</i>
        </div>
      </div>
    );
  }
  if (type === "environment") {
    return (
      <div className={`${styles.workspaceVisual} ${styles.environmentVisual}`}>
        <div>
          <i />
          <span>
            <strong>Production</strong>
            <small>auth.example.com</small>
          </span>
          <Check />
        </div>
        <div>
          <i />
          <span>
            <strong>Development</strong>
            <small>localhost:3000</small>
          </span>
        </div>
      </div>
    );
  }
  if (type === "invite") {
    return (
      <div className={`${styles.workspaceVisual} ${styles.inviteVisual}`}>
        <span>teammate@example.com</span>
        <button type="button">Send invitation</button>
        <i>
          <Check /> Invitation ready
        </i>
      </div>
    );
  }
  return (
    <div className={`${styles.workspaceVisual} ${styles.auditVisual}`}>
      {["Policy updated", "Member invited", "Key rotated"].map((event, index) => (
        <div key={event}>
          <i />
          <span>
            <strong>{event}</strong>
            <small>{index + 2} minutes ago</small>
          </span>
        </div>
      ))}
    </div>
  );
}

function FlowNode({ icon: Icon, label, meta }: { icon: LucideIcon; label: string; meta: string }) {
  return (
    <div className={styles.flowNode}>
      <Icon aria-hidden="true" />
      <strong>{label}</strong>
      <small>{meta}</small>
    </div>
  );
}
