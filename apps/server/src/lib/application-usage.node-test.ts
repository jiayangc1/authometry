import assert from "node:assert/strict";
import test from "node:test";
import { recordApplicationUsage, recordPortalApplicationLaunch } from "./application-usage.js";

await test("successful OAuth activity updates the application's last-used timestamp", async () => {
  const calls: Array<{ text: string; values: unknown[] | undefined }> = [];

  await recordApplicationUsage("application-1", async (text, values) => {
    calls.push({ text, values });
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.text, /UPDATE oauth_applications SET last_used_at = now\(\)/);
  assert.deepEqual(calls[0]!.values, ["application-1"]);
});

await test("portal launch activity is independent from direct application assignments", async () => {
  const calls: Array<{ text: string; values: unknown[] | undefined }> = [];

  await recordPortalApplicationLaunch(
    {
      workspaceId: "workspace-1",
      environmentId: "environment-1",
      applicationId: "application-1",
      userId: "user-1",
    },
    async (text, values) => {
      calls.push({ text, values });
    },
  );

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.text, /INSERT INTO user_application_launches/);
  assert.match(calls[0]!.text, /ON CONFLICT \(environment_id, application_id, user_id\)/);
  assert.doesNotMatch(calls[0]!.text, /user_application_assignments/);
  assert.deepEqual(calls[0]!.values, ["workspace-1", "environment-1", "application-1", "user-1"]);
});
