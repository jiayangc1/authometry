import { describe, expect, it } from "vitest";
import {
  buildConfigurationPlan,
  comparableManifest,
  parseManifest,
  validateManifestRelationships,
} from "./index.js";

const scope = `
apiVersion: authometry.dev/v1alpha1
kind: Scope
metadata:
  name: projects-read
spec:
  value: projects:read
  displayName: Read projects
  description: Read project information.
  consentDescription: View your projects
  sensitivity: standard
`;

describe("configuration manifests", () => {
  it("parses and plans deterministic resources", () => {
    const document = parseManifest(scope, "scopes/projects-read.yaml");
    expect(document.manifest.kind).toBe("Scope");
    expect(buildConfigurationPlan([document], [])[0]?.operation).toBe("create");
  });

  it("reports unresolved scope references", () => {
    const application = parseManifest(`
apiVersion: authometry.dev/v1alpha1
kind: Application
metadata: { name: dashboard }
spec:
  displayName: Dashboard
  type: web
  redirectUris: [https://example.com/callback]
  grantTypes: [authorization_code]
  scopes: [projects:reed]
  security: { requirePkce: true, requireConsent: true, rotateRefreshTokens: true }
  tokens: { accessTokenLifetime: 15m, refreshTokenLifetime: 30d }
`);
    expect(validateManifestRelationships([application])).toContain(
      "manifest.yaml: Unknown scope projects:reed.",
    );
  });

  it("rejects claim mappings that replace protocol claims", () => {
    expect(() =>
      parseManifest(`
apiVersion: authometry.dev/v1alpha1
kind: ClaimMapping
metadata: { name: unsafe-subject }
spec:
  source: { field: user.email }
  target: { claim: sub }
  includeIn: [id_token]
`),
    ).toThrow("Claim mappings cannot replace protocol claims");
  });

  it("does not treat secret references as exportable drift", () => {
    const application = parseManifest(`
apiVersion: authometry.dev/v1alpha1
kind: Application
metadata: { name: dashboard }
spec:
  displayName: Dashboard
  type: web
  redirectUris: [https://example.com/callback]
  grantTypes: [authorization_code]
  scopes: [openid]
  security: { requirePkce: true, requireConsent: true, rotateRefreshTokens: true }
  tokens: { accessTokenLifetime: 15m, refreshTokenLifetime: 30d }
  credentials:
    clientSecret:
      valueFrom:
        environment: { name: DASHBOARD_CLIENT_SECRET }
`);
    expect(comparableManifest(application.manifest)).not.toHaveProperty("spec.credentials");
  });
});
