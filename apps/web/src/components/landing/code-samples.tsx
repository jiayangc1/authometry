"use client";

import { useId, useState, type KeyboardEvent } from "react";
import styles from "./code-samples.module.css";
import { CopyButton } from "./copy-button";
import base from "./landing.module.css";
import { Container, SectionLabel, cx, highlightLine, type Language } from "./primitives";
import { StandardsSummary } from "./standards-summary";

interface Sample {
  id: string;
  label: string;
  file: string;
  library: string;
  language: Language;
  code: string;
}

const samples: Sample[] = [
  {
    id: "nextjs",
    label: "Next.js",
    file: "auth.ts",
    library: "Auth.js",
    language: "ts",
    code: `import NextAuth from "next-auth";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    {
      id: "authometry",
      name: "Authometry",
      type: "oidc",
      issuer: process.env.AUTHOMETRY_ISSUER,
      clientId: process.env.AUTHOMETRY_CLIENT_ID,
      clientSecret: process.env.AUTHOMETRY_CLIENT_SECRET,
      authorization: { params: { scope: "openid profile media:read" } },
      checks: ["pkce", "state", "nonce"],
    },
  ],
});`,
  },
  {
    id: "react",
    label: "React",
    file: "auth.tsx",
    library: "oidc-client-ts",
    language: "tsx",
    code: `import { UserManager } from "oidc-client-ts";

// A public spa client: no secret, Authorization Code with S256 PKCE
export const auth = new UserManager({
  authority: import.meta.env.VITE_AUTHOMETRY_ISSUER,
  client_id: import.meta.env.VITE_AUTHOMETRY_CLIENT_ID,
  redirect_uri: \`\${window.location.origin}/auth/callback\`,
  scope: "openid profile media:read",
});

export function SignInButton() {
  return <button onClick={() => auth.signinRedirect()}>Continue with Authometry</button>;
}

// On /auth/callback
const user = await auth.signinRedirectCallback();`,
  },
  {
    id: "node",
    label: "Node",
    file: "login.ts",
    library: "openid-client",
    language: "ts",
    code: `import * as client from "openid-client";

const config = await client.discovery(
  new URL(process.env.AUTHOMETRY_ISSUER!),
  process.env.AUTHOMETRY_CLIENT_ID!,
  undefined,
  client.ClientSecretBasic(process.env.AUTHOMETRY_CLIENT_SECRET!),
);

// Start sign-in; keep verifier and state in the user's session
const verifier = client.randomPKCECodeVerifier();
const state = client.randomState();
const url = client.buildAuthorizationUrl(config, {
  redirect_uri: "https://itsagram.com/auth/callback",
  scope: "openid profile media:read",
  code_challenge: await client.calculatePKCECodeChallenge(verifier),
  code_challenge_method: "S256",
  state,
});

// On the callback
const tokens = await client.authorizationCodeGrant(config, callbackUrl, {
  pkceCodeVerifier: verifier,
  expectedState: state,
});`,
  },
  {
    id: "go",
    label: "Go",
    file: "auth.go",
    library: "x/oauth2 + go-oidc",
    language: "go",
    code: `provider, err := oidc.NewProvider(ctx, os.Getenv("AUTHOMETRY_ISSUER"))
if err != nil {
	return err
}

config := oauth2.Config{
	ClientID:     os.Getenv("AUTHOMETRY_CLIENT_ID"),
	ClientSecret: os.Getenv("AUTHOMETRY_CLIENT_SECRET"),
	Endpoint:     provider.Endpoint(),
	RedirectURL:  "https://itsagram.com/auth/callback",
	Scopes:       []string{oidc.ScopeOpenID, "profile", "media:read"},
}

// Start sign-in
verifier := oauth2.GenerateVerifier()
url := config.AuthCodeURL(state, oauth2.S256ChallengeOption(verifier))

// On the callback
token, err := config.Exchange(ctx, code, oauth2.VerifierOption(verifier))`,
  },
  {
    id: "python",
    label: "Python",
    file: "app.py",
    library: "Authlib",
    language: "python",
    code: `oauth = OAuth(app)
oauth.register(
    "authometry",
    server_metadata_url=f"{os.environ['AUTHOMETRY_ISSUER']}/.well-known/openid-configuration",
    client_id=os.environ["AUTHOMETRY_CLIENT_ID"],
    client_secret=os.environ["AUTHOMETRY_CLIENT_SECRET"],
    client_kwargs={"scope": "openid profile media:read", "code_challenge_method": "S256"},
)

@app.route("/login")
def login():
    return oauth.authometry.authorize_redirect(url_for("callback", _external=True))

@app.route("/auth/callback")
def callback():
    token = oauth.authometry.authorize_access_token()
    session["user"] = token["userinfo"]
    return redirect("/")`,
  },
  {
    id: "curl",
    label: "curl",
    file: "terminal",
    library: "any HTTP client",
    language: "bash",
    code: `# Discover the endpoints
curl https://auth.itsagram.com/.well-known/openid-configuration

# Exchange the authorization code
curl -u "$AUTHOMETRY_CLIENT_ID:$AUTHOMETRY_CLIENT_SECRET" \\
  -d grant_type=authorization_code \\
  -d code="$CODE" \\
  -d redirect_uri=https://itsagram.com/auth/callback \\
  -d code_verifier="$VERIFIER" \\
  https://auth.itsagram.com/oauth/token

# Check a token from your API
curl -u "$AUTHOMETRY_CLIENT_ID:$AUTHOMETRY_CLIENT_SECRET" \\
  -d token="$ACCESS_TOKEN" \\
  https://auth.itsagram.com/oauth/introspect`,
  },
];

