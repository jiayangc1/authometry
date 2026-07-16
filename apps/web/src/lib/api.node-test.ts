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
