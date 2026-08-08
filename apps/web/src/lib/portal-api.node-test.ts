import assert from "node:assert/strict";
import test from "node:test";
import { portalCsrfToken } from "./portal-api.js";

void test("malformed portal CSRF cookies are ignored", () => {
  const originalDocument = globalThis.document;
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { cookie: "authometry_portal_csrf=%E0%A4%A" },
  });
  try {
    assert.equal(portalCsrfToken(), "");
  } finally {
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: originalDocument,
    });
  }
});
