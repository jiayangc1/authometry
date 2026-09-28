"use client";

import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { scenario } from "./demo-data";
import styles from "./flow-explorer.module.css";
import base from "./landing.module.css";
import { Container, SectionLabel, cx, highlightLine, type Language } from "./primitives";

interface Message {
  direction: string;
  line: string;
  headers?: Array<[string, string]>;
  params?: Array<[string, string]>;
  body?: { language: Language; text: string };
}

interface Stage {
  id: string;
  name: string;
  verb: string;
  summary: string;
  messages: Message[];
  checks: string[];
  recorded?: string[];
}

const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

const stages: Stage[] = [
  {
    id: "discover",
    name: "Discover",
    verb: "GET",
    summary: "The application loads the issuer’s metadata instead of hard-coding endpoints.",
    messages: [
      {
        direction: "itsagram-web → Authometry",
        line: "GET /.well-known/openid-configuration",
      },
      {
        direction: "200 OK",
        line: "application/json",
        body: {
          language: "json",
          text: `{
  "issuer": "${scenario.issuer}",
  "authorization_endpoint": "${scenario.issuer}/oauth/authorize",
  "token_endpoint": "${scenario.issuer}/oauth/token",
  "jwks_uri": "${scenario.issuer}/.well-known/jwks.json",
  "response_types_supported": ["code"],
  "code_challenge_methods_supported": ["S256"]
}`,
        },
      },
    ],
    checks: [
      "Every endpoint derives from the environment’s stored issuer.",
      "Only the code response type is advertised.",
      "S256 is the only PKCE method.",
    ],
  },
  {
    id: "authorize",
    name: "Authorize",
    verb: "GET",
    summary: "The browser is sent to the authorization endpoint with a PKCE challenge.",
    messages: [
      {
        direction: "Browser → Authometry",
        line: "GET /oauth/authorize",
        params: [
          ["response_type", "code"],
          ["client_id", scenario.application.clientId],
          ["redirect_uri", scenario.application.redirectUri],
          ["scope", scenario.scopes.join(" ")],
          ["state", "01K8F7Q4GZ3M9V2XWQH6"],
          ["nonce", "n-0S6_WzA2Mj"],
          ["code_challenge", challenge],
          ["code_challenge_method", "S256"],
        ],
      },
    ],
    checks: [
      "The client exists and is active.",
      "The redirect URI exactly matches a registered value.",
      "Every requested scope is assigned to the client.",
      "An S256 challenge is present.",
    ],
    recorded: [
      "Request received",
      "Client verified",
      "Redirect URI matched",
      "PKCE challenge validated",
    ],
  },
  {
    id: "authenticate",
    name: "Authenticate",
    verb: "SESSION",
    summary: "An existing session is reused unless the request asks for a fresh login.",
    messages: [
      {
        direction: "Session lookup",
        line: "workspace: bellaire-media",
        params: [
          ["session", "valid, 7 day lifetime"],
          ["user", scenario.user.email],
          ["status", "active"],
          ["prompt", "not set"],
          ["max_age", "not set"],
        ],
      },
    ],
    checks: [
      "prompt=login or select_account forces a new sign-in.",
      "max_age compares against the session’s authentication time.",
      "Disabled users cannot complete authorization.",
    ],
    recorded: ["User authenticated"],
  },
  {
    id: "policy",
    name: "Policy",
    verb: "EVAL",
    summary: "Every enabled policy assigned to the application is evaluated against the request.",
    messages: [
      {
        direction: "Evaluation context",
        line: `policy ${scenario.policy.name}`,
        body: {
          language: "json",
          text: `{
  "environment": "production",
  "user": {
    "email": "${scenario.user.email}",
    "groups": ["bellaire-media", "editors"]
  },
  "application": { "slug": "itsagram-web", "type": "web" },
  "request": { "scopes": ["openid", "profile", "media:read"] }
}`,
        },
      },
    ],
    checks: [
      `user.groups contains "bellaire-media" — matched.`,
      "All conditions in a policy must match.",
      "A failing policy denies with its configured code and message.",
    ],
    recorded: [`Policy: ${scenario.policy.displayName} (on denial)`],
  },
  {
    id: "consent",
    name: "Consent",
    verb: "GRANT",
    summary: "A stored grant for the same scopes satisfies consent without a prompt.",
    messages: [
      {
        direction: "Consent record",
        line: "itsagram-web for maya@bellaire.media",
        params: [
          ["requested", scenario.scopes.join(" ")],
          ["granted", scenario.scopes.join(" ")],
          ["source", "stored grant"],
          ["screen", "not shown"],
        ],
      },
    ],
    checks: [
      "Application and instance settings decide whether consent is required.",
      "prompt=consent always asks again.",
      "prompt=none returns an error instead of showing a screen.",
    ],
    recorded: ["Consent evaluated"],
  },
  {
    id: "callback",
    name: "Callback",
    verb: "302",
    summary: "A single-use code returns to the exact registered redirect URI with the state.",
    messages: [
      {
        direction: "Authometry → Browser",
        line: "HTTP/1.1 302 Found",
        headers: [
          [
            "Location",
            `${scenario.application.redirectUri}?code=SplxlOBeZQQYbYS6WxSbIA&state=01K8F7Q4GZ3M9V2XWQH6`,
          ],
        ],
      },
    ],
    checks: [
      "The code is single-use and expires after 60 seconds.",
      "It is bound to the client, redirect URI, user, scopes, and challenge.",
      "Only its HMAC digest is stored.",
    ],
    recorded: ["Authorization code issued", "Redirect completed"],
  },
  {
    id: "exchange",
    name: "Exchange",
    verb: "POST",
    summary: "The application’s backend exchanges the code and proves it holds the verifier.",
    messages: [
      {
        direction: "itsagram-web → Authometry",
        line: "POST /oauth/token",
        headers: [
          ["Authorization", "Basic aXRzYWdyYW0td2ViOi…"],
          ["Content-Type", "application/x-www-form-urlencoded"],
        ],
        params: [
          ["grant_type", "authorization_code"],
          ["code", "SplxlOBeZQQYbYS6WxSbIA"],
          ["redirect_uri", scenario.application.redirectUri],
          ["code_verifier", verifier],
        ],
      },
      {
        direction: "200 OK",
        line: "application/json",
        body: {
          language: "json",
          text: `{
  "access_token": "eyJhbGciOiJSUzI1NiIsImtpZCI6…",
  "token_type": "Bearer",
  "expires_in": 900,
  "scope": "openid profile media:read",
  "id_token": "eyJhbGciOiJSUzI1NiIsImtpZCI6…"
}`,
        },
      },
    ],
    checks: [
      "The client authenticates with its registered method.",
      "SHA-256 of the verifier must equal the stored challenge.",
      "A refresh token is issued only when offline_access was granted.",
    ],
    recorded: ["Request received", "Client authenticated", "Token issued"],
  },
  {
    id: "api",
    name: "Call API",
    verb: "BEARER",
    summary: "The API verifies the signed token against the issuer’s published keys.",
    messages: [
      {
        direction: "itsagram-web → api.itsagram.com",
        line: "GET /v1/media",
        headers: [["Authorization", "Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6…"]],
      },
      {
        direction: "Access token claims",
        line: `RS256, kid ${scenario.signingKey}`,
        body: {
          language: "json",
          text: `{
  "iss": "${scenario.issuer}",
  "sub": "${scenario.user.id}",
  "aud": "itsagram-web",
  "client_id": "itsagram-web",
  "scope": "openid profile media:read",
  "groups": ["bellaire-media", "editors"],
  "exp": 1790613428
}`,
        },
      },
    ],
    checks: [
      "Verify the signature with the JWKS key matching kid.",
      "Validate iss, aud, and exp before trusting any claim.",
      "Introspect when immediate revocation matters.",
    ],
  },
];

