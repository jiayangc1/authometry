import assert from "node:assert/strict";
import test from "node:test";
import { apiFetch } from "./api.js";

void test("concurrent unauthorized requests share one session refresh", async () => {
  const originalFetch = globalThis.fetch;
  let protectedRequests = 0;
  let refreshRequests = 0;
  let releaseRefresh: (() => void) | undefined;
  const refreshStarted = new Promise<void>((resolve) => {
    releaseRefresh = resolve;
  });

  globalThis.fetch = async (input) => {
    const path = String(input);
    if (path === "/api/v1/auth/refresh") {
      refreshRequests += 1;
      await refreshStarted;
      return new Response(null, { status: 204 });
    }
    protectedRequests += 1;
    return protectedRequests <= 2
      ? Response.json({ error: { code: "authentication_required" } }, { status: 401 })
      : Response.json({ ok: true });
  };

  try {
    const requests = [
      apiFetch<{ ok: boolean }>("/api/v1/traces"),
      apiFetch<{ ok: boolean }>("/api/v1/overview"),
    ];
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(refreshRequests, 1);
    releaseRefresh?.();
    assert.deepEqual(await Promise.all(requests), [{ ok: true }, { ok: true }]);
    assert.equal(refreshRequests, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

void test("a queued cross-tab refresh reuses the session rotated by the first tab", async () => {
  const originalDocument = globalThis.document;
  const originalFetch = globalThis.fetch;
  const originalNavigator = globalThis.navigator;
  let csrf = "first.csrf";
  let protectedRequests = 0;
  let refreshRequests = 0;

  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      get cookie() {
        return `authometry_csrf=${csrf}`;
      },
    },
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      locks: {
        request: async (_name: string, callback: () => Promise<boolean>) => {
          csrf = "rotated.csrf";
          return callback();
        },
      },
    },
  });
  globalThis.fetch = async (input) => {
    if (String(input) === "/api/v1/auth/refresh") {
      refreshRequests += 1;
      return new Response(null, { status: 204 });
    }
    protectedRequests += 1;
    return protectedRequests === 1
      ? Response.json({ error: { code: "authentication_required" } }, { status: 401 })
      : Response.json({ ok: true });
  };

  try {
    assert.deepEqual(await apiFetch<{ ok: boolean }>("/api/v1/overview"), { ok: true });
    assert.equal(refreshRequests, 0);
  } finally {
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: originalDocument,
    });
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: originalNavigator,
    });
    globalThis.fetch = originalFetch;
  }
});
