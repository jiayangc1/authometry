import type { Request, Response } from "express";
import { query } from "../db.js";
import { ApiError } from "../lib/http.js";
import { constantTimeEqual, hashToken } from "../lib/crypto.js";
import type { OAuthApplicationRow } from "./types.js";

export async function findApplicationByClientId(
  clientId: string,
): Promise<OAuthApplicationRow | undefined> {
  const [application] = await query<OAuthApplicationRow>(
    `SELECT a.*, e.issuer, e.slug AS environment_slug
     FROM oauth_applications a JOIN environments e ON e.id = a.environment_id
     WHERE a.client_id = $1 AND e.status = 'active'`,
    [clientId],
  );
  return application;
}

function normalizedIssuerPath(issuer: string): string {
  const path = new URL(issuer).pathname.replace(/\/$/, "");
  return path === "/" ? "" : path;
}

export function assertApplicationRoute(application: OAuthApplicationRow, request: Request): void {
  const requestPath = new URL(request.originalUrl, application.issuer).pathname;
  const marker = requestPath.indexOf("/oauth/");
  if (marker < 0 || requestPath.slice(0, marker) !== normalizedIssuerPath(application.issuer)) {
    throw new ApiError(400, "invalid_client", "The OAuth client is not available at this issuer.");
  }
}

function parseBasicAuthorization(
  request: Request,
): { clientId: string; secret: string } | undefined {
  const value = request.get("authorization");
  if (!value?.startsWith("Basic ")) return undefined;
  try {
    const decoded = Buffer.from(value.slice(6), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator < 0) return undefined;
    return {
      clientId: decodeURIComponent(decoded.slice(0, separator)),
      secret: decodeURIComponent(decoded.slice(separator + 1)),
    };
  } catch {
    return undefined;
  }
}

export async function authenticateClient(request: Request): Promise<OAuthApplicationRow> {
  const basic = parseBasicAuthorization(request);
  const clientId = basic?.clientId ?? String(request.body.client_id ?? "");
  const suppliedSecret = basic?.secret ?? String(request.body.client_secret ?? "");
  const application = await findApplicationByClientId(clientId);
  if (!application || application.status !== "active") {
    throw new ApiError(401, "invalid_client", "Client authentication failed.");
  }
  assertApplicationRoute(application, request);
  if (application.token_endpoint_auth_method === "none") {
    if (suppliedSecret)
      throw new ApiError(401, "invalid_client", "This public client does not use a client secret.");
    return application;
  }
  if (application.token_endpoint_auth_method === "client_secret_basic" && !basic) {
    throw new ApiError(401, "invalid_client", "This client must authenticate with HTTP Basic.");
  }
  if (application.token_endpoint_auth_method === "client_secret_post" && basic) {
    throw new ApiError(401, "invalid_client", "This client must authenticate in the request body.");
  }
  if (!suppliedSecret) throw new ApiError(401, "invalid_client", "Client authentication failed.");
  const credentials = await query<{ secret_hash: string }>(
    `SELECT secret_hash FROM client_credentials
     WHERE application_id = $1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())`,
    [application.id],
  );
  const suppliedHash = hashToken(suppliedSecret);
  if (!credentials.some(({ secret_hash }) => constantTimeEqual(secret_hash, suppliedHash))) {
    throw new ApiError(401, "invalid_client", "Client authentication failed.");
  }
  await query(
    "UPDATE client_credentials SET last_used_at = now() WHERE application_id = $1 AND secret_hash = $2",
    [application.id, suppliedHash],
  );
  return application;
}

export function oauthError(
  response: Response,
  status: number,
  error: string,
  description: string,
): void {
  response.set("Cache-Control", "no-store");
  response.set("Pragma", "no-cache");
  response.status(status).json({ error, error_description: description });
}