export function FlowExplorer() {
  const [index, setIndex] = useState(1);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const id = useId();
  const stage = stages[index]!;

  function go(next: number, focus = false) {
    const target = (next + stages.length) % stages.length;
    setIndex(target);
    if (focus) tabs.current[target]?.focus();
  }

  function onKeyDown(event: KeyboardEvent) {
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: stages.length - 1,
    };
    const target = moves[event.key];
    if (target === undefined) return;
    event.preventDefault();
    go(target, true);
  }

  return (
    <section aria-labelledby="flow-title" className={styles.section} id="flow">
      <Container>
        <div className={styles.head}>
          <div>
            <SectionLabel>protocol.flow</SectionLabel>
            <h2 className={cx(base.h2, styles.title)} id="flow-title">
              Follow authentication from request to token.
            </h2>
          </div>
          <p className={base.lead}>
            Authorization Code with PKCE, as it actually crosses the wire — and what Authometry
            checks at each hop before anything is issued.
          </p>
        </div>

        <div className={styles.explorer}>
          <div
            aria-label="Authorization Code flow stages"
            className={styles.rail}
            role="tablist"
            style={{ "--progress": index / (stages.length - 1) } as React.CSSProperties}
          >
            {stages.map((item, position) => (
              <button
                aria-controls={`${id}-panel`}
                aria-selected={position === index}
                className={styles.stop}
                data-passed={position < index}
                id={`${id}-tab-${item.id}`}
                key={item.id}
                onClick={() => go(position)}
                onKeyDown={onKeyDown}
                ref={(element) => {
                  tabs.current[position] = element;
                }}
                role="tab"
                tabIndex={position === index ? 0 : -1}
                type="button"
              >
                <span aria-hidden="true" className={styles.stopDot} />
                <span className={styles.stopNumber}>{String(position + 1).padStart(2, "0")}</span>
                <span className={styles.stopName}>{item.name}</span>
                <span className={styles.stopVerb}>{item.verb}</span>
              </button>
            ))}
          </div>

          <div
            aria-labelledby={`${id}-tab-${stage.id}`}
            className={styles.panel}
            id={`${id}-panel`}
            role="tabpanel"
          >
            <div className={styles.panelHead}>
              <p className={styles.stageCount}>
                {String(index + 1).padStart(2, "0")} / {String(stages.length).padStart(2, "0")}
              </p>
              <h3 className={base.h3}>{stage.name}</h3>
              <p className={styles.summary}>{stage.summary}</p>
              <div className={styles.pager}>
                <button aria-label="Previous stage" onClick={() => go(index - 1)} type="button">
                  <ChevronLeft aria-hidden="true" />
                </button>
                <button aria-label="Next stage" onClick={() => go(index + 1)} type="button">
                  <ChevronRight aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className={styles.panelBody} key={stage.id}>
              <div className={styles.wire}>
                {stage.messages.map((message) => (
                  <div className={styles.message} key={message.direction + message.line}>
                    <p className={styles.direction}>{message.direction}</p>
                    <p className={styles.line}>{message.line}</p>
                    {message.headers && (
                      <dl className={styles.pairs}>
                        {message.headers.map(([key, value]) => (
                          <div key={key}>
                            <dt>{key}:</dt>
                            <dd>{value}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    {message.params && (
                      <dl className={cx(styles.pairs, styles.params)}>
                        {message.params.map(([key, value]) => (
                          <div key={key}>
                            <dt>{key}</dt>
                            <dd>{value}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    {message.body && (
                      <pre className={styles.body} tabIndex={0}>
                        <code>
                          {message.body.text.split("\n").map((line, number) => (
                            <span className={styles.codeLine} key={number}>
                              {highlightLine(line, message.body!.language)}
                              {"\n"}
                            </span>
                          ))}
                        </code>
                      </pre>
                    )}
                  </div>
                ))}
              </div>
              <div className={styles.checks}>
                <p className={styles.checksTitle}>Authometry checks</p>
                <ul>
                  {stage.checks.map((check) => (
                    <li key={check}>
                      <Check aria-hidden="true" />
                      {check}
                    </li>
                  ))}
                </ul>
                {stage.recorded && (
                  <div className={styles.recorded}>
                    <p>Recorded in the trace as</p>
                    <ul>
                      {stage.recorded.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
