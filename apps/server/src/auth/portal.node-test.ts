import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import { createApp } from "../index.js";

await test("employee portal reports configured social providers", async () => {
  const response = await request(createApp()).get("/api/v1/portal/auth/providers").expect(200);

  assert.deepEqual(response.body, { google: false, github: false });
});

await test("employee portal identity routes require a resource-owner session", async () => {
  const response = await request(createApp()).get("/api/v1/portal/me").expect(401);

  assert.equal(response.body.error.code, "portal_authentication_required");
});

await test("employee portal login validates credentials before database access", async () => {
  const response = await request(createApp())
    .post("/api/v1/portal/auth/login")
    .send({})
    .expect(422);

  assert.equal(response.body.error.code, "validation_failed");
});

await test("employee portal can clear a stale session and return to login", async () => {
  const response = await request(createApp())
    .get("/api/v1/portal/auth/clear-session")
    .query({ return_to: "/portal/login?returnTo=/portal/security" })
    .expect(302);

  assert.equal(response.headers.location, "/portal/login?returnTo=/portal/security");
  assert.equal(
    (response.headers["set-cookie"] as unknown as string[]).some((value) =>
      value.startsWith("authometry_user_session="),
    ),
    true,
  );
});
