import assert from "node:assert/strict";
import test from "node:test";
import { pool } from "./db.js";
import { expireStaleAuthorizationTraces } from "./workers.js";

await test("stale authorization traces are closed after their request expires", async () => {
  const originalQuery = pool.query.bind(pool);
  let statement = "";
  Object.assign(pool, {
    query: async (text: string) => {
      statement = text;
      return { rows: [] };
    },
  });

  try {
    await expireStaleAuthorizationTraces();
  } finally {
    Object.assign(pool, { query: originalQuery });
  }

  assert.match(statement, /SET status = 'warning'/);
  assert.match(statement, /event_type = 'authorization_request_expired'/);
  assert.match(statement, /started_at <= now\(\) - interval '10 minutes'/);
  assert.match(statement, /p\.expires_at > now\(\)/);
  assert.match(statement, /WHERE t\.status = 'pending'/);
});
