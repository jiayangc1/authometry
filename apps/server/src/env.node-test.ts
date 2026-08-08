import assert from "node:assert/strict";
import test from "node:test";
import { assertProductionConfiguration, env } from "./env.js";

const productionConfiguration = {
  ...env,
  NODE_ENV: "production" as const,
  PUBLIC_ORIGIN: "https://auth.example.com",
  COOKIE_SECRET: "cookie-secret-that-is-at-least-32-characters",
  CSRF_SECRET: "csrf-secret-that-is-at-least-32-characters--",
  ACCESS_TOKEN_SECRET: "access-secret-that-is-at-least-32-characters",
  REFRESH_TOKEN_SECRET: "refresh-secret-that-is-at-least-32-characters",
  INSTALLATION_ENCRYPTION_KEY: "encryption-key-that-is-at-least-32-characters",
  TOKEN_HMAC_KEY: "hmac-key-that-is-at-least-32-characters---",
  BOOTSTRAP_TOKEN: "one-time-production-bootstrap-token",
  BOOTSTRAP_TOKEN_EXPIRES_AT: new Date(Date.now() + 60_000),
};

void test("production rejects every development credential", () => {
  assert.throws(
    () =>
      assertProductionConfiguration({
        ...productionConfiguration,
        CSRF_SECRET: "development-only-secret-change-me-32-bytes",
      }),
    /CSRF_SECRET/,
  );
  assert.throws(
    () =>
      assertProductionConfiguration({
        ...productionConfiguration,
        BOOTSTRAP_TOKEN: "authometry-development-bootstrap",
      }),
    /BOOTSTRAP_TOKEN/,
  );
});

void test("production requires an HTTPS public origin", () => {
  assert.throws(
    () =>
      assertProductionConfiguration({
        ...productionConfiguration,
        PUBLIC_ORIGIN: "http://auth.example.com",
      }),
    /must use HTTPS/,
  );
});
