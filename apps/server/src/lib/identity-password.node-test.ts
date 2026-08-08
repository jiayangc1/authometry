import assert from "node:assert/strict";
import test from "node:test";
import type { QueryResultRow } from "pg";
import { identityPasswordSchema, setIdentityUserPassword } from "./identity-password.js";

function result<T extends QueryResultRow>(rows: QueryResultRow[]): { rows: T[] } {
  return { rows: rows as unknown as T[] };
}

await test("identity passwords require between 12 and 128 characters", () => {
  assert.equal(identityPasswordSchema.safeParse("short").success, false);
  assert.equal(identityPasswordSchema.safeParse("a".repeat(12)).success, true);
  assert.equal(identityPasswordSchema.safeParse("a".repeat(129)).success, false);
});

await test("an administrator password reset revokes every active session and token family", async () => {
  const calls: Array<{ text: string; values: unknown[] | undefined }> = [];
  const client = {
    async query<T extends QueryResultRow>(text: string, values?: unknown[]) {
      calls.push({ text, values });
      if (text.startsWith("UPDATE identity_users")) return result<T>([{ id: "user-1" }]);
      if (text.startsWith("UPDATE user_sessions")) {
        return result<T>([
          { refresh_family_id: "00000000-0000-0000-0000-000000000001" },
          { refresh_family_id: "00000000-0000-0000-0000-000000000001" },
          { refresh_family_id: null },
        ]);
      }
      return result<T>([]);
    },
  };

  const updated = await setIdentityUserPassword(client, {
    userId: "user-1",
    passwordHash: "hash",
    revokedReason: "password_reset_by_admin",
  });

  assert.equal(updated, true);
  assert.equal(calls.length, 4);
  assert.deepEqual(calls[1]?.values, ["user-1", null]);
  assert.deepEqual(calls[2]?.values, [
    ["00000000-0000-0000-0000-000000000001"],
    "password_reset_by_admin",
  ]);
});

await test("a password change can preserve the current portal session", async () => {
  const calls: Array<{ text: string; values: unknown[] | undefined }> = [];
  const client = {
    async query<T extends QueryResultRow>(text: string, values?: unknown[]) {
      calls.push({ text, values });
      if (text.startsWith("UPDATE identity_users")) return result<T>([{ id: "user-1" }]);
      return result<T>([]);
    },
  };

  await setIdentityUserPassword(client, {
    userId: "user-1",
    passwordHash: "hash",
    exceptSessionId: "00000000-0000-0000-0000-000000000002",
    revokedReason: "password_changed",
  });

  assert.deepEqual(calls[1]?.values, ["user-1", "00000000-0000-0000-0000-000000000002"]);
  assert.equal(calls.length, 2);
});
