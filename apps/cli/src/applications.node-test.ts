import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { applicationManifestSchema } from "@authometry/config";
import {
  applicationCreatePayload,
  applicationEnvironment,
  writeApplicationEnvironment,
  type CreatedApplicationResponse,
} from "./applications.js";

void test("builds a SaaS application payload with agent-selected OAuth settings", () => {
  assert.deepEqual(
    applicationCreatePayload({
      name: "Customer Portal",
      type: "web",
      logoUri: "https://cdn.example.com/customer-portal.png",
      redirectUris: ["https://customer.example.com/auth/callback"],
      postLogoutRedirectUris: ["https://customer.example.com/"],
      scopes: ["openid", "profile", "email", "offline_access"],
    }),
    {
      name: "Customer Portal",
      slug: "customer-portal",
      type: "web",
      description: undefined,
      logoUri: "https://cdn.example.com/customer-portal.png",
      redirectUris: ["https://customer.example.com/auth/callback"],
      postLogoutRedirectUris: ["https://customer.example.com/"],
      allowedScopes: ["openid", "profile", "email", "offline_access"],
      portalEnabled: true,
      launchUri: "https://customer.example.com/login",
    },
  );
  assert.throws(
    () =>
      applicationCreatePayload({
        name: "Customer Portal",
        type: "web",
        logoUri: "http://cdn.example.com/customer-portal.png",
        redirectUris: ["https://customer.example.com/auth/callback"],
        postLogoutRedirectUris: [],
        scopes: [],
      }),
    /Use HTTPS unless the host is localhost/,
  );
  assert.throws(
    () =>
      applicationCreatePayload({
        name: "Customer Portal",
        type: "web",
        redirectUris: [],
        postLogoutRedirectUris: [],
        scopes: [],
      }),
    /requires at least one --redirect-uri/,
  );
  assert.equal(
    applicationEnvironment(
      {
        id: "app_public",
        issuer: "https://authometry.ch3n.cc",
        clientId: "amt_client_public",
      },
      "VITE_AUTHOMETRY",
    ),
    'VITE_AUTHOMETRY_APPLICATION_ID="app_public"\nVITE_AUTHOMETRY_ISSUER="https://authometry.ch3n.cc"\nVITE_AUTHOMETRY_CLIENT_ID="amt_client_public"\n',
  );
});

void test("defaults manifest applications into the employee portal launcher", () => {
  const application = applicationManifestSchema.parse({
    apiVersion: "authometry.dev/v1alpha1",
    kind: "Application",
    metadata: { name: "customer-portal" },
    spec: {
      displayName: "Customer Portal",
      type: "web",
      redirectUris: ["https://customer.example.com/auth/callback"],
      grantTypes: ["authorization_code", "refresh_token"],
      security: { requirePkce: true, requireConsent: true, rotateRefreshTokens: true },
      tokens: { accessTokenLifetime: "15m", refreshTokenLifetime: "30d" },
    },
  });

  assert.equal(application.spec.portalEnabled, true);
  assert.equal(application.spec.launchUri, "https://customer.example.com/login");
});

void test("writes one-time credentials without replacing existing values implicitly", async () => {
  const directory = await mkdtemp(join(tmpdir(), "authometry-cli-"));
  const path = join(directory, ".env.local");
  const application: CreatedApplicationResponse = {
    id: "app_123",
    issuer: "https://authometry.ch3n.cc",
    clientId: "amt_client_123",
    clientSecret: "amt_secret_original",
  };

  try {
    await writeFile(path, "OTHER_SETTING=preserved\n");
    assert.equal(await writeApplicationEnvironment(path, application, false), path);
    const contents = await readFile(path, "utf8");
    assert.match(contents, /^OTHER_SETTING=preserved/m);
    assert.match(contents, /^AUTHOMETRY_ISSUER="https:\/\/authometry\.ch3n\.cc"$/m);
    assert.match(contents, /^AUTHOMETRY_CLIENT_SECRET="amt_secret_original"$/m);
    assert.equal((await stat(path)).mode & 0o777, 0o600);

    await assert.rejects(
      writeApplicationEnvironment(path, { ...application, clientSecret: "replacement" }, false),
      /already defines AUTHOMETRY_APPLICATION_ID/,
    );
    await writeApplicationEnvironment(
      path,
      { ...application, clientSecret: "amt_secret_replacement" },
      true,
    );
    const replaced = await readFile(path, "utf8");
    assert.doesNotMatch(replaced, /amt_secret_original/);
    assert.match(replaced, /amt_secret_replacement/);
    assert.match(replaced, /^OTHER_SETTING=preserved/m);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
