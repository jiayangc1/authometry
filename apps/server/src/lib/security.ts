import ipaddr from "ipaddr.js";
import { lookup } from "node:dns/promises";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { env } from "../env.js";

const accessKey = new TextEncoder().encode(env.ACCESS_TOKEN_SECRET);
const refreshKey = new TextEncoder().encode(env.REFRESH_TOKEN_SECRET);

export interface AdminAccessClaims extends JWTPayload {
  type: "admin_access";
  workspaceId: string;
  role: string;
  email: string;
}

export async function signAdminAccessToken(claims: {
  userId: string;
  workspaceId: string;
  role: string;
  email: string;
}): Promise<string> {
  return new SignJWT({
    type: "admin_access",
    workspaceId: claims.workspaceId,
    role: claims.role,
    email: claims.email,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.userId)
    .setIssuedAt()
    .setExpirationTime("10m")
    .setIssuer(env.PUBLIC_ORIGIN)
    .setAudience("authometry-admin")
    .sign(accessKey);
}

export async function verifyAdminAccessToken(token: string): Promise<AdminAccessClaims> {
  const result = await jwtVerify(token, accessKey, {
    issuer: env.PUBLIC_ORIGIN,
    audience: "authometry-admin",
  });
  if (result.payload.type !== "admin_access") throw new Error("Unexpected token type.");
  return result.payload as AdminAccessClaims;
}

export async function signAdminRefreshEnvelope(sessionId: string, token: string): Promise<string> {
  return new SignJWT({ type: "admin_refresh", token })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(sessionId)
    .setIssuedAt()
    .setExpirationTime("30d")
    .setIssuer(env.PUBLIC_ORIGIN)
    .setAudience("authometry-admin-refresh")
    .sign(refreshKey);
}

export async function verifyAdminRefreshEnvelope(
  value: string,
): Promise<{ sessionId: string; token: string }> {
  const { payload } = await jwtVerify(value, refreshKey, {
    issuer: env.PUBLIC_ORIGIN,
    audience: "authometry-admin-refresh",
  });
  if (payload.type !== "admin_refresh" || !payload.sub || typeof payload.token !== "string") {
    throw new Error("Unexpected refresh token.");
  }
  return { sessionId: payload.sub, token: payload.token };
}

export function validateOutboundUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("Outbound URLs must use HTTPS.");
  if (url.username || url.password) throw new Error("Outbound URLs cannot contain credentials.");
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".local"))
    throw new Error("Local hosts are not allowed.");
  if (ipaddr.isValid(hostname)) {
    const range = ipaddr.parse(hostname).range();
    if (range !== "unicast") throw new Error("Private and reserved addresses are not allowed.");
  }
  return url;
}

export async function assertSafeOutboundUrl(value: string): Promise<URL> {
  const url = validateOutboundUrl(value);
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length) throw new Error("The outbound hostname did not resolve.");
  for (const { address } of addresses) {
    const range = ipaddr.parse(address).range();
    if (range !== "unicast")
      throw new Error("The outbound hostname resolves to a private or reserved address.");
  }
  return url;
}
