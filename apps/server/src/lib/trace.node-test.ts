import assert from "node:assert/strict";
import test from "node:test";
import { pool } from "../db.js";
import { TraceRecorder } from "./trace.js";

async function captureTraceInsert(
  identify: (trace: TraceRecorder) => void,
): Promise<{ insertedValues: unknown[]; finished: Awaited<ReturnType<TraceRecorder["finish"]>> }> {
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
    identify(trace);
    const finished = await trace.finish("success");
    assert.ok(insertedValues);
    return { insertedValues, finished };
  } finally {
    Object.assign(pool, { query: originalQuery });
  }
}

await test("trace records persist an identity user resolved after the request starts", async () => {
  const user = { id: "user-1", email: "user@example.com", name: "User" };
  const { insertedValues, finished } = await captureTraceInsert((trace) =>
    trace.identifyUser(user),
  );

  assert.deepEqual(finished.user, user);
  assert.equal(insertedValues[9], user.id);
  assert.deepEqual(JSON.parse(String(insertedValues[10])), user);
});

await test("trace snapshots an admin without writing it to the identity-user foreign key", async () => {
  const admin = { id: "admin-1", email: "owner@example.com", name: "Owner" };
  const { insertedValues, finished } = await captureTraceInsert((trace) =>
    trace.identifyAdmin(admin),
  );

  assert.deepEqual(finished.user, admin);
  assert.equal(insertedValues[9], null);
  assert.deepEqual(JSON.parse(String(insertedValues[10])), admin);
});
