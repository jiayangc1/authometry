import { createHash } from "node:crypto";
import { Router } from "express";
import type { PoolClient } from "pg";
import { z } from "zod";
import {
  buildConfigurationPlan,
  comparableManifest,
  manifestSchema,
  serializeManifest,
  validateManifestRelationships,
  type AuthometryManifest,
  type ManifestDocument,
  type PlanEntry,
} from "@authometry/config";
import { query, transaction } from "../db.js";
import { hashToken, randomId } from "../lib/crypto.js";
import { ApiError, asyncRoute } from "../lib/http.js";
import { auditMutation, requireEnvironment } from "./context.js";

export const configurationRouter = Router();
configurationRouter.use(requireEnvironment);
configurationRouter.use(auditMutation);
configurationRouter.use((request, _response, next) => {
  const scopes = request.admin?.tokenScopes;
  if (!scopes) return next();
  const required = ["GET", "HEAD"].includes(request.method) ? "config:read" : "config:write";
  if (scopes.includes(required)) return next();
  next(new ApiError(403, "insufficient_scope", `The API token requires ${required}.`));
});

interface ResourceRow {
  kind: AuthometryManifest["kind"];
  name: string;
  manifest_path: string | null;
  ownership: "dashboard" | "manifest";
  payload: Record<string, unknown>;
}

function seconds(value: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(value);
  if (!match) throw new ApiError(422, "invalid_duration", `Invalid duration: ${value}.`);
  const amount = Number(match[1]);
  const multiplier = { s: 1, m: 60, h: 3600, d: 86_400 }[match[2] as "s" | "m" | "h" | "d"];
  return amount * multiplier;
}

function duration(value: number): string {
  if (value % 86_400 === 0) return `${value / 86_400}d`;
  if (value % 3600 === 0) return `${value / 3600}h`;
  if (value % 60 === 0) return `${value / 60}m`;
  return `${value}s`;
}

function stableHash(manifests: AuthometryManifest[]): string {
  return createHash("sha256")
    .update(manifests.map(comparableManifest).map(serializeManifest).sort().join("\n---\n"))
    .digest("hex");
}

async function resourceRows(
  environmentId: string,
  includeDashboard: boolean,
): Promise<ResourceRow[]> {
  const ownershipClause = includeDashboard ? "" : "AND ownership = 'manifest'";
  const [applications, scopes, policies, claims] = await Promise.all([
    query<Record<string, unknown>>(
      `SELECT * FROM oauth_applications WHERE environment_id = $1 ${ownershipClause} ORDER BY slug`,
      [environmentId],
    ),
    query<Record<string, unknown>>(
      `SELECT * FROM resource_scopes WHERE environment_id = $1 ${ownershipClause} AND is_system = false ORDER BY name`,
      [environmentId],
    ),
    query<Record<string, unknown>>(
      `SELECT p.*, COALESCE(array_agg(a.slug) FILTER (WHERE a.slug IS NOT NULL), '{}') AS application_slugs
       FROM authorization_policies p LEFT JOIN oauth_applications a ON a.id = ANY(p.application_ids)
       WHERE p.environment_id = $1 ${ownershipClause}
       GROUP BY p.id ORDER BY p.name`,
      [environmentId],
    ),
    query<Record<string, unknown>>(
      `SELECT * FROM claim_mappings WHERE environment_id = $1 ${ownershipClause} ORDER BY name`,
      [environmentId],
    ),
  ]);
  return [
    ...applications.map((payload) => ({
      kind: "Application" as const,
      name: String(payload.slug),
      manifest_path: payload.manifest_path as string | null,
      ownership: payload.ownership as "dashboard" | "manifest",
      payload,
    })),
    ...scopes.map((payload) => ({
      kind: "Scope" as const,
      name: String(payload.name),
      manifest_path: payload.manifest_path as string | null,
      ownership: payload.ownership as "dashboard" | "manifest",
      payload,
    })),
    ...policies.map((payload) => ({
      kind: "Policy" as const,
      name: String(payload.name),
      manifest_path: payload.manifest_path as string | null,
      ownership: payload.ownership as "dashboard" | "manifest",
      payload,
    })),
    ...claims.map((payload) => ({
      kind: "ClaimMapping" as const,
      name: String(payload.name),
      manifest_path: payload.manifest_path as string | null,
      ownership: payload.ownership as "dashboard" | "manifest",
      payload,
    })),
  ];
}

