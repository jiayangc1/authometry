import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import { createApp } from "../index.js";

await test("admin login reports configured social providers", async () => {
  const response = await request(createApp()).get("/api/v1/auth/providers").expect(200);

  assert.deepEqual(response.body, { google: false, github: false });
});

await test("admin social login rejects a disabled provider before creating state", async () => {
  const response = await request(createApp()).get("/api/v1/auth/social/google").expect(404);

  assert.equal(response.body.error.code, "provider_disabled");
});
