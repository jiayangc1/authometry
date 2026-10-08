import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import {
  constantTimeEqual,
  hashToken,
  randomId,
  randomToken,
  sha256Base64Url,
} from "../lib/crypto.js";
import { ApiError, asyncRoute } from "../lib/http.js";
import { requireAdmin, requireCsrf } from "./admin.js";

const cliTokenScopes = ["config:read", "config:write", "applications:read", "applications:write"];
const cliTokenLifetimeDays = 90;

export const cliAuthRouter = Router();

cliAuthRouter.post(
  "/authorize",
  requireAdmin,
  requireCsrf,
  asyncRoute(async (request, response) => {
    // Only an interactive dashboard session may approve a CLI; a token cannot mint another token.
    if (request.admin!.tokenScopes) {
      throw new ApiError(403, "session_required", "Sign in to the dashboard to authorize the CLI.");
    }
    const input = z
      .object({
        codeChallenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
        deviceName: z.string().trim().min(1).max(80),
      })
      .parse(request.body);
    const code = randomToken(32);
    await query("DELETE FROM cli_authorization_codes WHERE expires_at < now() - interval '1 hour'");
    await query(
      `INSERT INTO cli_authorization_codes
        (code_hash, code_challenge, workspace_id, admin_user_id, device_name, expires_at)
       VALUES ($1,$2,$3,$4,$5,now() + interval '60 seconds')`,
      [
        hashToken(code),
        input.codeChallenge,
        request.admin!.workspaceId,
        request.admin!.userId,
        input.deviceName,
      ],
    );
    response.status(201).json({ code });
  }),
);

cliAuthRouter.post(
  "/token",
  asyncRoute(async (request, response) => {
    const input = z
      .object({
        code: z.string().min(1).max(200),
        codeVerifier: z.string().min(43).max(128),
      })
      .parse(request.body);
    const invalid = new ApiError(
      400,
      "invalid_grant",
      "The login code is invalid or expired. Run authometry login again.",
    );
    const [grant] = await query<{
      code_challenge: string;
      workspace_id: string;
      admin_user_id: string;
      device_name: string;
    }>(
      `UPDATE cli_authorization_codes SET consumed_at = now()
       WHERE code_hash = $1 AND consumed_at IS NULL AND expires_at > now()
       RETURNING code_challenge, workspace_id, admin_user_id, device_name`,
      [hashToken(input.code)],
    );
    if (!grant || !constantTimeEqual(sha256Base64Url(input.codeVerifier), grant.code_challenge)) {
      throw invalid;
    }
    const [member] = await query<{ email: string; workspace_name: string; workspace_slug: string }>(
      `SELECT u.email, w.name AS workspace_name, w.slug AS workspace_slug
       FROM workspace_memberships m
       JOIN admin_users u ON u.id = m.admin_user_id
       JOIN workspaces w ON w.id = m.workspace_id
       WHERE m.workspace_id = $1 AND m.admin_user_id = $2`,
      [grant.workspace_id, grant.admin_user_id],
    );
    if (!member) throw invalid;
    const token = randomId("amt", 36);
    const [record] = await query<{ expires_at: Date }>(
      `INSERT INTO personal_access_tokens
        (workspace_id, admin_user_id, name, prefix, token_hash, scopes, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,now() + ($7 * interval '1 day'))
       RETURNING expires_at`,
      [
        grant.workspace_id,
        grant.admin_user_id,
        `CLI on ${grant.device_name}`,
        token.slice(0, 16),
        hashToken(token),
        cliTokenScopes,
        cliTokenLifetimeDays,
      ],
    );
    response.status(201).json({
      token,
      expiresAt: record?.expires_at,
      email: member.email,
      workspace: { name: member.workspace_name, slug: member.workspace_slug },
    });
  }),
);

cliAuthRouter.post(
  "/revoke",
  asyncRoute(async (request, response) => {
    const bearer = request.get("authorization")?.match(/^Bearer (amt_.+)$/)?.[1];
    if (bearer) {
      await query(
        "UPDATE personal_access_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL",
        [hashToken(bearer)],
      );
    }
    response.status(204).end();
  }),
);