function rowToManifest(row: ResourceRow): AuthometryManifest {
  const value = row.payload;
  switch (row.kind) {
    case "Application":
      return manifestSchema.parse({
        apiVersion: "authometry.dev/v1alpha1",
        kind: "Application",
        metadata: { name: row.name },
        spec: {
          displayName: value.name,
          type: value.type,
          ...(value.description ? { description: value.description } : {}),
          ...(value.client_id_source === "manifest" ? { clientId: value.client_id } : {}),
          redirectUris: value.redirect_uris,
          postLogoutRedirectUris: value.post_logout_redirect_uris,
          grantTypes: value.grant_types,
          responseTypes: value.response_types,
          scopes: value.allowed_scopes,
          security: {
            requirePkce: value.require_pkce,
            requireConsent: value.require_consent,
            rotateRefreshTokens: value.rotate_refresh_tokens,
          },
          tokens: {
            accessTokenLifetime: duration(Number(value.access_token_lifetime_seconds)),
            refreshTokenLifetime: duration(Number(value.refresh_token_lifetime_seconds)),
            authorizationCodeLifetime: duration(Number(value.authorization_code_lifetime_seconds)),
          },
          tokenEndpointAuthMethod: value.token_endpoint_auth_method,
        },
      });
    case "Scope":
      return manifestSchema.parse({
        apiVersion: "authometry.dev/v1alpha1",
        kind: "Scope",
        metadata: { name: row.name },
        spec: {
          value: value.name,
          displayName: value.display_name,
          description: value.description,
          consentDescription: value.consent_description,
          sensitivity: value.sensitivity,
        },
      });
    case "Policy": {
      const conditions = value.conditions as { all?: unknown[] };
      const decision = value.decision as { otherwise?: unknown };
      return manifestSchema.parse({
        apiVersion: "authometry.dev/v1alpha1",
        kind: "Policy",
        metadata: { name: row.name },
        spec: {
          displayName: value.display_name,
          description: value.description,
          enabled: value.enabled,
          applications: value.application_slugs,
          match: { all: conditions.all ?? [] },
          decision: { allow: true },
          otherwise: decision.otherwise,
        },
      });
    }
    case "ClaimMapping":
      return manifestSchema.parse({
        apiVersion: "authometry.dev/v1alpha1",
        kind: "ClaimMapping",
        metadata: { name: row.name },
        spec: {
          source: { field: value.source_field },
          target: { claim: value.target_claim },
          includeIn: value.include_in,
        },
      });
  }
  throw new ApiError(
    500,
    "unsupported_manifest",
    `Unsupported manifest kind: ${String(row.kind)}.`,
  );
}

