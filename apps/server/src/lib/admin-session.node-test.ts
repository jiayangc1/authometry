import assert from "node:assert/strict";
import test from "node:test";
import { ADMIN_REFRESH_REUSE_GRACE_MS, isConcurrentAdminRefresh } from "./admin-session.js";

void test("an overlapping admin refresh stays inside the concurrency grace window", () => {
  const rotatedAt = new Date("2026-07-22T12:00:00.000Z");
  const now = new Date(rotatedAt.getTime() + ADMIN_REFRESH_REUSE_GRACE_MS);

  assert.equal(isConcurrentAdminRefresh(rotatedAt, now), true);
});

void test("delayed admin refresh-token reuse remains a security violation", () => {
  const rotatedAt = new Date("2026-07-22T12:00:00.000Z");
  const now = new Date(rotatedAt.getTime() + ADMIN_REFRESH_REUSE_GRACE_MS + 1);

  assert.equal(isConcurrentAdminRefresh(rotatedAt, now), false);
});

void test("a future rotation timestamp is not accepted as concurrent", () => {
  const now = new Date("2026-07-22T12:00:00.000Z");
  const rotatedAt = new Date(now.getTime() + 1);

  assert.equal(isConcurrentAdminRefresh(rotatedAt, now), false);
});
