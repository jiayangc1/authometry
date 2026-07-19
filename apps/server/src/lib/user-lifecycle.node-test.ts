import assert from "node:assert/strict";
import test from "node:test";
import { createProvisioningEventBody, userLifecycleData } from "./user-lifecycle.js";

const user = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "person@example.com",
  name: "Example Person",
  groups: ["members"],
  status: "active",
  email_verified_at: "2026-07-19T10:00:00.000Z",
};
const environment = {
  id: "22222222-2222-4222-8222-222222222222",
  slug: "production",
  issuer: "https://auth.example.com",
};

await test("user lifecycle data contains the downstream identity without credentials", () => {
  const data = userLifecycleData(user);

  assert.deepEqual(data, {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      groups: user.groups,
      status: user.status,
      emailVerified: true,
    },
  });
  assert.equal("password" in data.user, false);
  assert.equal("passwordHash" in data.user, false);
});

await test("provisioning backfills use the signed webhook lifecycle envelope", () => {
  const body = createProvisioningEventBody(
    "user.created",
    user,
    environment,
    new Date("2026-07-19T10:30:00.000Z"),
  );

  assert.match(body.id, /^[0-9a-f-]{36}$/);
  assert.equal(body.type, "user.created");
  assert.equal(body.resourceType, "user");
  assert.equal(body.resourceId, user.id);
  assert.deepEqual(body.environment, environment);
  assert.equal(body.createdAt, "2026-07-19T10:30:00.000Z");
  assert.deepEqual(body.data, userLifecycleData(user));
});