async function currentManifests(
  environmentId: string,
  includeDashboard = false,
): Promise<AuthometryManifest[]> {
  const resources = (await resourceRows(environmentId, includeDashboard)).map(rowToManifest);
  const [state] = await query<{
    issuer: string;
    session_lifetime_seconds: number | null;
    default_access_token_lifetime_seconds: number | null;
    default_refresh_token_lifetime_seconds: number | null;
    require_consent: boolean | null;
    manifest_snapshot: AuthometryManifest[] | null;
  }>(
    `SELECT e.issuer, s.session_lifetime_seconds, s.default_access_token_lifetime_seconds,
              s.default_refresh_token_lifetime_seconds, s.require_consent,
        (SELECT manifest_snapshot FROM configuration_deployments d WHERE d.environment_id = e.id
         AND d.status = 'applied' ORDER BY d.applied_at DESC LIMIT 1) AS manifest_snapshot
       FROM environments e LEFT JOIN workspace_settings s ON s.workspace_id = e.workspace_id
       WHERE e.id = $1`,
    [environmentId],
  );
  const snapshotInstance = state?.manifest_snapshot?.find(
    (manifest) => manifest.kind === "AuthometryInstance",
  );
  const instance =
    snapshotInstance?.kind === "AuthometryInstance"
      ? {
          ...snapshotInstance,
          spec: {
            ...snapshotInstance.spec,
            issuer: state!.issuer,
            defaultTokenLifetimes: {
              accessToken: duration(state?.default_access_token_lifetime_seconds ?? 900),
              refreshToken: duration(state?.default_refresh_token_lifetime_seconds ?? 2_592_000),
            },
            requireConsent: state?.require_consent ?? true,
            sessionLifetime: duration(state?.session_lifetime_seconds ?? 604_800),
          },
        }
      : manifestSchema.parse({
          apiVersion: "authometry.dev/v1alpha1",
          kind: "AuthometryInstance",
          metadata: { name: "primary" },
          spec: {
            issuer: state?.issuer,
            defaultTokenLifetimes: { accessToken: "15m", refreshToken: "30d" },
            supportedSigningAlgorithms: ["RS256"],
            requireConsent: true,
            sessionLifetime: duration(state?.session_lifetime_seconds ?? 604_800),
          },
        });
  resources.push(instance);
  return resources;
}

function exportPath(manifest: AuthometryManifest): string {
  const folder = {
    AuthometryInstance: "",
    Application: "applications",
    Scope: "scopes",
    Policy: "policies",
    ClaimMapping: "claims",
  }[manifest.kind];
  return folder ? `${folder}/${manifest.metadata.name}.yaml` : "authometry.yaml";
}

configurationRouter.get(
  "/config/export",
  asyncRoute(async (request, response) => {
    const includeDashboard =
      request.query.format === "yaml" || request.query.includeDashboard === "true";
    const manifests = await currentManifests(request.environment!.id, includeDashboard);
    if (request.query.format === "yaml") {
      response.json({
        documents: manifests.map((manifest) => ({
          path: exportPath(manifest),
          source: serializeManifest(manifest),
        })),
      });
      return;
    }
    response.json({ manifests });
  }),
);

const applySchema = z.object({
  manifests: z
    .array(z.object({ manifest: manifestSchema, path: z.string().min(1).max(500) }))
    .max(500),
  secrets: z.record(z.string(), z.string().min(16)).default({}),
  revision: z.string().max(200).optional(),
  repository: z.string().max(500).optional(),
});

