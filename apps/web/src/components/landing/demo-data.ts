/**
 * One consistent scenario for every landing-page visual: Itsagram, a media app run by the
 * Bellaire Media workspace, signs a user in through a self-hosted Authometry issuer.
 * Step names, event types, error codes, and explanations mirror what the server records.
 */

export const GITHUB_URL = "https://github.com/jiayangc1/authometry";
export const githubDoc = (path: string) => `${GITHUB_URL}/blob/main/${path}`;

export const scenario = {
  issuer: "https://auth.itsagram.com",
  workspace: "Bellaire Media",
  workspaceSlug: "bellaire-media",
  environment: "production",
  application: {
    name: "Itsagram Web",
    slug: "itsagram-web",
    clientId: "itsagram-web",
    type: "web",
    redirectUri: "https://itsagram.com/auth/callback",
  },
  user: {
    name: "Maya Okafor",
    email: "maya@bellaire.media",
    id: "5b0f6c1e-8a2d-4f93-b7e1-2c4d9a0e6f38",
    groups: ["bellaire-media", "editors"],
  },
  scopes: ["openid", "profile", "media:read"],
  requestId: "req_Q2x7mL9kTa",
  deniedRequestId: "req_V8nP3wQe1c",
  scopeRequestId: "req_Hd4sZ0rWb2",
  startedAt: "14:32:08.112",
  durationMs: 74.6,
  policy: {
    name: "workspace-member",
    displayName: "Workspace member",
    field: "user.groups",
    operator: "contains",
    value: "bellaire-media",
    denyMessage: "A Bellaire Media workspace account is required.",
    source: "policies/workspace-member.yaml",
  },
  signingKey: "kid_2026-09_r1",
} as const;

export type StepStatus = "passed" | "failed" | "skipped";

export interface TraceField {
  label: string;
  value: string;
  mono?: boolean;
}

export interface TraceStepDemo {
  id: string;
  name: string;
  summary: string;
  description: string;
  status: StepStatus;
  offsetMs: number;
  durationMs: number;
  inputs?: TraceField[];
  outputs?: TraceField[];
  decision?: { outcome: "allowed" | "denied"; reason: string };
}

/** Authorization Code + PKCE request with an existing session and a stored consent grant. */
export const allowedTrace: TraceStepDemo[] = [
  {
    id: "received",
    name: "Request received",
    summary: "GET /oauth/authorize",
    description: "The authorization endpoint received the request.",
    status: "passed",
    offsetMs: 0,
    durationMs: 0.4,
    inputs: [
      { label: "response_type", value: "code", mono: true },
      { label: "client_id", value: "itsagram-web", mono: true },
      { label: "scope", value: "openid profile media:read", mono: true },
      { label: "state", value: "[redacted]", mono: true },
    ],
  },
  {
    id: "client",
    name: "Client verified",
    summary: "itsagram-web",
    description: "The requested client exists and is active.",
    status: "passed",
    offsetMs: 0.4,
    durationMs: 3.1,
    outputs: [
      { label: "Application", value: "Itsagram Web" },
      { label: "Type", value: "web", mono: true },
      { label: "Environment", value: "production", mono: true },
    ],
    decision: { outcome: "allowed", reason: "The client is registered and enabled." },
  },
  {
    id: "redirect",
    name: "Redirect URI matched",
    summary: "https://itsagram.com/auth/callback",
    description: "The redirect URI exactly matches a registered value.",
    status: "passed",
    offsetMs: 3.5,
    durationMs: 0.2,
    inputs: [{ label: "Received", value: "https://itsagram.com/auth/callback", mono: true }],
    outputs: [{ label: "Match", value: "exact", mono: true }],
  },
  {
    id: "pkce",
    name: "PKCE challenge validated",
    summary: "S256 challenge accepted",
    description: "The request contains an S256 PKCE challenge.",
    status: "passed",
    offsetMs: 3.7,
    durationMs: 0.1,
    inputs: [
      { label: "code_challenge", value: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM", mono: true },
      { label: "code_challenge_method", value: "S256", mono: true },
    ],
  },
  {
    id: "user",
    name: "User authenticated",
    summary: "maya@bellaire.media",
    description: "The user completed authentication.",
    status: "passed",
    offsetMs: 3.8,
    durationMs: 37.4,
    outputs: [
      { label: "User", value: "Maya Okafor" },
      { label: "Session", value: "existing", mono: true },
      { label: "user.groups", value: "bellaire-media, editors", mono: true },
    ],
    decision: { outcome: "allowed", reason: "The user session is valid." },
  },
  {
    id: "consent",
    name: "Consent evaluated",
    summary: "Access approved",
    description: "The requested access was approved.",
    status: "passed",
    offsetMs: 41.2,
    durationMs: 17.7,
    inputs: [{ label: "Requested", value: "openid profile media:read", mono: true }],
    outputs: [{ label: "Grant", value: "stored consent covers every scope" }],
  },
  {
    id: "code",
    name: "Authorization code issued",
    summary: "One-time code created",
    description: "A short-lived, single-use authorization code was issued.",
    status: "passed",
    offsetMs: 58.9,
    durationMs: 12.5,
    outputs: [
      { label: "code", value: "[redacted]", mono: true },
      { label: "Lifetime", value: "60s", mono: true },
      { label: "Bound to", value: "client, redirect URI, user, scopes, challenge" },
    ],
  },
  {
    id: "redirected",
    name: "Redirect completed",
    summary: "302 Found",
    description: "The user agent was redirected to the registered redirect URI.",
    status: "passed",
    offsetMs: 71.4,
    durationMs: 3.2,
    outputs: [
      { label: "Location", value: "https://itsagram.com/auth/callback?code=…&state=…", mono: true },
    ],
  },
];

/** Clock time for a trace offset, e.g. 14:32:08.153 */
export function clockAt(offsetMs: number): string {
  const base = 112 + Math.round(offsetMs);
  return `14:32:08.${String(base).padStart(3, "0")}`;
}
