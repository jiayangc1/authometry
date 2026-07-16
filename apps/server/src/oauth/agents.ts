import type { Request } from "express";
import {
  calculateJwkThumbprint,
  decodeProtectedHeader,
  importJWK,
  jwtVerify,
  type JWK,
  type JWTPayload,
} from "jose";
import { query } from "../db.js";
import { ApiError } from "../lib/http.js";

export interface AgentIdentityRow {
  id: string;
  workspace_id: string;
  environment_id: string;
  application_id: string;
  agent_id: string;
  display_name: string;
  operator_id: string;
  public_jwk: JWK;
  capabilities: string[];
  allowed_resources: string[];
  may_receive_delegation: boolean;
  may_delegate: boolean;
  maximum_delegation_depth: number;
  maximum_authorization_seconds: number;
  status: "active" | "disabled";
}

export interface AgentAuthorizationDetails {
  type: "agent_action";
  actions: string[];
  locations: string[];
  resource: string;
  constraints?: Record<string, unknown>;
  purpose?: string;
}

export interface DelegationGrantRow {
  id: string;
  application_id: string;
  subject_user_id: string;
  actor_agent_id: string;
  parent_grant_id: string | null;
  resource: string;
  scopes: string[];
  authorization_details: AgentAuthorizationDetails[];
  purpose: string;
  task_id: string | null;
  dpop_jkt: string | null;
  delegation_depth: number;
  maximum_usage: number | null;
  usage_count: number;
  status: "active" | "completed" | "revoked" | "expired";
  expires_at: Date;
}

export async function findAgentForClient(clientId: string): Promise<AgentIdentityRow | undefined> {
  const [agent] = await query<AgentIdentityRow>(
    `SELECT g.* FROM agent_identities g
     JOIN oauth_applications a ON a.id = g.application_id
     WHERE a.client_id = $1`,
    [clientId],
  );
  return agent;
}

export async function findAgentById(
  environmentId: string,
  agentId: string,
): Promise<AgentIdentityRow | undefined> {
  const [agent] = await query<AgentIdentityRow>(
    "SELECT * FROM agent_identities WHERE environment_id = $1 AND agent_id = $2",
    [environmentId, agentId],
  );
  return agent;
}

export async function verifyAgentAssertion(
  assertion: string,
  clientId: string,
  audience: string,
): Promise<AgentIdentityRow> {
  const agent = await findAgentForClient(clientId);
  if (!agent || agent.status !== "active") {
    throw new ApiError(401, "invalid_client", "The agent is not registered or is disabled.");
  }
  try {
    const key = await importJWK(agent.public_jwk, agent.public_jwk.alg);
    const { payload } = await jwtVerify(assertion, key, {
      issuer: agent.agent_id,
      subject: agent.agent_id,
      audience,
      maxTokenAge: "5m",
    });
    if (!payload.jti || !payload.iat || !payload.exp || payload.exp > payload.iat + 300) {
      throw new Error("missing or excessive temporal claims");
    }
    const inserted = await query<{ jti: string }>(
      `INSERT INTO agent_assertion_jtis(agent_identity_id, jti, expires_at)
       VALUES ($1,$2,to_timestamp($3)) ON CONFLICT DO NOTHING RETURNING jti`,
      [agent.id, payload.jti, payload.exp],
    );
    if (!inserted.length) throw new Error("assertion replay");
  } catch {
    throw new ApiError(401, "invalid_client", "The agent assertion is invalid.");
  }
  return agent;
}

export async function verifyDpopProof(
  request: Request,
  expectedMethod: string,
  expectedUrl: string,
): Promise<{ jkt: string; payload: JWTPayload }> {
  const proof = request.get("dpop");
  if (!proof) throw new ApiError(400, "invalid_dpop_proof", "A DPoP proof is required.");
  try {
    const header = decodeProtectedHeader(proof);
    if (
      header.typ?.toLowerCase() !== "dpop+jwt" ||
      !header.jwk ||
      !["RS256", "ES256"].includes(header.alg ?? "") ||
      !["RSA", "EC"].includes(header.jwk.kty ?? "") ||
      ["d", "p", "q", "dp", "dq", "qi", "oth", "k"].some((field) =>
        Object.hasOwn(header.jwk!, field),
      )
    ) {
      throw new Error("invalid header");
    }
    const key = await importJWK(header.jwk, header.alg);
    const { payload } = await jwtVerify(proof, key, { maxTokenAge: "5m" });
    if (
      payload.htm !== expectedMethod.toUpperCase() ||
      payload.htu !== expectedUrl ||
      !payload.jti ||
      typeof payload.iat !== "number"
    ) {
      throw new Error("invalid binding");
    }
    const jkt = await calculateJwkThumbprint(header.jwk);
    const inserted = await query<{ jti: string }>(
      `INSERT INTO dpop_proof_jtis(jkt, jti, expires_at)
       VALUES ($1,$2,now() + interval '5 minutes') ON CONFLICT DO NOTHING RETURNING jti`,
      [jkt, payload.jti],
    );
    if (!inserted.length) throw new Error("proof replay");
    return { jkt, payload };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, "invalid_dpop_proof", "The DPoP proof is invalid.");
  }
}

export function maximumUsage(details: AgentAuthorizationDetails[]): number | null {
  const values = details
    .map((detail) => detail.constraints?.maximum_events ?? detail.constraints?.maximum_usage)
    .filter((value): value is number => typeof value === "number" && Number.isInteger(value));
  return values.length ? Math.min(...values) : null;
}

export function isLocationWithinResource(location: string, resource: string): boolean {
  const target = new URL(location);
  const boundary = new URL(resource);
  const basePath = boundary.pathname.endsWith("/") ? boundary.pathname : `${boundary.pathname}/`;
  return (
    target.origin === boundary.origin &&
    (target.pathname === boundary.pathname || target.pathname.startsWith(basePath))
  );
}

export function actionCoveredByScopes(action: string, scopes: string[]): boolean {
  return scopes.some((scope) => scope === action || scope.endsWith(`:${action}`));
}

export function reduceAuthorizationDetails(
  details: AgentAuthorizationDetails[],
  scopes: string[],
): AgentAuthorizationDetails[] {
  return details
    .map((detail) => ({
      ...detail,
      actions: detail.actions.filter((action) => actionCoveredByScopes(action, scopes)),
    }))
    .filter((detail) => detail.actions.length > 0);
}