async function applyEntry(
  client: PoolClient,
  entry: PlanEntry,
  document: ManifestDocument | undefined,
  context: { workspaceId: string; environmentId: string; secrets: Record<string, string> },
): Promise<void> {
  if (entry.operation === "unchanged") return;
  if (entry.operation === "delete") {
    const table = {
      Application: "oauth_applications",
      Scope: "resource_scopes",
      Policy: "authorization_policies",
      ClaimMapping: "claim_mappings",
      AuthometryInstance: null,
    }[entry.kind];
    const nameColumn = entry.kind === "Application" ? "slug" : "name";
    if (table) {
      await client.query(
        `DELETE FROM ${table} WHERE environment_id = $1 AND ${nameColumn} = $2 AND ownership = 'manifest'`,
        [context.environmentId, entry.name],
      );
    }
    return;
  }
  if (!entry.desired || !document)
    throw new ApiError(422, "invalid_plan", `No desired manifest for ${entry.key}.`);
  const manifest = entry.desired;
  switch (manifest.kind) {
    case "AuthometryInstance":
      await client.query("UPDATE environments SET issuer = $2, updated_at = now() WHERE id = $1", [
        context.environmentId,
        manifest.spec.issuer.replace(/\/$/, ""),
      ]);
      await client.query(
        `UPDATE workspace_settings SET default_access_token_lifetime_seconds = $2,
           default_refresh_token_lifetime_seconds = $3, require_consent = $4,
           session_lifetime_seconds = $5, updated_at = now() WHERE workspace_id = $1`,
        [
          context.workspaceId,
          seconds(manifest.spec.defaultTokenLifetimes.accessToken),
          seconds(manifest.spec.defaultTokenLifetimes.refreshToken),
          manifest.spec.requireConsent,
          seconds(manifest.spec.sessionLifetime),
        ],
      );
      break;
    case "Scope":
      await client.query(
        `INSERT INTO resource_scopes
          (workspace_id, environment_id, name, display_name, description, consent_description, sensitivity, ownership, manifest_path)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'manifest',$8)
         ON CONFLICT (environment_id, name) DO UPDATE SET
           display_name = EXCLUDED.display_name, description = EXCLUDED.description,
           consent_description = EXCLUDED.consent_description, sensitivity = EXCLUDED.sensitivity,
           ownership = 'manifest', manifest_path = EXCLUDED.manifest_path, version = resource_scopes.version + 1,
           updated_at = now()`,
        [
          context.workspaceId,
          context.environmentId,
          manifest.spec.value,
          manifest.spec.displayName,
          manifest.spec.description,
          manifest.spec.consentDescription,
          manifest.spec.sensitivity,
          document.path,
        ],
      );
      break;
    case "Application": {
      const clientId = manifest.spec.clientId ?? randomId("amt_client", 12);
      const app = await client.query<{ id: string }>(
        `INSERT INTO oauth_applications
          (workspace_id, environment_id, name, slug, client_id, client_id_source, type, description, redirect_uris,
           post_logout_redirect_uris, grant_types, response_types, token_endpoint_auth_method,
           require_pkce, require_consent, allowed_scopes, access_token_lifetime_seconds,
           refresh_token_lifetime_seconds, authorization_code_lifetime_seconds, rotate_refresh_tokens,
           ownership, manifest_path)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,'manifest',$21)
         ON CONFLICT (environment_id, slug) DO UPDATE SET
           name = EXCLUDED.name,
           client_id = CASE WHEN EXCLUDED.client_id_source = 'manifest'
             THEN EXCLUDED.client_id ELSE oauth_applications.client_id END,
           client_id_source = EXCLUDED.client_id_source,
           type = EXCLUDED.type, description = EXCLUDED.description,
           redirect_uris = EXCLUDED.redirect_uris, post_logout_redirect_uris = EXCLUDED.post_logout_redirect_uris,
           grant_types = EXCLUDED.grant_types, response_types = EXCLUDED.response_types,
           token_endpoint_auth_method = EXCLUDED.token_endpoint_auth_method, require_pkce = EXCLUDED.require_pkce,
           require_consent = EXCLUDED.require_consent, allowed_scopes = EXCLUDED.allowed_scopes,
           access_token_lifetime_seconds = EXCLUDED.access_token_lifetime_seconds,
           refresh_token_lifetime_seconds = EXCLUDED.refresh_token_lifetime_seconds,
           authorization_code_lifetime_seconds = EXCLUDED.authorization_code_lifetime_seconds,
           rotate_refresh_tokens = EXCLUDED.rotate_refresh_tokens, ownership = 'manifest',
           manifest_path = EXCLUDED.manifest_path, version = oauth_applications.version + 1, updated_at = now()
         RETURNING id`,
        [
          context.workspaceId,
          context.environmentId,
          manifest.spec.displayName,
          manifest.metadata.name,
          clientId,
          manifest.spec.clientId ? "manifest" : "auto",
          manifest.spec.type,
          manifest.spec.description ?? null,
          manifest.spec.redirectUris,
          manifest.spec.postLogoutRedirectUris,
          manifest.spec.grantTypes,
          manifest.spec.responseTypes,
          manifest.spec.tokenEndpointAuthMethod,
          manifest.spec.security.requirePkce,
          manifest.spec.security.requireConsent,
          manifest.spec.scopes,
          seconds(manifest.spec.tokens.accessTokenLifetime),
          seconds(manifest.spec.tokens.refreshTokenLifetime),
          seconds(manifest.spec.tokens.authorizationCodeLifetime),
          manifest.spec.security.rotateRefreshTokens,
          document.path,
        ],
      );
      const applicationId = app.rows[0]?.id;
      const secret = context.secrets[entry.key];
      if (applicationId && secret) {
        await client.query(
          `INSERT INTO client_credentials
            (workspace_id, environment_id, application_id, name, prefix, secret_hash)
           SELECT $1,$2,$3,'Manifest secret',$4,$5
           WHERE NOT EXISTS (SELECT 1 FROM client_credentials WHERE application_id = $3 AND revoked_at IS NULL)`,
          [
            context.workspaceId,
            context.environmentId,
            applicationId,
            secret.slice(0, 18),
            hashToken(secret),
          ],
        );
      }
      break;
    }
    case "Policy": {
      const applicationIds = await client.query<{ id: string }>(
        "SELECT id FROM oauth_applications WHERE environment_id = $1 AND slug = ANY($2)",
        [context.environmentId, manifest.spec.applications],
      );
      await client.query(
        `INSERT INTO authorization_policies
          (workspace_id, environment_id, name, display_name, description, enabled, conditions, decision,
           application_ids, ownership, manifest_path)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'manifest',$10)
         ON CONFLICT (environment_id, name) DO UPDATE SET
           display_name = EXCLUDED.display_name, description = EXCLUDED.description, enabled = EXCLUDED.enabled,
           conditions = EXCLUDED.conditions, decision = EXCLUDED.decision, application_ids = EXCLUDED.application_ids,
           ownership = 'manifest', manifest_path = EXCLUDED.manifest_path,
           version = authorization_policies.version + 1, updated_at = now()`,
        [
          context.workspaceId,
          context.environmentId,
          manifest.metadata.name,
          manifest.spec.displayName,
          manifest.spec.description,
          manifest.spec.enabled,
          manifest.spec.match,
          { allow: true, otherwise: manifest.spec.otherwise },
          applicationIds.rows.map(({ id }) => id),
          document.path,
        ],
      );
      break;
    }
    case "ClaimMapping":
      await client.query(
        `INSERT INTO claim_mappings
          (workspace_id, environment_id, name, source_field, target_claim, include_in, ownership, manifest_path)
         VALUES ($1,$2,$3,$4,$5,$6,'manifest',$7)
         ON CONFLICT (environment_id, name) DO UPDATE SET
           source_field = EXCLUDED.source_field, target_claim = EXCLUDED.target_claim,
           include_in = EXCLUDED.include_in, ownership = 'manifest', manifest_path = EXCLUDED.manifest_path,
           version = claim_mappings.version + 1`,
        [
          context.workspaceId,
          context.environmentId,
          manifest.metadata.name,
          manifest.spec.source.field,
          manifest.spec.target.claim,
          manifest.spec.includeIn,
          document.path,
        ],
      );
  }
}

