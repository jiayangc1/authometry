export interface DocumentationSection {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  code?: string;
  note?: string;
}

export interface DocumentationPage {
  slug: string;
  group: "Start" | "OAuth and OIDC" | "Operate";
  title: string;
  summary: string;
  sections: DocumentationSection[];
}

export const documentationPages: DocumentationPage[] = [
  {
    slug: "getting-started",
    group: "Start",
    title: "Getting started",
    summary: "Provision an Authometry Cloud OAuth client from your application with the CLI.",
    sections: [
      {
        title: "Install the CLI",
        paragraphs: [
          "Authometry Cloud is the default server and production is the default environment. Run the current CLI without adding it to your application's runtime dependencies.",
        ],
        code: "npx authometry@latest --help",
      },
      {
        title: "Authorize the CLI",
        paragraphs: [
          "Create a token under Settings → API tokens and expose it only to the current shell or agent process. Application provisioning needs applications:read and applications:write.",
        ],
        code: "export AUTHOMETRY_TOKEN=amt_your_token",
        note: "The management token belongs to the provisioning process. Never put it in application source or runtime environment files.",
      },
      {
        title: "Provision the application",
        paragraphs: [
          "Run the CLI from the application repository. It creates the SaaS client and writes the issuer, application ID, client ID, and one-time client secret directly to an ignored environment file. Public clients omit the secret.",
        ],
        code: 'npx authometry@latest apps create \\\n  --name "Customer Portal" \\\n  --type web \\\n  --redirect-uri http://localhost:3000/auth/callback \\\n  --post-logout-redirect-uri http://localhost:3000/ \\\n  --scope openid --scope profile --scope email \\\n  --output-env .env.local --json',
      },
      {
        title: "Give the integration to an agent",
        bullets: [
          "Prompt the agent with: Add Authometry OAuth to my app: https://authometry.ch3n.cc/SKILL.md",
          "The agent inspects the repository, runs the provisioning command, implements the OIDC flow, and verifies the result.",
          "Pass --server only when intentionally targeting a self-hosted installation.",
        ],
      },
    ],
  },
  {
    slug: "applications",
    group: "Start",
    title: "Applications",
    summary: "Choose a client type, register exact URLs, assign grants, and rotate credentials.",
    sections: [
      {
        title: "Choose a type",
        bullets: [
          "Web applications run a confidential backend and normally use client_secret_basic.",
          "SPAs and native applications are public clients. They do not receive a secret and must use S256 PKCE.",
          "Machine applications use Client Credentials and represent the application rather than a user.",
          "Device applications exchange a user-approved device code from an input-constrained client.",
        ],
      },
      {
        title: "Configure URLs",
        paragraphs: [
          "Redirect and post-logout URLs are allowlists, not patterns. Scheme, host, port, path, query, and trailing slash must match the request. Register separate development and production values explicitly.",
        ],
        note: "http://localhost:3000/callback and http://127.0.0.1:3000/callback are different URLs.",
      },
      {
        title: "Grant access",
        paragraphs: [
          "Enable only grants the client actually uses and assign only its required scopes. Requesting an unassigned scope stops authorization with invalid_scope and records the expected assignment in the trace.",
        ],
      },
      {
        title: "Rotate a secret",
        bullets: [
          "Create a second named credential and copy the raw value once.",
          "Deploy it to every client instance and confirm successful use.",
          "Revoke the old credential after the rollout completes.",
        ],
      },
    ],
  },
  {
    slug: "oauth/pkce",
    group: "OAuth and OIDC",
    title: "Authorization Code with PKCE",
    summary:
      "Bind an authorization request to a one-time verifier using the S256 challenge method.",
    sections: [
      {
        title: "Create the challenge",
        paragraphs: [
          "Generate a high-entropy verifier for every authorization attempt. Hash its ASCII value with SHA-256 and base64url-encode the result without padding. Keep the verifier in the client until the callback.",
        ],
        code: 'import { createHash, randomBytes } from "node:crypto";\n\nconst verifier = randomBytes(48).toString("base64url");\nconst challenge = createHash("sha256")\n  .update(verifier)\n  .digest("base64url");',
      },
      {
        title: "Authorize",
        code: "GET /oauth/authorize?response_type=code\n  &client_id=CLIENT_ID\n  &redirect_uri=https%3A%2F%2Fclient.example%2Fcallback\n  &scope=openid%20profile\n  &state=RANDOM_STATE\n  &nonce=RANDOM_NONCE\n  &code_challenge=CHALLENGE\n  &code_challenge_method=S256",
        paragraphs: [
          "Store state with the verifier and compare it at the callback. OIDC clients should also send nonce and compare it with the ID-token claim.",
        ],
      },
      {
        title: "Exchange once",
        code: 'curl -u "$CLIENT_ID:$CLIENT_SECRET" \\\n  -H "content-type: application/x-www-form-urlencoded" \\\n  -d grant_type=authorization_code \\\n  -d code="$CODE" \\\n  -d redirect_uri=https://client.example/callback \\\n  -d code_verifier="$VERIFIER" \\\n  https://authometry.ch3n.cc/oauth/token',
        note: "The code is short-lived and single-use. A verifier mismatch or replay returns invalid_grant.",
      },
    ],
  },
  {
    slug: "oauth/redirect-uris",
    group: "OAuth and OIDC",
    title: "Redirect URI matching",
    summary: "Understand exact callback matching and fix redirect_uri_mismatch safely.",
    sections: [
      {
        title: "The complete value must match",
        paragraphs: [
          "Authometry looks up the client before using a redirect target, then compares redirect_uri with its registered values. It does not normalize hosts, remove ports, add slashes, resolve relative paths, or accept wildcard subdomains.",
        ],
        code: "Registered: https://client.example/callback\nAccepted:   https://client.example/callback\nRejected:   https://client.example/callback/\nRejected:   http://client.example/callback\nRejected:   https://www.client.example/callback",
      },
      {
        title: "Correct a mismatch",
        bullets: [
          "Copy the observed redirect_uri from the denied authorization trace.",
          "Compare it with the application's registered values, including encoded query text.",
          "Fix the client when the observed value is unintended; register it only when it is a trusted callback.",
          "Retry with a fresh state, nonce, verifier, and authorization request.",
        ],
        note: "Authometry does not redirect an invalid request to an untrusted URI. The error is rendered at the authorization server.",
      },
    ],
  },
  {
    slug: "oauth/token-endpoint",
    group: "OAuth and OIDC",
    title: "Token endpoint",
    summary:
      "Authenticate the client and exchange each supported grant using form-encoded requests.",
    sections: [
      {
        title: "Client authentication",
        paragraphs: [
          "Confidential clients use their configured client_secret_basic or client_secret_post method. Public clients send client_id and no secret. Mixing methods or sending a secret for a public client returns invalid_client.",
        ],
      },
      {
        title: "Supported grants",
        bullets: [
          "authorization_code consumes a code and verifies its redirect URI and PKCE verifier.",
          "refresh_token rotates an active token and can narrow its original scope set.",
          "client_credentials issues an application token for assigned non-OpenID scopes.",
          "urn:ietf:params:oauth:grant-type:device_code consumes an approved device code.",
        ],
      },
      {
        title: "Handle a token response",
        code: '{\n  "access_token": "eyJ...",\n  "token_type": "Bearer",\n  "expires_in": 900,\n  "scope": "openid profile",\n  "id_token": "eyJ...",\n  "refresh_token": "opaque..."\n}',
        paragraphs: [
          "Validate ID tokens before using claims. Replace a refresh token atomically whenever a response contains a rotated value; reuse of a consumed token revokes its family.",
        ],
      },
      {
        title: "Correct an error",
        bullets: [
          "invalid_client: use the registered client and its configured authentication method.",
          "invalid_grant: start a new flow; the code, verifier, redirect URI, refresh token, or device code is invalid.",
          "invalid_scope: request only assigned scopes or narrow the original refresh scope.",
          "unsupported_grant_type: enable and send one of the documented grant identifiers.",
        ],
      },
    ],
  },
  {
    slug: "oauth/device",
    group: "OAuth and OIDC",
    title: "Device Authorization",
    summary:
      "Authorize a device on a second screen without placing user credentials on the device.",
    sections: [
      {
        title: "Request codes",
        code: 'curl -u "$CLIENT_ID:$CLIENT_SECRET" \\\n  -H "content-type: application/x-www-form-urlencoded" \\\n  -d "scope=openid profile" \\\n  https://authometry.ch3n.cc/oauth/device/authorization',
        paragraphs: [
          "Show the returned user_code and verification_uri, or present verification_uri_complete as a QR code. Codes expire after ten minutes.",
        ],
      },
      {
        title: "Poll responsibly",
        paragraphs: [
          "Poll /oauth/token with the device grant and device_code. Wait at least the returned interval between requests. Continue on authorization_pending, slow down when instructed, and stop on approval, denial, or expiry.",
        ],
        code: "grant_type=urn:ietf:params:oauth:grant-type:device_code&device_code=DEVICE_CODE",
      },
      {
        title: "Protect the user",
        bullets: [
          "Display the application name and requested scopes before approval.",
          "Never ask the user to enter their Authometry password on the device.",
          "Discard the device code after success, denial, or expiry.",
        ],
      },
    ],
  },
  {
    slug: "mcp",
    group: "Operate",
    title: "MCP server",
    summary:
      "Connect an AI client to inspect and manage Authometry with separately approved read and write access.",
    sections: [
      {
        title: "Start with the MCP URL",
        paragraphs: [
          "Point the MCP client at the environment issuer followed by /mcp. Authometry returns a protected-resource challenge so the client can discover the authorization server, register as a public OAuth client when needed, and start Authorization Code with S256 PKCE.",
        ],
        code: "https://authometry.ch3n.cc/mcp",
      },
      {
        title: "Review and connect",
        paragraphs: [
          "Sign in with an Authometry admin account. The consent page identifies the MCP client, its dynamic-registration status, the canonical MCP resource, and every requested permission. Connect only when those details match the client you started from.",
        ],
        note: "Access tokens are audience-bound to this MCP URL. Authometry rejects tokens issued for another API or environment.",
      },
      {
        title: "Inspect Authometry",
        bullets: [
          "list_environments returns environments in the token's workspace.",
          "list_applications searches non-secret OAuth client configuration.",
          "list_scopes reports resource scope sensitivity and application usage.",
          "list_authorization_traces searches recent redacted protocol traces.",
          "get_authorization_trace returns one redacted trace with its explanation and steps.",
        ],
        note: "Pass an environment slug or UUID when needed. Omitting it selects the workspace's default environment.",
      },
      {
        title: "Manage through the dashboard API",
        paragraphs: [
          "Approve mcp:write to let the client create services, edit applications, manage scopes and policies, rotate or revoke credentials, apply configuration, and perform the other operations available in the dashboard.",
        ],
        bullets: [
          "list_management_operations returns every supported method and path template.",
          "management_api_read calls any supported dashboard GET operation.",
          "management_api_write sends POST, PATCH, or DELETE operations through the same API handlers as the website.",
        ],
        note: "Existing connections remain read-only until you reconnect and approve mcp:write. Dashboard role checks, tenant boundaries, optimistic versions, audit logs, and destructive confirmations still apply.",
      },
    ],
  },
  {
    slug: "configuration-as-code",
    group: "Operate",
    title: "Configuration as code",
    summary: "Validate, review, and atomically apply authometry.dev/v1alpha1 manifests.",
    sections: [
      {
        title: "Use the review loop",
        code: "authometry validate\nauthometry plan --server https://authometry.ch3n.cc --token $AUTHOMETRY_TOKEN\nauthometry diff --server https://authometry.ch3n.cc --token $AUTHOMETRY_TOKEN\nauthometry apply --server https://authometry.ch3n.cc --token $AUTHOMETRY_TOKEN\nauthometry status --server https://authometry.ch3n.cc --token $AUTHOMETRY_TOKEN",
        paragraphs: [
          "Validate stays local. Plan and diff compare normalized manifests with the selected environment. Apply resolves secret references locally and commits the complete plan in one database transaction under an advisory lock.",
        ],
      },
      {
        title: "Manage five resource kinds",
        bullets: [
          "AuthometryInstance sets issuer and environment-wide protocol defaults.",
          "Application declares the client, URLs, grants, scopes, security settings, token lifetimes, and optional secret reference.",
          "Scope declares a consent-visible permission and sensitivity.",
          "Policy assigns all-match authorization conditions to applications.",
          "ClaimMapping copies approved user fields into tokens or UserInfo without replacing reserved claims.",
        ],
      },
      {
        title: "Treat deletion as explicit",
        paragraphs: [
          "A remote managed resource that is absent from the desired directory appears as a delete operation. Review plans before apply and protect non-interactive production applies with branch and environment approvals.",
        ],
        note: "Manifest-owned fields are read-only in the dashboard. Export dashboard resources before moving their ownership into Git.",
      },
    ],
  },
  {
    slug: "provisioning",
    group: "Operate",
    title: "Account provisioning",
    summary: "Synchronize Authometry users into connected services with signed lifecycle events.",
    sections: [
      {
        title: "Connect a service",
        paragraphs: [
          "Open Settings, choose Provisioning, and register the service's public HTTPS endpoint. Copy the signing secret into that service immediately; Authometry stores it encrypted and does not display it again.",
        ],
        bullets: [
          "Enable the existing-user option to queue every current identity when the connection is created.",
          "Use Sync Users later to repeat the upsert-safe backfill.",
          "Disconnecting stops future lifecycle events but does not change existing downstream accounts.",
        ],
      },
      {
        title: "Handle lifecycle events",
        paragraphs: [
          "Provisioning connections receive user.created and user.deleted. Verify the standard Authometry webhook signature before parsing the body, then key the downstream identity by environment.issuer plus data.user.id.",
        ],
        bullets: [
          "Treat user.created as an idempotent upsert because backfills and retries can repeat it.",
          "Revoke access or remove the managed identity when user.deleted arrives.",
          "Never expect a password: Authometry sends identity profile fields, not credentials.",
        ],
      },
      {
        title: "Plan for asynchronous delivery",
        paragraphs: [
          "Authometry queues lifecycle events and retries temporary failures with bounded exponential delays. A local user deletion is final even if a downstream service is unavailable, so monitor failed deliveries and keep handlers safe to retry.",
        ],
      },
    ],
  },
  {
    slug: "webhooks",
    group: "Operate",
    title: "Webhook verification",
    summary: "Verify signed audit-event deliveries and apply side effects exactly once.",
    sections: [
      {
        title: "Verify before parsing",
        paragraphs: [
          "Read the raw request body. Compute HMAC-SHA-256 over the timestamp, a period, and those exact bytes. Compare the hexadecimal digest with x-authometry-signature in constant time.",
        ],
        code: "signed = x-authometry-timestamp + '.' + rawBody\nexpected = HMAC_SHA256(webhookSecret, signed)\nreceived = x-authometry-signature.replace('v1=', '')",
      },
      {
        title: "Reject unsafe deliveries",
        bullets: [
          "Reject timestamps outside a short tolerance to limit replay.",
          "Deduplicate x-authometry-delivery before applying side effects.",
          "Return a 2xx only after the event is durably accepted.",
          "Rotate by creating a new secret, updating the consumer, then retiring the old subscription.",
        ],
      },
      {
        title: "Delivery behavior",
        paragraphs: [
          "Authometry sends HTTPS POST requests with a ten-second timeout. Failed deliveries use exponential retry delays and retain bounded response details for diagnostics. Destinations resolving to private or reserved addresses are rejected.",
        ],
      },
    ],
  },
  {
    slug: "errors",
    group: "Operate",
    title: "Errors and traces",
    summary:
      "Move from a stable error code to the failed validation step and its corrective action.",
    sections: [
      {
        title: "Read an authorization trace",
        bullets: [
          "Confirm the client, endpoint, environment, request ID, and final status.",
          "Find the first failed step; later skipped steps did not run.",
          "Compare Observed with Expected and follow the exact corrective action.",
          "Retry with a fresh protocol request after changing the client or configuration.",
        ],
      },
      {
        title: "Correlate API errors",
        code: '{\n  "error": {\n    "code": "environment_not_found",\n    "message": "The selected environment was not found.",\n    "requestId": "req_..."\n  }\n}',
        paragraphs: [
          "Management API errors include a stable code and request ID. Record both. Validation failures may include field details; internal errors intentionally avoid exposing implementation data.",
        ],
      },
      {
        title: "Sensitive values",
        paragraphs: [
          "Authometry redacts fields whose names identify credentials before trace persistence. Keep secrets out of arbitrary query fields, names, descriptions, custom claims, and policy messages; redaction is defense in depth, not a storage boundary.",
        ],
      },
    ],
  },
];

export const documentationGroups = ["Start", "OAuth and OIDC", "Operate"] as const;
