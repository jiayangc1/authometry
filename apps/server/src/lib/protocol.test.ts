import { describe, expect, it } from "vitest";
import { hashToken, randomToken, sha256Base64Url } from "./crypto.js";
import { readUserClaim } from "./claims.js";
import { verifyPkce } from "./oauth.js";
import { evaluateAll, evaluateCondition, type PolicyContext } from "./policy.js";
import { redactRecord } from "./trace.js";

const context: PolicyContext = {
  environment: "production",
  user: { groups: ["engineering", "admin"], email: "owner@example.com" },
  application: { id: "app", slug: "dashboard", type: "web" },
  request: { scopes: ["openid", "profile"] },
};

describe("OAuth protocol helpers", () => {
  it("accepts only matching S256 PKCE verifiers", () => {
    const verifier = "Lwa2uHrtzXGmJxYhCwiLz3dszAnqP88jQpG7TzCD0hJ";
    const challenge = sha256Base64Url(verifier);
    expect(verifyPkce(verifier, challenge, "S256")).toBe(true);
    expect(verifyPkce(`${verifier}x`, challenge, "S256")).toBe(false);
    expect(verifyPkce(verifier, challenge, "plain")).toBe(false);
  });

  it("hashes opaque values without retaining or repeating them", () => {
    const first = randomToken(32);
    const second = randomToken(32);
    expect(first).not.toBe(second);
    expect(hashToken(first)).not.toContain(first);
    expect(hashToken(first)).toBe(hashToken(first));
  });

  it("redacts every credential-bearing trace field", () => {
    expect(
      redactRecord({
        client_id: "public-client",
        client_secret: "do-not-record",
        code: "one-time-code",
        code_challenge: "safe-challenge",
        refresh_token: "do-not-record",
        cookie: "do-not-record",
      }),
    ).toEqual({
      client_id: "public-client",
      client_secret: "[redacted]",
      code: "[redacted]",
      code_challenge: "safe-challenge",
      refresh_token: "[redacted]",
      cookie: "[redacted]",
    });
  });

  it("resolves only supported standard and custom user claim sources", () => {
    const user = {
      id: "user_1",
      email: "owner@example.com",
      name: "Owner",
      groups: ["engineering"],
      emailVerified: true,
      customClaims: { organization: { tier: "enterprise" } },
    };
    expect(readUserClaim(user, "user.email_verified")).toBe(true);
    expect(readUserClaim(user, "user.custom_claims.organization.tier")).toBe("enterprise");
    expect(readUserClaim(user, "request.client_secret")).toBeUndefined();
  });
});

describe("policy evaluation", () => {
  it("evaluates nested scalar and collection conditions", () => {
    expect(
      evaluateCondition({ field: "environment", operator: "equals", value: "production" }, context),
    ).toBe(true);
    expect(
      evaluateCondition({ field: "user.groups", operator: "contains", value: "admin" }, context),
    ).toBe(true);
    expect(
      evaluateCondition(
        { field: "application.type", operator: "in", value: ["web", "spa"] },
        context,
      ),
    ).toBe(true);
  });

  it("requires all conditions in an allow policy", () => {
    expect(
      evaluateAll(
        [
          { field: "environment", operator: "equals", value: "production" },
          { field: "user.groups", operator: "contains", value: "finance" },
        ],
        context,
      ),
    ).toBe(false);
  });
});