configurationRouter.post(
  "/config/apply",
  asyncRoute(async (request, response) => {
    if (!request.admin || !["owner", "admin", "developer"].includes(request.admin.role)) {
      throw new ApiError(
        403,
        "insufficient_role",
        "Developer, admin, or owner access is required.",
      );
    }
    const input = applySchema.parse(request.body);
    const documents: ManifestDocument[] = input.manifests;
    if (documents.filter(({ manifest }) => manifest.kind === "AuthometryInstance").length !== 1) {
      throw new ApiError(
        422,
        "instance_manifest_required",
        "Exactly one AuthometryInstance manifest is required.",
      );
    }
    const relationErrors = validateManifestRelationships(documents);
    if (relationErrors.length)
      throw new ApiError(422, "invalid_relationship", relationErrors.join(" "));
    for (const document of documents) {
      if (document.manifest.kind === "Application" && document.manifest.spec.credentials) {
        if (!input.secrets[`Application/${document.manifest.metadata.name}`]) {
          throw new ApiError(
            422,
            "secret_unresolved",
            `Resolve the client secret for Application/${document.manifest.metadata.name}.`,
          );
        }
      }
    }
    const environment = request.environment!;
    const current = await currentManifests(environment.id);
    const comparableDocuments = documents.map(({ path, manifest }) => ({
      path,
      manifest: comparableManifest(manifest),
    }));
    const plan = buildConfigurationPlan(comparableDocuments, current.map(comparableManifest));
    const desired = documents.map(({ manifest }) => manifest);
    const deploymentId = await transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        `authometry-config:${environment.id}`,
      ]);
      for (const entry of plan) {
        await applyEntry(
          client,
          entry,
          documents.find(
            ({ manifest }) => `${manifest.kind}/${manifest.metadata.name}` === entry.key,
          ),
          {
            workspaceId: environment.workspaceId,
            environmentId: environment.id,
            secrets: input.secrets,
          },
        );
      }
      const deployment = await client.query<{ id: string }>(
        `INSERT INTO configuration_deployments
          (workspace_id, environment_id, source, revision, repository, actor, desired_hash,
           manifest_snapshot, plan, status)
         VALUES ($1,$2,'cli',$3,$4,$5,$6,$7,$8,'applied') RETURNING id`,
        [
          environment.workspaceId,
          environment.id,
          input.revision ?? null,
          input.repository ?? null,
          request.admin!.email,
          stableHash(desired),
          desired,
          plan.map(({ key, kind, name, operation }) => ({ key, kind, name, operation })),
        ],
      );
      const id = deployment.rows[0]?.id;
      if (!id) throw new Error("Configuration deployment was not recorded.");
      await client.query(
        `INSERT INTO audit_events
          (workspace_id, environment_id, category, severity, event_type, summary, actor_type, actor_id, actor_name, resource_type, resource_id)
         VALUES ($1,$2,'configuration','info','configuration.applied',$3,'admin',$4,$5,'deployment',$6)`,
        [
          environment.workspaceId,
          environment.id,
          `Applied ${plan.filter(({ operation }) => operation !== "unchanged").length} configuration changes`,
          request.admin!.userId,
          request.admin!.email,
          id,
        ],
      );
      return id;
    });
    response.json({
      deploymentId,
      applied: plan.filter(({ operation }) => operation !== "unchanged").length,
      plan: plan.map(({ key, kind, name, operation }) => ({ key, kind, name, operation })),
    });
  }),
);

