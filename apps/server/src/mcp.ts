import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Router, type NextFunction, type Request, type Response } from "express";
import type { QueryResultRow } from "pg";
import { z } from "zod";
import { requireAdmin } from "./auth/admin.js";
import { query } from "./db.js";
import { ApiError } from "./lib/http.js";

const serverVersion = "0.1.1";
const requiredScope = "mcp:read";

type Query = <T extends QueryResultRow>(text: string, values?: unknown[]) => Promise<T[]>;

export interface McpPrincipal {
  userId: string;
  email: string;
  workspaceId: string;
  role: string;
}

interface EnvironmentRow extends QueryResultRow {
  id: string;
  slug: string;
  name: string;
  kind: string;
  issuer: string;
  is_default: boolean;
  status: string;
}

function jsonResult(value: Record<string, unknown>) {
  const structuredContent = JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  return {
    content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent,
  };
}

async function resolveEnvironment(
  execute: Query,
  workspaceId: string,
  selector?: string,
): Promise<EnvironmentRow> {
  const [environment] = await execute<EnvironmentRow>(
    `SELECT id, slug, name, kind, issuer, is_default, status
     FROM environments
     WHERE workspace_id = $1
       AND ($2 = '' AND is_default = true OR $2 <> '' AND (id::text = $2 OR slug = $2))
     ORDER BY is_default DESC LIMIT 1`,
    [workspaceId, selector ?? ""],
  );
  if (!environment) {
    throw new Error(`Environment ${selector ? `"${selector}" ` : ""}was not found.`);
  }
  return environment;
}

const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

export function createAuthometryMcpServer(principal: McpPrincipal, execute: Query = query) {
  const server = new McpServer({
    name: "authometry",
    title: "Authometry",
    version: serverVersion,
  });

  server.registerTool(
    "list_environments",
    {
      title: "List environments",
      description: "List Authometry environments available in the authenticated workspace.",
      annotations: readOnlyAnnotations,
    },
    async () => {
      const environments = await execute<EnvironmentRow>(
        `SELECT id, slug, name, kind, issuer, is_default, status
         FROM environments WHERE workspace_id = $1 ORDER BY is_default DESC, name`,
        [principal.workspaceId],
      );
      return jsonResult({ data: environments, total: environments.length });
    },
  );

  server.registerTool(
    "list_applications",
    {
      title: "List OAuth applications",
      description:
        "List OAuth applications in an environment. The default environment is used when none is selected.",
      inputSchema: {
        environment: z.string().trim().min(1).optional().describe("Environment slug or UUID"),
        search: z.string().trim().max(200).default("").describe("Name, slug, or client ID search"),
        type: z.enum(["web", "spa", "native", "machine", "device"]).optional(),
        status: z.enum(["active", "disabled"]).optional(),
        limit: z.number().int().min(1).max(100).default(50),
      },
      annotations: readOnlyAnnotations,
    },
    async ({ environment: selector, search, type, status, limit }) => {
      const environment = await resolveEnvironment(execute, principal.workspaceId, selector);
      const applications = await execute(
        `SELECT id, name, slug, client_id, type, status, description, redirect_uris,
                grant_types, token_endpoint_auth_method, require_pkce, require_consent,
                allowed_scopes, access_token_lifetime_seconds, refresh_token_lifetime_seconds,
                ownership, last_used_at, created_at, updated_at
         FROM oauth_applications
         WHERE environment_id = $1
           AND ($2 = '' OR name ILIKE '%' || $2 || '%' OR slug ILIKE '%' || $2 || '%'
                OR client_id ILIKE '%' || $2 || '%')
           AND ($3 = '' OR type = $3)
           AND ($4 = '' OR status = $4)
         ORDER BY updated_at DESC LIMIT $5`,
        [environment.id, search, type ?? "", status ?? "", limit],
      );
      return jsonResult({ environment, data: applications, total: applications.length });
    },
  );

  server.registerTool(
    "list_scopes",
    {
      title: "List resource scopes",
      description:
        "List OAuth resource scopes in an environment, including sensitivity and application usage.",
      inputSchema: {
        environment: z.string().trim().min(1).optional().describe("Environment slug or UUID"),
        search: z.string().trim().max(200).default(""),
        sensitivity: z.enum(["standard", "sensitive", "restricted"]).optional(),
      },
      annotations: readOnlyAnnotations,
    },
    async ({ environment: selector, search, sensitivity }) => {
      const environment = await resolveEnvironment(execute, principal.workspaceId, selector);
      const scopes = await execute(
        `SELECT s.id, s.name, s.display_name, s.description, s.consent_description,
                s.sensitivity, s.is_system, s.ownership, s.version, s.created_at, s.updated_at,
                (SELECT count(*)::integer FROM oauth_applications a
                 WHERE a.environment_id = s.environment_id AND s.name = ANY(a.allowed_scopes))
                  AS application_count
         FROM resource_scopes s
         WHERE s.environment_id = $1
           AND ($2 = '' OR s.name ILIKE '%' || $2 || '%' OR s.display_name ILIKE '%' || $2 || '%')
           AND ($3 = '' OR s.sensitivity = $3)
         ORDER BY s.is_system DESC, s.name`,
        [environment.id, search, sensitivity ?? ""],
      );
      return jsonResult({ environment, data: scopes, total: scopes.length });
    },
  );

  server.registerTool(
    "list_authorization_traces",
    {
      title: "List authorization traces",
      description:
        "List recent redacted authorization traces for diagnosing OAuth and OIDC requests.",
      inputSchema: {
        environment: z.string().trim().min(1).optional().describe("Environment slug or UUID"),
        search: z.string().trim().max(200).default(""),
        status: z.enum(["success", "denied", "error", "warning", "pending"]).optional(),
        application: z
          .string()
          .trim()
          .max(200)
          .default("")
          .describe("Application UUID or client ID"),
        limit: z.number().int().min(1).max(100).default(50),
      },
      annotations: readOnlyAnnotations,
    },
    async ({ environment: selector, search, status, application, limit }) => {
      const environment = await resolveEnvironment(execute, principal.workspaceId, selector);
      const traces = await execute(
        `SELECT id, request_id, status, event_type, application_id, application_name, client_id,
                user_snapshot, grant_type, endpoint, method, duration_ms, oauth_error, started_at
         FROM authorization_traces
         WHERE environment_id = $1
           AND ($2 = '' OR status = $2)
           AND ($3 = '' OR application_id::text = $3 OR client_id = $3)
           AND ($4 = '' OR request_id ILIKE '%' || $4 || '%' OR client_id ILIKE '%' || $4 || '%'
                OR application_name ILIKE '%' || $4 || '%'
                OR user_snapshot->>'email' ILIKE '%' || $4 || '%')
         ORDER BY started_at DESC LIMIT $5`,
        [environment.id, status ?? "", application, search, limit],
      );
      return jsonResult({ environment, data: traces, total: traces.length });
    },
  );

  server.registerTool(
    "get_authorization_trace",
    {
      title: "Get an authorization trace",
      description:
        "Get one redacted authorization trace, including its explanation and evaluation steps.",
      inputSchema: {
        traceId: z.string().trim().min(1).describe("Trace UUID or request ID"),
        environment: z.string().trim().min(1).optional().describe("Environment slug or UUID"),
      },
      annotations: readOnlyAnnotations,
    },
    async ({ traceId, environment: selector }) => {
      const environment = await resolveEnvironment(execute, principal.workspaceId, selector);
      const [trace] = await execute(
        `SELECT id, request_id, status, event_type, application_id, application_name, client_id,
                user_id, user_snapshot, grant_type, endpoint, method, started_at, completed_at,
                duration_ms, oauth_error, explanation, steps, redacted_request, created_at
         FROM authorization_traces
         WHERE environment_id = $1 AND (id::text = $2 OR request_id = $2)`,
        [environment.id, traceId],
      );
      if (!trace) throw new Error(`Authorization trace "${traceId}" was not found.`);
      return jsonResult({ environment, trace });
    },
  );

  return server;
}

