import type { PoolClient } from "pg";
import {
  exportJWK,
  generateKeyPair,
  importJWK,
  jwtVerify,
  decodeProtectedHeader,
  SignJWT,
  type JWK,
  type JWTPayload,
} from "jose";
import { query } from "../db.js";
import { decrypt, encrypt, randomId } from "./crypto.js";

interface SigningKeyRow {
  kid: string;
  algorithm: "RS256" | "ES256";
  public_jwk: JWK;
  encrypted_private_jwk: string;
}

export async function createSigningKey(
  client: PoolClient,
  workspaceId: string,
  environmentId: string,
): Promise<void> {
  const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
  const kid = randomId("kid", 8);
  const publicJwk = { ...(await exportJWK(publicKey)), kid, alg: "RS256", use: "sig" };
  const privateJwk = { ...(await exportJWK(privateKey)), kid, alg: "RS256", use: "sig" };
  await client.query(
    `INSERT INTO signing_keys
      (workspace_id, environment_id, kid, algorithm, public_jwk, encrypted_private_jwk, status, activates_at)
     VALUES ($1, $2, $3, 'RS256', $4, $5, 'active', now())`,
    [workspaceId, environmentId, kid, publicJwk, encrypt(JSON.stringify(privateJwk))],
  );
}

export async function listPublicKeys(environmentId?: string): Promise<JWK[]> {
  const rows = await query<{ public_jwk: JWK }>(
    `SELECT public_jwk FROM signing_keys
     WHERE status IN ('active', 'retiring') ${environmentId ? "AND environment_id = $1" : ""}
     ORDER BY created_at DESC`,
    environmentId ? [environmentId] : [],
  );
  return rows.map(({ public_jwk }) => public_jwk);
}

export async function signOAuthJwt(
  environmentId: string,
  issuer: string,
  audience: string | string[],
  subject: string,
  claims: JWTPayload,
  lifetimeSeconds: number,
): Promise<string> {
  const [row] = await query<SigningKeyRow>(
    `SELECT kid, algorithm, public_jwk, encrypted_private_jwk
     FROM signing_keys WHERE environment_id = $1 AND status = 'active' LIMIT 1`,
    [environmentId],
  );
  if (!row) throw new Error("No active signing key is configured.");
  const key = await importJWK(JSON.parse(decrypt(row.encrypted_private_jwk)) as JWK, row.algorithm);
  return new SignJWT(claims)
    .setProtectedHeader({ alg: row.algorithm, kid: row.kid, typ: "JWT" })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(subject)
    .setIssuedAt()
    .setJti(randomId("jti", 12))
    .setExpirationTime(`${lifetimeSeconds}s`)
    .sign(key);
}

export async function verifyOAuthJwt(token: string, issuer?: string, audience?: string) {
  const { kid } = decodeProtectedHeader(token);
  if (!kid) throw new Error("The token does not identify a signing key.");
  const [row] = await query<{ algorithm: "RS256" | "ES256"; public_jwk: JWK }>(
    "SELECT algorithm, public_jwk FROM signing_keys WHERE kid = $1 AND status IN ('active', 'retiring')",
    [kid],
  );
  if (!row) throw new Error("The signing key is not available.");
  const key = await importJWK(row.public_jwk, row.algorithm);
  return jwtVerify(token, key, {
    ...(issuer ? { issuer } : {}),
    ...(audience ? { audience } : {}),
  });
}
