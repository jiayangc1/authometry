"use client";

import {
  Bot,
  Check,
  KeyRound,
  MonitorSmartphone,
  Plug,
  Server,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import { useId, useState } from "react";
import styles from "./agents.module.css";
import { scenario } from "./demo-data";
import base from "./landing.module.css";
import { Container, DemoBadge, SectionLabel, cx, highlightLine } from "./primitives";

const actors: Array<{ icon: LucideIcon; name: string; grant: string; detail: string }> = [
  {
    icon: User,
    name: "People",
    grant: "Authorization Code + PKCE",
    detail: "Sessions, policies, and consent",
  },
  {
    icon: Server,
    name: "Services",
    grant: "Client Credentials",
    detail: "The application is the subject",
  },
  {
    icon: MonitorSmartphone,
    name: "Devices and CLIs",
    grant: "Device Authorization",
    detail: "A user code approved elsewhere",
  },
  {
    icon: Plug,
    name: "MCP clients",
    grant: "Code + PKCE + resource",
    detail: "Admin-approved mcp:read and mcp:write",
  },
  {
    icon: Bot,
    name: "Agents",
    grant: "Signed PAR + DPoP",
    detail: "Delegated, task-bound, sender-constrained",
  },
];

const cases = {
  within: {
    label: "Within its registration",
    requested: ["media:read", "media:write"],
    over: [] as string[],
  },
  beyond: {
    label: "Beyond its registration",
    requested: ["media:read", "media:write", "media:delete"],
    over: ["media:delete"],
  },
} as const;

type CaseId = keyof typeof cases;

const tokenClaims = `{
  "sub": "${scenario.user.id.slice(0, 8)}…",
  "act": { "sub": "caption-assistant", "operator": "bellaire-media" },
  "aud": "https://api.itsagram.com",
  "scope": "media:read media:write",
  "authometry_grant_id": "0f9b…",
  "cnf": { "jkt": "NzbLsXh8uDCcd…" }
}`;

export function Agents() {
  const [active, setActive] = useState<CaseId>("within");
  const id = useId();
  const current = cases[active];

  return (
    <section aria-labelledby="agents-title" className={styles.section} id="agents">
      <Container>
        <div className={styles.head}>
          <SectionLabel>agents</SectionLabel>
          <h2 className={cx(base.h2, styles.title)} id="agents-title">
            Identity isn’t just human anymore.
          </h2>
          <p className={base.lead}>
            Agents, services, CLIs, and MCP clients act on someone’s behalf. Authometry gives each a
            registered identity, bounds what a task may do, and records who acted for whom.
          </p>
        </div>

        <DemoBadge className={base.demoBadgeAbove} />
        <div className={styles.layout}>
          <div className={styles.routes}>
            <ul className={styles.actors}>
              {actors.map((actor) => (
                <li data-agent={actor.name === "Agents"} key={actor.name}>
                  <span className={styles.actorIcon}>
                    <actor.icon aria-hidden="true" />
                  </span>
                  <span className={styles.actorText}>
                    <strong>{actor.name}</strong>
                    <span>{actor.detail}</span>
                  </span>
                  <code>{actor.grant}</code>
                </li>
              ))}
            </ul>
            <div aria-hidden="true" className={styles.funnel}>
              <span />
            </div>
            <p className={styles.core}>
              <KeyRound aria-hidden="true" />
              Scoped, audited authorization
            </p>
            <p className={styles.kill}>
              Disabling an agent disables its OAuth client and revokes every active grant.
            </p>
          </div>

          <div className={cx(base.window, styles.request)}>
            <div className={styles.requestBar}>
              <p>
                <Bot aria-hidden="true" />
                <strong>caption-assistant</strong>
                <span>operated by bellaire-media</span>
              </p>
              <div aria-label="Agent request" className={styles.toggle} role="tablist">
                {(Object.keys(cases) as CaseId[]).map((key) => (
                  <button
                    aria-controls={`${id}-panel`}
                    aria-selected={key === active}
                    id={`${id}-${key}`}
                    key={key}
                    onClick={() => setActive(key)}
                    onKeyDown={(event) => {
                      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                      event.preventDefault();
                      const next: CaseId = key === "within" ? "beyond" : "within";
                      setActive(next);
                      document.getElementById(`${id}-${next}`)?.focus();
                    }}
                    role="tab"
                    tabIndex={key === active ? 0 : -1}
                    type="button"
                  >
                    {cases[key].label}
                  </button>
                ))}
              </div>
            </div>

            <div
              aria-labelledby={`${id}-${active}`}
              className={styles.requestBody}
              id={`${id}-panel`}
              key={active}
              role="tabpanel"
            >
              <dl className={styles.registration}>
                <div>
                  <dt>Registered capabilities</dt>
                  <dd>
                    <span className={base.scope}>media:read</span>
                    <span className={base.scope}>media:write</span>
                  </dd>
                </div>
                <div>
                  <dt>Resource</dt>
                  <dd>
                    <code>https://api.itsagram.com</code>
                  </dd>
                </div>
                <div>
                  <dt>Task</dt>
                  <dd>Add alt text to 42 photos in the Autumn issue</dd>
                </div>
                <div>
                  <dt>Requested</dt>
                  <dd>
                    {current.requested.map((scope) => (
                      <span
                        className={cx(
                          base.scope,
                          (current.over as readonly string[]).includes(scope) && styles.overScope,
                        )}
                        key={scope}
                      >
                        {scope}
                      </span>
                    ))}
                  </dd>
                </div>
              </dl>

              <p className={styles.wireLine}>
                <span>POST</span> /oauth/par <em>Authorization: AgentAssertion eyJhbGciOi…</em>
              </p>

              {active === "within" ? (
                <>
                  <ol className={styles.checks}>
                    {[
                      ["Agent identified", "caption-assistant"],
                      ["Agent signature verified", "Single-use assertion accepted"],
                      ["Task authority bounded", "Fits the agent registration"],
                      ["User authenticated", scenario.user.email],
                      ["Delegation grant created", "Approved by Maya, 15 min lifetime"],
                    ].map(([name, detail]) => (
                      <li key={name}>
                        <Check aria-hidden="true" />
                        <strong>{name}</strong>
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ol>
                  <div className={styles.claims}>
                    <p>Access token, bound to the agent’s key</p>
                    <pre tabIndex={0}>
                      <code>
                        {tokenClaims.split("\n").map((line, index) => (
                          <span key={index}>
                            {highlightLine(line, "json")}
                            {"\n"}
                          </span>
                        ))}
                      </code>
                    </pre>
                  </div>
                </>
              ) : (
                <div className={styles.rejected}>
                  <p className={styles.status}>
                    <X aria-hidden="true" />
                    <span>400</span> invalid_scope
                  </p>
                  <p className={styles.message}>
                    The request exceeds the agent’s registered capabilities.
                  </p>
                  <p className={styles.after}>
                    Rejected before any user is asked. No request URI, grant, or token exists for
                    this task.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
