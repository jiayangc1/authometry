import assert from "node:assert/strict";
import test from "node:test";
import { apiFetch, renewDashboardSession } from "./api.js";

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

void test("the same browser session can renew access repeatedly", async () => {
  const originalFetch = globalThis.fetch;
  const attempts = new Map<string, number>();
  let refreshRequests = 0;

  globalThis.fetch = async (input) => {
    const path = String(input);
    if (path === "/api/v1/auth/refresh") {
      refreshRequests += 1;
      return new Response(null, { status: 204 });
    }
    const attempt = (attempts.get(path) ?? 0) + 1;
    attempts.set(path, attempt);
    return attempt === 1
      ? Response.json({ error: { code: "authentication_required" } }, { status: 401 })
      : Response.json({ ok: true });
  };

  try {
    assert.deepEqual(await apiFetch<{ ok: boolean }>("/api/v1/overview"), { ok: true });
    assert.deepEqual(await apiFetch<{ ok: boolean }>("/api/v1/settings"), { ok: true });
    assert.equal(refreshRequests, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

void test("session renewal replaces a missing or stale CSRF cookie", async () => {
  const originalFetch = globalThis.fetch;
  let protectedRequests = 0;
  let refreshRequests = 0;
  let csrfRequests = 0;

  globalThis.fetch = async (input, init) => {
    const path = String(input);
    if (path === "/api/v1/auth/refresh") {
      refreshRequests += 1;
      const csrf = new Headers(init?.headers).get("x-authometry-csrf");
      return csrf === "replacement-token"
        ? new Response(null, { status: 204 })
        : Response.json({ error: { code: "csrf_failed" } }, { status: 403 });
    }
    if (path === "/api/v1/auth/csrf") {
      csrfRequests += 1;
      return Response.json({ csrfToken: "replacement-token" });
    }
    protectedRequests += 1;
    return protectedRequests === 1
      ? Response.json({ error: { code: "authentication_required" } }, { status: 401 })
      : Response.json({ ok: true });
  };

  try {
    assert.deepEqual(await apiFetch<{ ok: boolean }>("/api/v1/overview"), { ok: true });
    assert.equal(refreshRequests, 2);
    assert.equal(csrfRequests, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

void test("proactive dashboard renewal shares an in-flight refresh", async () => {
  const originalFetch = globalThis.fetch;
  let refreshRequests = 0;
  let releaseRefresh: (() => void) | undefined;
  const refreshStarted = new Promise<void>((resolve) => {
    releaseRefresh = resolve;
  });

  globalThis.fetch = async (input) => {
    assert.equal(String(input), "/api/v1/auth/refresh");
    refreshRequests += 1;
    await refreshStarted;
    return new Response(null, { status: 204 });
  };

  try {
    const renewals = [renewDashboardSession(), renewDashboardSession()];
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(refreshRequests, 1);
    releaseRefresh?.();
    assert.deepEqual(await Promise.all(renewals), [true, true]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

void test("malformed browser cookies do not crash API requests", async () => {
  const originalFetch = globalThis.fetch;
  const originalDocument = globalThis.document;
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { cookie: "authometry_csrf=%E0%A4%A; authometry_environment=%ZZ" },
  });
  globalThis.fetch = async (_input, init) => {
    const headers = new Headers(init?.headers);
    assert.equal(headers.has("x-authometry-csrf"), false);
    assert.equal(headers.has("x-authometry-environment"), false);
    return Response.json({ ok: true });
  };

  try {
    assert.deepEqual(await apiFetch<{ ok: boolean }>("/api/v1/overview"), { ok: true });
  } finally {
    globalThis.fetch = originalFetch;
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: originalDocument,
    });
  }
});
