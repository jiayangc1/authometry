import { query } from "../db.js";

export type ClaimDestination = "access_token" | "id_token" | "userinfo";

export interface ClaimUser {
  id: string;
  email: string;
  name: string;
  groups: string[];
  emailVerified: boolean;
  customClaims: Record<string, unknown>;
}

interface ClaimMappingRow {
  source_field: string;
  target_claim: string;
}

export const reservedClaims = new Set([
  "iss",
  "sub",
  "aud",
  "exp",
  "nbf",
  "iat",
  "jti",
  "nonce",
  "auth_time",
  "azp",
  "acr",
  "amr",
  "scope",
  "client_id",
  "token_use",
]);

export function readUserClaim(user: ClaimUser, sourceField: string): unknown {
  const standard: Record<string, unknown> = {
    "user.id": user.id,
    "user.email": user.email,
    "user.name": user.name,
    "user.groups": user.groups,
    "user.email_verified": user.emailVerified,
  };
  if (sourceField in standard) return standard[sourceField];
  const prefix = "user.custom_claims.";
  if (!sourceField.startsWith(prefix)) return undefined;
  return sourceField
    .slice(prefix.length)
    .split(".")
    .reduce<unknown>((value, key) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
      return (value as Record<string, unknown>)[key];
    }, user.customClaims);
}

export async function mappedClaims(
  environmentId: string,
  user: ClaimUser,
  destination: ClaimDestination,
): Promise<Record<string, unknown>> {
  const mappings = await query<ClaimMappingRow>(
    `SELECT source_field, target_claim FROM claim_mappings
     WHERE environment_id = $1 AND $2 = ANY(include_in) ORDER BY name`,
    [environmentId, destination],
  );
  return Object.fromEntries(
    mappings.flatMap((mapping) => {
      if (reservedClaims.has(mapping.target_claim)) return [];
      const value = readUserClaim(user, mapping.source_field);
      return value === undefined ? [] : [[mapping.target_claim, value]];
    }),
  );
}
