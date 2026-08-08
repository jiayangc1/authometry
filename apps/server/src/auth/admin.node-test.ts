import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";
import request from "supertest";
import { createApp } from "../index.js";
import { requireAdmin } from "./admin.js";

await test("admin login reports configured social providers", async () => {
  const response = await request(createApp()).get("/api/v1/auth/providers").expect(200);

  assert.deepEqual(response.body, { google: false, github: false });
});

await test("admin session recovery can replace the browser CSRF cookie", async () => {
  const response = await request(createApp()).get("/api/v1/auth/csrf").expect(200);
  const csrfToken = response.body.csrfToken as string;
  const setCookie = response.headers["set-cookie"] as unknown as string[];

  assert.match(csrfToken, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.ok(setCookie.some((value) => value.startsWith(`authometry_csrf=${csrfToken};`)));
  assert.ok(setCookie.some((value) => value.includes("Max-Age=2592000")));
  assert.ok(setCookie.every((value) => !value.includes("HttpOnly")));
});

await test("admin social login rejects a disabled provider before creating state", async () => {
  const response = await request(createApp()).get("/api/v1/auth/social/google").expect(404);

  assert.equal(response.body.error.code, "provider_disabled");
});

await test("dashboard social connection changes require an authenticated account", async () => {
  const response = await request(createApp()).post("/api/v1/auth/connections/google").expect(401);

  assert.equal(response.body.error.code, "authentication_required");
});

await test("admin authentication does not disguise infrastructure failures as logout", async () => {
  const infrastructureError = new Error("database unavailable");
  const fakeRequest = {
    get: () => undefined,
    get cookies() {
      throw infrastructureError;
    },
  } as unknown as Request;

  const error = await new Promise<unknown>((resolve) => {
    void requireAdmin(fakeRequest, {} as Response, resolve);
  });

  assert.equal(error, infrastructureError);
});