const provision = `npx authometry@latest apps create \\
  --name "Itsagram Web" --type web \\
  --redirect-uri https://itsagram.com/auth/callback \\
  --scope openid --scope profile --scope media:read \\
  --output-env .env.local`;

const agentPrompt = "Add Authometry OAuth to my app: https://authometry.ch3n.cc/SKILL.md";

export function CodeSamples() {
  const [active, setActive] = useState(0);
  const id = useId();
  const sample = samples[active]!;

  function onKeyDown(event: KeyboardEvent, index: number) {
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: samples.length - 1,
    };
    const target = moves[event.key];
    if (target === undefined) return;
    event.preventDefault();
    const next = (target + samples.length) % samples.length;
    setActive(next);
    document.getElementById(`${id}-tab-${next}`)?.focus();
  }

  return (
    <section aria-labelledby="developers-title" className={styles.section} id="developers">
      <Container className={styles.grid}>
        <div className={styles.copy}>
          <SectionLabel>integration</SectionLabel>
          <h2 className={base.h2} id="developers-title">
            Integrate with the library you already use.
          </h2>
          <p className={base.lead}>
            Keep your OpenID Connect library and point it at your issuer. Every request it makes
            shows up as a trace — there is no Authometry SDK to learn.
          </p>

          <ol className={styles.steps}>
            <li>
              <p className={styles.stepTitle}>
                <span>1</span>Provision the client from your repository
              </p>
              <div className={styles.command}>
                <pre tabIndex={0}>
                  <code>
                    {provision.split("\n").map((line, index) => (
                      <span key={index}>
                        {index === 0 && <span className={styles.prompt}>$ </span>}
                        {line}
                        {"\n"}
                      </span>
                    ))}
                  </code>
                </pre>
                <CopyButton label="Copy provisioning command" value={provision} />
              </div>
              <p className={styles.stepNote}>
                Writes <code>AUTHOMETRY_ISSUER</code>, <code>AUTHOMETRY_CLIENT_ID</code>, and a
                one-time <code>AUTHOMETRY_CLIENT_SECRET</code> to <code>.env.local</code>.
              </p>
            </li>
            <li>
              <p className={styles.stepTitle}>
                <span>2</span>Connect the library you already use
              </p>
            </li>
          </ol>

          <div className={styles.agent}>
            <p>Or hand the whole integration to a coding agent</p>
            <div className={styles.agentPrompt}>
              <code>{agentPrompt}</code>
              <CopyButton label="Copy agent prompt" value={agentPrompt} />
            </div>
          </div>
        </div>

        <div className={cx(base.darkWindow, styles.window)}>
          <div aria-label="Language" className={styles.tabs} role="tablist">
            {samples.map((item, index) => (
              <button
                aria-controls={`${id}-panel`}
                aria-selected={index === active}
                className={styles.tab}
                id={`${id}-tab-${index}`}
                key={item.id}
                onClick={() => setActive(index)}
                onKeyDown={(event) => onKeyDown(event, index)}
                role="tab"
                tabIndex={index === active ? 0 : -1}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className={styles.fileBar}>
            <span>
              <code>{sample.file}</code>
              <span className={styles.library}>{sample.library}</span>
            </span>
            <CopyButton label={`Copy ${sample.label} example`} tone="dark" value={sample.code} />
          </div>
          <div
            aria-labelledby={`${id}-tab-${active}`}
            className={styles.code}
            id={`${id}-panel`}
            role="tabpanel"
            tabIndex={0}
          >
            <pre key={sample.id}>
              <code>
                {sample.code.split("\n").map((line, index) => (
                  <span className={styles.line} key={index}>
                    <span aria-hidden="true" className={styles.number}>
                      {index + 1}
                    </span>
                    <span>{highlightLine(line, sample.language)}</span>
                    {"\n"}
                  </span>
                ))}
              </code>
            </pre>
          </div>
          <p className={styles.footnote}>
            Issuer, client ID, and secret come from the provisioning step. Library APIs shown as
            documented by each project.
          </p>
        </div>
      </Container>
      <Container>
        <StandardsSummary />
      </Container>
    </section>
  );
}
