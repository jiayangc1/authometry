import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import { createApp } from "../index.js";
import { socialCallbackUri } from "../lib/social.js";
import { createPortalLaunchUrl } from "./portal.js";
import { preparePortalAvatar } from "./portal.js";
import sharp from "sharp";

await test("employee portal reports configured social providers", async () => {
  const response = await request(createApp()).get("/api/v1/portal/auth/providers").expect(200);

  assert.deepEqual(response.body, { google: false, github: false });
});

await test("employee portal reuses the registered provider callback", () => {
  assert.equal(
    socialCallbackUri("google"),
    "http://localhost:3000/api/v1/authorize/social/google/callback",
  );
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

await test("employee portal launches services with a third-party login issuer hint", () => {
  const launch = new URL(
    createPortalLaunchUrl(
      "https://cams.example.test/login?source=launcher",
      "https://identity.example.test/w/acme",
    ),
  );

  assert.equal(launch.origin + launch.pathname, "https://cams.example.test/login");
  assert.equal(launch.searchParams.get("source"), "launcher");
  assert.equal(launch.searchParams.get("iss"), "https://identity.example.test/w/acme");
});

await test("employee portal normalizes profile pictures to a square WebP", async () => {
  const source = await sharp({
    create: { width: 900, height: 500, channels: 3, background: "#635bff" },
  })
    .png()
    .toBuffer();
  const avatar = await preparePortalAvatar(source);
  const metadata = await sharp(avatar).metadata();

  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 512);
  assert.equal(metadata.height, 512);
});

await test("employee portal rejects invalid profile picture bytes", async () => {
  await assert.rejects(
    () => preparePortalAvatar(Buffer.from("not an image")),
    (error: unknown) =>
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "invalid_profile_picture",
  );
});
