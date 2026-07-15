import { describe, expect, it } from "vitest";
import {
  applicationInputSchema,
  createApplicationSlug,
  redirectUriSchema,
  scopeNameSchema,
} from "./index.js";

describe("management schemas", () => {
  it("allows HTTPS and loopback development redirect URIs", () => {
    expect(redirectUriSchema.safeParse("https://client.example/callback").success).toBe(true);
    expect(redirectUriSchema.safeParse("http://localhost:3000/callback").success).toBe(true);
  });

  it("rejects insecure public and fragment-bearing redirects", () => {
    expect(redirectUriSchema.safeParse("http://client.example/callback").success).toBe(false);
    expect(redirectUriSchema.safeParse("https://client.example/callback#fragment").success).toBe(
      false,
    );
  });

  it("normalizes application slugs and strict scope identifiers", () => {
    expect(createApplicationSlug("Customer Portal (Production)")).toBe(
      "customer-portal-production",
    );
    expect(scopeNameSchema.safeParse("orders:read").success).toBe(true);
    expect(scopeNameSchema.safeParse("orders read").success).toBe(false);
  });

  it("rejects invalid application inputs at the shared contract boundary", () => {
    expect(
      applicationInputSchema.safeParse({
        name: "Portal",
        slug: "portal",
        type: "spa",
        redirectUris: ["javascript:alert(1)"],
      }).success,
    ).toBe(false);
  });
});
