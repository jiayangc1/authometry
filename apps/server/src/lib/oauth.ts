import { decodeJwt, jwtVerify } from "jose";
import { transaction } from "../db.js";
import { mappedClaims, type ClaimUser } from "./claims.js";
import { hashToken, randomToken, sha256Base64Url } from "./crypto.js";
import { signOAuthJwt } from "./signing.js";

export function verifyPkce(verifier: string, challenge: string, method: string): boolean {
  return method === "S256" && sha256Base64Url(verifier) === challenge;
}

export interface TokenApplication {
  id: string;
  workspace_id: string;
  environment_id: string;
  client_id: string;
  access_token_lifetime_seconds: number;
  refresh_token_lifetime_seconds: number;
  rotate_refresh_tokens: boolean;
}

export async function issueTokenSet({
  application,
  issuer,
  user,
  scopes,
  nonce,
  includeRefreshToken,
}: {
  application: TokenApplication;
  issuer: string;
  user?: ClaimUser & { authTime: Date };
  scopes: string[];
  nonce?: string;
  includeRefreshToken: boolean;
}): Promise<Record<string, unknown>> {
  const subject = user?.id ?? application.client_id;
  const accessClaims = user
    ? await mappedClaims(application.environment_id, user, "access_token")
    : {};
  const accessToken = await signOAuthJwt(
    application.environment_id,
    issuer,
    application.client_id,
    subject,
    {
      scope: scopes.join(" "),
      client_id: application.client_id,
      token_use: "access",
      ...accessClaims,
      ...(user && scopes.includes("email") ? { email: user.email } : {}),
      ...(user && scopes.includes("profile") ? { name: user.name, groups: user.groups } : {}),
    },
    application.access_token_lifetime_seconds,
  );

  const result: Record<string, unknown> = {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: application.access_token_lifetime_seconds,
    scope: scopes.join(" "),
  };

  if (user && scopes.includes("openid")) {
    const idClaims = await mappedClaims(application.environment_id, user, "id_token");
    result.id_token = await signOAuthJwt(
      application.environment_id,
      issuer,
      application.client_id,
      user.id,
      {
        token_use: "id",
        ...idClaims,
        email: scopes.includes("email") ? user.email : undefined,
        email_verified: scopes.includes("email") ? user.emailVerified : undefined,
        name: scopes.includes("profile") ? user.name : undefined,
        auth_time: Math.floor(user.authTime.getTime() / 1000),
        ...(nonce ? { nonce } : {}),
      },
      application.access_token_lifetime_seconds,
    );
  }

  if (includeRefreshToken) {
    const refresh = randomToken(48);
    await transaction(async (client) => {
      const family = await client.query<{ id: string }>(
        `INSERT INTO refresh_token_families
          (workspace_id, environment_id, application_id, user_id, scopes, expires_at)
         VALUES ($1, $2, $3, $4, $5, now() + ($6 * interval '1 second')) RETURNING id`,
        [
          application.workspace_id,
          application.environment_id,
          application.id,
          user?.id ?? null,
          scopes,
          application.refresh_token_lifetime_seconds,
        ],
      );
      await client.query(
        `INSERT INTO refresh_tokens(family_id, token_hash, expires_at)
         VALUES ($1, $2, now() + ($3 * interval '1 second'))`,
        [family.rows[0]?.id, hashToken(refresh), application.refresh_token_lifetime_seconds],
      );
    });
    result.refresh_token = refresh;
  }
  return result;
}

export function inspectJwtWithoutVerification(token: string): ReturnType<typeof decodeJwt> {
  return decodeJwt(token);
}

export { jwtVerify };
