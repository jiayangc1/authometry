import type { QueryResultRow } from "pg";
import { z } from "zod";

export const identityPasswordSchema = z.string().min(12).max(128);

interface PasswordClient {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: T[] }>;
}

export async function setIdentityUserPassword(
  client: PasswordClient,
  input: {
    userId: string;
    passwordHash: string;
    exceptSessionId?: string;
    revokedReason: "password_changed" | "password_reset_by_admin";
  },
): Promise<boolean> {
  const updated = await client.query<{ id: string }>(
    "UPDATE identity_users SET password_hash = $2, updated_at = now() WHERE id = $1 RETURNING id",
    [input.userId, input.passwordHash],
  );
  if (!updated.rows[0]) return false;

  const revoked = await client.query<{ refresh_family_id: string | null }>(
    `UPDATE user_sessions SET status = 'revoked', revoked_at = now()
     WHERE user_id = $1 AND status = 'active'
       AND ($2::uuid IS NULL OR id <> $2::uuid)
     RETURNING refresh_family_id`,
    [input.userId, input.exceptSessionId ?? null],
  );
  const familyIds = [
    ...new Set(
      revoked.rows.flatMap(({ refresh_family_id: familyId }) => (familyId ? [familyId] : [])),
    ),
  ];
  if (familyIds.length) {
    await client.query(
      `UPDATE refresh_token_families SET status = 'revoked', revoked_reason = $2
       WHERE id = ANY($1::uuid[])`,
      [familyIds, input.revokedReason],
    );
    await client.query(
      "UPDATE refresh_tokens SET revoked_at = now() WHERE family_id = ANY($1::uuid[])",
      [familyIds],
    );
  }
  return true;
}
