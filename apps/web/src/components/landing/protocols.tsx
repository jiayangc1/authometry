import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import base from "./landing.module.css";
import { Container, SectionLabel, cx } from "./primitives";
import styles from "./protocols.module.css";

interface Capability {
  name: string;
  spec: string;
  endpoint?: string;
  note: string;
}

const groups: Array<{ title: string; items: Capability[] }> = [
  {
    title: "OAuth 2.0 grants",
    items: [
      {
        name: "Authorization Code",
        spec: "RFC 6749 §4.1",
        endpoint: "/oauth/authorize",
        note: "The only advertised response type",
      },
      { name: "PKCE", spec: "RFC 7636", note: "S256 only; plain is rejected" },
      {
        name: "Refresh Token",
        spec: "RFC 6749 §6",
        endpoint: "/oauth/token",
        note: "Rotates on every use; reuse revokes the family",
      },
      {
        name: "Client Credentials",
        spec: "RFC 6749 §4.4",
        endpoint: "/oauth/token",
        note: "Machine applications act as themselves",
      },
      {
        name: "Device Authorization",
        spec: "RFC 8628",
        endpoint: "/oauth/device/authorization",
        note: "600 s codes, 5 s polling interval",
      },
      {
        name: "Token Exchange",
        spec: "RFC 8693",
        endpoint: "/oauth/token",
        note: "One-level agent delegation with reduced scope",
      },
    ],
  },
  {
    title: "OpenID Connect",
    items: [
      {
        name: "Discovery",
        spec: "OIDC Discovery 1.0",
        endpoint: "/.well-known/openid-configuration",
        note: "Endpoints derive from the environment issuer",
      },
      {
        name: "JWKS",
        spec: "RFC 7517",
        endpoint: "/.well-known/jwks.json",
        note: "Active and retiring RS256 keys by kid",
      },
      { name: "ID Token", spec: "OIDC Core 1.0", note: "RS256, nonce echoed when sent" },
      {
        name: "UserInfo",
        spec: "OIDC Core §5.3",
        endpoint: "/oauth/userinfo",
        note: "Claims gated by the granted scopes",
      },
      {
        name: "RP-Initiated Logout",
        spec: "OIDC RP-Initiated Logout",
        endpoint: "/oauth/logout",
        note: "Redirects only to a registered URI",
      },
    ],
  },
  {
    title: "Token lifecycle",
    items: [
      {
        name: "Revocation",
        spec: "RFC 7009",
        endpoint: "/oauth/revoke",
        note: "Non-enumerating; refresh revokes the family",
      },
      {
        name: "Introspection",
        spec: "RFC 7662",
        endpoint: "/oauth/introspect",
        note: "Only for the authenticated client’s tokens",
      },
      {
        name: "private_key_jwt",
        spec: "RFC 7523",
        note: "Alongside client_secret_basic, _post, and none",
      },
    ],
  },
  {
    title: "Agents and MCP",
    items: [
      {
        name: "Pushed Authorization Requests",
        spec: "RFC 9126",
        endpoint: "/oauth/par",
        note: "Signed requests from registered agents",
      },
      { name: "DPoP", spec: "RFC 9449", note: "Agent tokens bound to a key with cnf.jkt" },
      {
        name: "Resource Indicators",
        spec: "RFC 8707",
        note: "Tokens scoped to the target resource",
      },
      {
        name: "Protected Resource Metadata",
        spec: "RFC 9728",
        endpoint: "/mcp",
        note: "Published by Authometry’s MCP server",
      },
      {
        name: "Dynamic Client Registration",
        spec: "RFC 7591",
        note: "Public MCP clients only",
      },
    ],
  },
];

const unsupported = [
  "Implicit",
  "Hybrid",
  "Resource owner password",
  "plain PKCE",
  "JAR",
  "JARM",
  "CIBA",
];

export function Protocols() {
  return (
    <section aria-labelledby="protocols-title" className={styles.section} id="standards">
      <Container className={styles.grid}>
        <div className={styles.aside}>
          <SectionLabel>standards</SectionLabel>
          <h2 className={cx(base.h2, styles.title)} id="protocols-title">
            Built on the standards.
          </h2>
          <p className={base.body}>
            OAuth 2.0 and OpenID Connect, implemented plainly. Any compliant client library works;
            there is no proprietary protocol to adopt or migrate away from.
          </p>
          <div className={styles.unsupported}>
            <p>Deliberately not supported</p>
            <ul>
              {unsupported.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <p className={styles.note}>
            Authometry ships conformance-oriented tests. It is not OpenID Certified; certification
            requires a separate submission to the OpenID Foundation.
          </p>
          <Link className={base.textLink} href="/docs/oauth/pkce">
            Protocol documentation
            <ArrowUpRight aria-hidden="true" />
          </Link>
        </div>

        <div className={styles.table}>
          {groups.map((group) => (
            <div className={styles.group} key={group.title}>
              <h3>{group.title}</h3>
              <ul>
                {group.items.map((item) => (
                  <li className={styles.row} key={item.name}>
                    <span className={styles.name}>{item.name}</span>
                    <span className={styles.spec}>{item.spec}</span>
                    <span className={styles.endpoint}>{item.endpoint ?? ""}</span>
                    <span className={styles.note2}>{item.note}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