configurationRouter.get(
  "/config/status",
  asyncRoute(async (request, response) => {
    const environment = request.environment!;
    const manifests = await currentManifests(environment.id);
    const [latest] = await query<{
      desired_hash: string;
      manifest_snapshot: AuthometryManifest[];
      applied_at: Date;
    }>(
      `SELECT desired_hash, manifest_snapshot, applied_at FROM configuration_deployments
       WHERE environment_id = $1 AND status = 'applied' ORDER BY applied_at DESC LIMIT 1`,
      [environment.id],
    );
    const currentHash = stableHash(manifests);
    response.json({
      environment: environment.name,
      status: !latest ? "not_applied" : latest.desired_hash === currentHash ? "in_sync" : "drifted",
      lastAppliedAt: latest?.applied_at,
      resources: [
        ...new Set([
          ...manifests.map((manifest) => `${manifest.kind}/${manifest.metadata.name}`),
          ...(latest?.manifest_snapshot ?? []).map(
            (manifest) => `${manifest.kind}/${manifest.metadata.name}`,
          ),
        ]),
      ]
        .sort()
        .map((key) => {
          const actual = manifests.find(
            (candidate) => `${candidate.kind}/${candidate.metadata.name}` === key,
          );
          const expected = latest?.manifest_snapshot.find(
            (candidate) => `${candidate.kind}/${candidate.metadata.name}` === key,
          );
          return {
            key,
            status:
              actual &&
              expected &&
              serializeManifest(comparableManifest(expected)) ===
                serializeManifest(comparableManifest(actual))
                ? "in_sync"
                : "drifted",
          };
        }),
    });
  }),
);

configurationRouter.get(
  "/config/deployments",
  asyncRoute(async (request, response) => {
    const deployments = await query(
      `SELECT id, source, revision, repository, actor, plan, status, applied_at
       FROM configuration_deployments WHERE environment_id = $1 ORDER BY applied_at DESC LIMIT 100`,
      [request.environment!.id],
    );
    response.json({ data: deployments, meta: { total: deployments.length } });
  }),
);
