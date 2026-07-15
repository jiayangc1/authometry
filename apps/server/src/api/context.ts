import type { NextFunction, Request, Response } from "express";
import { query } from "../db.js";
import { ApiError } from "../lib/http.js";

declare global {
  namespace Express {
    interface Request {
      environment?: {
        id: string;
        workspaceId: string;
        slug: string;
        name: string;
        kind: string;
        issuer: string;
      };
    }
  }
}

export async function requireEnvironment(
  request: Request,
  _response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!request.admin) throw new ApiError(401, "authentication_required", "Sign in to continue.");
    const requested =
      request.get("x-authometry-environment") ?? String(request.query.environment ?? "");
    const [environment] = await query<{
      id: string;
      workspace_id: string;
      slug: string;
      name: string;
      kind: string;
      issuer: string;
    }>(
      `SELECT id, workspace_id, slug, name, kind, issuer FROM environments
       WHERE workspace_id = $1 AND ($2 = '' AND is_default = true OR $2 <> '' AND (id::text = $2 OR slug = $2))
       ORDER BY is_default DESC LIMIT 1`,
      [request.admin.workspaceId, requested],
    );
    if (!environment)
      throw new ApiError(404, "environment_not_found", "The selected environment was not found.");
    request.environment = {
      id: environment.id,
      workspaceId: environment.workspace_id,
      slug: environment.slug,
      name: environment.name,
      kind: environment.kind,
      issuer: environment.issuer,
    };
    next();
  } catch (error) {
    next(error);
  }
}

export function auditMutation(request: Request, response: Response, next: NextFunction): void {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    next();
    return;
  }
  response.once("finish", () => {
    const environment = request.environment;
    const admin = request.admin;
    if (!environment || !admin || response.statusCode < 200 || response.statusCode >= 400) return;
    const normalizedPath = request.path.replaceAll(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, ":id");
    void query(
      `INSERT INTO audit_events
        (workspace_id, environment_id, category, severity, event_type, summary, actor_type,
         actor_id, actor_name, source_ip, user_agent, resource_type, changes)
       VALUES ($1,$2,'configuration','info','api.mutation',$3,'admin',$4,$5,$6,$7,$8,$9)`,
      [
        environment.workspaceId,
        environment.id,
        `${request.method} ${normalizedPath}`,
        admin.userId,
        admin.email,
        request.ip,
        request.get("user-agent") ?? null,
        normalizedPath.split("/").filter(Boolean)[0] ?? "api",
        { method: request.method, path: normalizedPath, requestId: request.id },
      ],
    ).catch((error: unknown) => {
      console.error("audit_mutation", { requestId: request.id, error });
    });
  });
  next();
}
