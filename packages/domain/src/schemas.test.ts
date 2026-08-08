import { describe, expect, it } from "vitest";
import {
  applicationInputSchema,
  applicationUpdateSchema,
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

  it("normalizes redirects and rejects embedded credentials or excessive values", () => {
    expect(redirectUriSchema.parse("  https://client.example/callback  ")).toBe(
      "https://client.example/callback",
    );
    expect(redirectUriSchema.safeParse("https://user:secret@client.example/callback").success).toBe(
      false,
    );
    expect(redirectUriSchema.safeParse(`https://client.example/${"a".repeat(2048)}`).success).toBe(
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

  it("requires callbacks for interactive applications and rejects duplicate configuration", () => {
    const base = { name: "Portal", slug: "portal", type: "web" as const };
    expect(applicationInputSchema.safeParse({ ...base, redirectUris: [] }).success).toBe(false);
    expect(
      applicationInputSchema.safeParse({
        ...base,
        redirectUris: ["https://client.example/callback", "https://client.example/callback"],
      }).success,
    ).toBe(false);
    expect(
      applicationInputSchema.safeParse({
        ...base,
        redirectUris: ["https://client.example/callback"],
        allowedScopes: ["openid", "openid"],
      }).success,
    ).toBe(false);
  });

  it("uses the same secure redirect and normalized text rules for updates", () => {
    const update = applicationUpdateSchema.parse({
      version: 1,
      name: "  Customer Portal  ",
      description: "  Sign in here  ",
      redirectUris: [" https://client.example/callback "],
    });
    expect(update.name).toBe("Customer Portal");
    expect(update.description).toBe("Sign in here");
    expect(update.redirectUris).toEqual(["https://client.example/callback"]);
    expect(
      applicationUpdateSchema.safeParse({
        version: 1,
        postLogoutRedirectUris: ["http://public.example/logout"],
      }).success,
    ).toBe(false);
  });
});
