/** Manifests follow the real authometry.dev/v1alpha1 schema: one resource per file. */

export type ResourceKind = "Application" | "Scope" | "Policy";

export interface ManifestFile {
  id: "application" | "scope" | "policy";
  path: string;
  kind: ResourceKind;
  status: "modified" | "added";
  /** Each line: [text, block id or null, added in this change] */
  lines: Array<[string, string | null, boolean?]>;
}

export const manifestFiles: ManifestFile[] = [
  {
    id: "policy",
    path: "policies/workspace-member.yaml",
    kind: "Policy",
    status: "added",
    lines: [
      ["apiVersion: authometry.dev/v1alpha1", null, true],
      ["kind: Policy", null, true],
      ["metadata:", "identity", true],
      ["  name: workspace-member", "identity", true],
      ["spec:", null, true],
      ["  displayName: Workspace member", "identity", true],
      ["  description: Only Bellaire Media members can use Itsagram.", "identity", true],
      ["  enabled: true", "identity", true],
      ["  applications: [itsagram-web]", "applications", true],
      ["  match:", "match", true],
      ["    all:", "match", true],
      ["      - field: user.groups", "match", true],
      ["        operator: contains", "match", true],
      ["        value: bellaire-media", "match", true],
      ["  decision:", "decision", true],
      ["    allow: true", "decision", true],
      ["  otherwise:", "otherwise", true],
      ["    deny:", "otherwise", true],
      ["      code: access_denied", "otherwise", true],
      ["      message: A Bellaire Media workspace account is required.", "otherwise", true],
    ],
  },
  {
    id: "scope",
    path: "scopes/media-read.yaml",
    kind: "Scope",
    status: "added",
    lines: [
      ["apiVersion: authometry.dev/v1alpha1", null, true],
      ["kind: Scope", null, true],
      ["metadata:", "value", true],
      ["  name: media-read", "value", true],
      ["spec:", null, true],
      ["  value: media:read", "value", true],
      ["  displayName: Read media", "value", true],
      ["  description: Read media items through the Itsagram API.", "value", true],
      ["  consentDescription: View your media", "consent", true],
      ["  sensitivity: standard", "sensitivity", true],
    ],
  },
  {
    id: "application",
    path: "applications/itsagram-web.yaml",
    kind: "Application",
    status: "modified",
    lines: [
      ["apiVersion: authometry.dev/v1alpha1", null],
      ["kind: Application", null],
      ["metadata:", "identity"],
      ["  name: itsagram-web", "identity"],
      ["spec:", null],
      ["  displayName: Itsagram Web", "identity"],
      ["  type: web", "identity"],
      ["  redirectUris:", "redirects"],
      ["    - https://itsagram.com/auth/callback", "redirects"],
      ["  postLogoutRedirectUris:", "redirects"],
      ["    - https://itsagram.com/", "redirects"],
      ["  grantTypes: [authorization_code, refresh_token]", "grants"],
      ["  scopes: [openid, profile, media:read]", "scopes", true],
      ["  security:", "security"],
      ["    requirePkce: true", "security"],
      ["    requireConsent: true", "security"],
      ["    rotateRefreshTokens: true", "security"],
      ["  tokens:", "tokens"],
      ["    accessTokenLifetime: 15m", "tokens"],
      ["    refreshTokenLifetime: 30d", "tokens"],
      ["  tokenEndpointAuthMethod: client_secret_basic", "auth"],
      ["  credentials:", "auth"],
      ["    clientSecret:", "auth"],
      ["      valueFrom:", "auth"],
      ["        environment:", "auth"],
      ["          name: ITSAGRAM_CLIENT_SECRET", "auth"],
    ],
  },
];

export const diffStat = {
  added: manifestFiles.reduce(
    (sum, file) => sum + file.lines.filter(([, , added]) => added).length,
    0,
  ),
  removed: 1,
};

type Line = [text: string, tone?: "ok" | "create" | "update" | "same"];

const plan: Line[] = [
  ["  ~ Application/itsagram-web", "update"],
  ["  = AuthometryInstance/primary", "same"],
  ["  + Policy/workspace-member", "create"],
  ["  + Scope/media-read", "create"],
  [""],
  ["Plan: 2 create, 1 update, 0 delete, 1 unchanged."],
];

/** What CI runs on the pull request, and what it runs after merge. */
export const pipelines: Array<{
  id: string;
  label: string;
  steps: Array<{ command: string; output: Line[] }>;
}> = [
  {
    id: "pull-request",
    label: "Pull request #184",
    steps: [
      {
        command: "authometry validate --directory authometry",
        output: [
          ["✓ 1 Application resources valid", "ok"],
          ["✓ 1 AuthometryInstance resources valid", "ok"],
          ["✓ 1 Policy resources valid", "ok"],
          ["✓ 1 Scope resources valid", "ok"],
          [""],
          ["Configuration is valid."],
        ],
      },
      { command: "authometry plan --directory authometry", output: plan },
    ],
  },
  {
    id: "main",
    label: "Merged to main",
    steps: [
      {
        command: "authometry apply --directory authometry --non-interactive --revision 9f3c2e1",
        output: [
          ...plan,
          ["✓ Applied 3 changes in deployment 0c6f1d2e-7b41-4a8e-9d35-5f2a8c1e4b90.", "ok"],
        ],
      },
    ],
  },
];