function authenticateMcp(request: Request, response: Response, next: NextFunction): void {
  const bearer = request.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!bearer?.startsWith("amt_")) {
    response.set("WWW-Authenticate", 'Bearer realm="authometry-mcp"');
    next(new ApiError(401, "authentication_required", "An Authometry API token is required."));
    return;
  }
  void requireAdmin(request, response, (error?: unknown) => {
    if (error) response.set("WWW-Authenticate", 'Bearer realm="authometry-mcp"');
    next(error);
  });
}

export const mcpRouter = Router();
mcpRouter.use(authenticateMcp);
mcpRouter.use((request, _response, next) => {
  if (request.admin?.tokenScopes?.includes(requiredScope)) {
    next();
    return;
  }
  next(new ApiError(403, "insufficient_scope", `The API token requires ${requiredScope}.`));
});

export async function handleMcpRequest(
  principal: McpPrincipal,
  request: Request,
  response: Response,
  execute: Query = query,
): Promise<void> {
  const server = createAuthometryMcpServer(principal, execute);
  const transport = new StreamableHTTPServerTransport({
    enableJsonResponse: true,
  });
  try {
    // SDK 1.x's Node transport declaration is structurally narrower than its Transport declaration
    // when exactOptionalPropertyTypes is enabled, although it implements that interface at runtime.
    await server.connect(transport as unknown as Parameters<typeof server.connect>[0]);
    await transport.handleRequest(request, response, request.body);
  } catch (error) {
    console.error("mcp_request", { requestId: request.id, error });
    if (!response.headersSent) {
      response.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  } finally {
    await server.close().catch(() => undefined);
  }
}

mcpRouter.post("/", async (request, response) => {
  await handleMcpRequest(request.admin!, request, response);
});

for (const method of ["get", "delete"] as const) {
  mcpRouter[method]("/", (_request, response) => {
    response.set("Allow", "POST");
    response.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed." },
      id: null,
    });
  });
}
