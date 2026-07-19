import assert from "node:assert/strict";
import test from "node:test";
import { canonicalWebhookBody } from "./webhook.js";

await test("webhook timestamps are canonicalized across RFC3339 representations", () => {
  const body = canonicalWebhookBody({
    id: "event-1",
    createdAt: "2026-07-19T15:05:42.183424+00:00",
  });

  assert.deepEqual(body, {
    id: "event-1",
    createdAt: "2026-07-19T15:05:42.183Z",
  });
});

await test("webhook bodies without a valid timestamp are preserved", () => {
  const body = { id: "event-1", createdAt: "not-a-timestamp" };
  assert.equal(canonicalWebhookBody(body), body);
});
