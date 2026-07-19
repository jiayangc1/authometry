import { query } from "../db.js";
import { decrypt, hashToken } from "./crypto.js";
import { verifyTotp } from "./mfa.js";

export async function verifyIdentityMfa(
  userId: string,
  encryptedSecret: string | null,
  code: string,
): Promise<boolean> {
  if (!encryptedSecret) return false;
  if (verifyTotp(decrypt(encryptedSecret), code)) return true;

  const normalizedRecoveryCode = code.trim().toLowerCase();
  if (!/^[a-f0-9]{5}-[a-f0-9]{5}$/.test(normalizedRecoveryCode)) return false;
  const [consumed] = await query<{ id: string }>(
    `UPDATE identity_mfa_recovery_codes SET used_at = now()
     WHERE id = (
       SELECT id FROM identity_mfa_recovery_codes
       WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL
       FOR UPDATE SKIP LOCKED LIMIT 1
     ) RETURNING id`,
    [userId, hashToken(normalizedRecoveryCode)],
  );
  return Boolean(consumed);
}
