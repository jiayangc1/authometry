import assert from "node:assert/strict";
import test from "node:test";
import { pool } from "../db.js";
import { TraceRecorder } from "./trace.js";

await test("trace records persist an identity resolved after the request starts", async () => {
  const originalQuery = pool.query.bind(pool);
  let insertedValues: unknown[] | undefined;
  Object.assign(pool, {
    query: async (_text: string, values: unknown[]) => {
      insertedValues = values;
      return { rows: [] };
    },
  });

  try {
    const trace = new TraceRecorder({
      workspaceId: "workspace-1",
      environmentId: "environment-1",
      endpoint: "/oauth/token",
      method: "POST",
      eventType: "token_request",
      applicationId: "application-1",
      applicationName: "CamSaver",
      clientId: "client-1",
      grantType: "authorization_code",
      request: { query: {}, headers: {} },
    });
    const user = { id: "admin-1", email: "owner@example.com", name: "Owner" };

    trace.identifyUser(user);
    const finished = await trace.finish("success");

    assert.deepEqual(finished.user, user);
    assert.equal(insertedValues?.[9], user.id);
    assert.deepEqual(JSON.parse(String(insertedValues?.[10])), user);
  } finally {
    Object.assign(pool, { query: originalQuery });
  }
});
