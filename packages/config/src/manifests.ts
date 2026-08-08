import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { parse, stringify } from "yaml";
import { z } from "zod";
import {
  applicationLogoUriSchema,
  redirectUriSchema,
  scopeNameSchema,
  slugSchema,
} from "@authometry/domain";

const metadataSchema = z.object({ name: slugSchema });

const secretReferenceSchema = z.object({
  valueFrom: z.union([
    z.object({ environment: z.object({ name: z.string().regex(/^[A-Z][A-Z0-9_]*$/) }) }),
    z.object({ file: z.object({ path: z.string().min(1) }) }),
  ]),
});

const base = {
  apiVersion: z.literal("authometry.dev/v1alpha1"),
  metadata: metadataSchema,
};

export const applicationManifestSchema = z.object({
  ...base,
  kind: z.literal("Application"),
  spec: z.object({
    displayName: z.string().min(2).max(100),
    type: z.enum(["web", "spa", "native", "machine", "device"]),
    description: z.string().max(500).optional(),
    logoUri: applicationLogoUriSchema.optional(),
    clientId: z.string().min(3).max(128).optional(),
    redirectUris: z.array(redirectUriSchema).max(25).default([]),
    postLogoutRedirectUris: z.array(redirectUriSchema).max(25).default([]),
    grantTypes: z
      .array(
        z.enum([
          "authorization_code",
          "refresh_token",
          "client_credentials",
          "urn:ietf:params:oauth:grant-type:device_code",
        ]),
      )
      .min(1),
    responseTypes: z.array(z.string()).default(["code"]),
    scopes: z.array(scopeNameSchema).default(["openid"]),
    security: z.object({
      requirePkce: z.boolean().default(true),
      requireConsent: z.boolean().default(true),
      rotateRefreshTokens: z.literal(true).default(true),
    }),
    tokens: z.object({
      accessTokenLifetime: z.string().regex(/^\d+(s|m|h|d)$/),
      refreshTokenLifetime: z.string().regex(/^\d+(s|m|h|d)$/),
      authorizationCodeLifetime: z
        .string()
        .regex(/^\d+(s|m|h)$/)
        .default("60s"),
    }),
    tokenEndpointAuthMethod: z
      .enum(["none", "client_secret_basic", "client_secret_post"])
      .default("client_secret_basic"),
    credentials: z.object({ clientSecret: secretReferenceSchema }).optional(),
  }),
});

export const scopeManifestSchema = z.object({
  ...base,
  kind: z.literal("Scope"),
  spec: z.object({
    value: scopeNameSchema,
    displayName: z.string().min(2).max(100),
    description: z.string().min(2).max(500),
    consentDescription: z.string().min(2).max(200),
    sensitivity: z.enum(["standard", "sensitive", "restricted"]).default("standard"),
  }),
});

const policyConditionSchema = z.object({
  field: z.string().min(1),
  operator: z.enum(["equals", "not_equals", "contains", "in"]),
  value: z.union([z.string(), z.array(z.string()), z.boolean(), z.number()]),
});

export const policyManifestSchema = z.object({
  ...base,
  kind: z.literal("Policy"),
  spec: z.object({
    displayName: z.string().min(2).max(100),
    description: z.string().max(500),
    enabled: z.boolean().default(true),
    applications: z.array(slugSchema).default([]),
    match: z.object({ all: z.array(policyConditionSchema).min(1) }),
    decision: z.object({ allow: z.literal(true) }),
    otherwise: z.object({
      deny: z.object({ code: z.string().min(1), message: z.string().min(1).max(300) }),
    }),
  }),
});

export const claimMappingManifestSchema = z.object({
  ...base,
  kind: z.literal("ClaimMapping"),
  spec: z.object({
    source: z.object({ field: z.string().min(1) }),
    target: z.object({
      claim: z
        .string()
        .regex(/^[a-zA-Z][a-zA-Z0-9_.-]*$/)
        .refine(
          (claim) =>
            ![
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
            ].includes(claim),
          "Claim mappings cannot replace protocol claims.",
        ),
    }),
    includeIn: z.array(z.enum(["access_token", "id_token", "userinfo"])).min(1),
  }),
});

export const instanceManifestSchema = z.object({
  ...base,
  kind: z.literal("AuthometryInstance"),
  spec: z.object({
    issuer: z
      .string()
      .url()
      .refine((value) => value.startsWith("https://"), "Issuer must use HTTPS."),
    defaultTokenLifetimes: z.object({ accessToken: z.string(), refreshToken: z.string() }),
    supportedSigningAlgorithms: z.array(z.enum(["RS256", "ES256"])).min(1),
    requireConsent: z.boolean().default(true),
    sessionLifetime: z.string().regex(/^\d+(m|h|d)$/),
  }),
});

export const manifestSchema = z.discriminatedUnion("kind", [
  applicationManifestSchema,
  scopeManifestSchema,
  policyManifestSchema,
  claimMappingManifestSchema,
  instanceManifestSchema,
]);

export type AuthometryManifest = z.infer<typeof manifestSchema>;
export type ApplicationManifest = z.infer<typeof applicationManifestSchema>;

export interface ManifestDocument {
  path: string;
  manifest: AuthometryManifest;
}

export function comparableManifest(manifest: AuthometryManifest): AuthometryManifest {
  if (manifest.kind !== "Application" || !manifest.spec.credentials) return manifest;
  const comparable = structuredClone(manifest);
  delete comparable.spec.credentials;
  return comparable;
}

export function parseManifest(source: string, path = "manifest.yaml"): ManifestDocument {
  const result = manifestSchema.safeParse(parse(source));
  if (!result.success) {
    throw new Error(`${path}: ${z.prettifyError(result.error)}`);
  }
  return { path, manifest: result.data };
}

export async function loadManifestDirectory(directory: string): Promise<ManifestDocument[]> {
  const paths: string[] = [];

  async function visit(current: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if ([".yaml", ".yml"].includes(extname(entry.name))) paths.push(path);
    }
  }

  await visit(directory);
  return Promise.all(
    paths.map(async (path) =>
      parseManifest(await readFile(path, "utf8"), relative(directory, path)),
    ),
  );
}

export function serializeManifest(manifest: AuthometryManifest): string {
  return stringify(manifest, { lineWidth: 100, sortMapEntries: true });
}

export function validateManifestRelationships(documents: ManifestDocument[]): string[] {
  const errors: string[] = [];
  const names = new Map(documents.map((document) => [document.manifest.metadata.name, document]));
  const scopes = new Set<string>();
  for (const document of documents) {
    if (document.manifest.kind === "Scope") scopes.add(document.manifest.spec.value);
  }
  for (const system of ["openid", "profile", "email", "phone", "address", "offline_access"]) {
    scopes.add(system);
  }

  for (const document of documents) {
    if (document.manifest.kind === "Application") {
      for (const scope of document.manifest.spec.scopes) {
        if (!scopes.has(scope)) errors.push(`${document.path}: Unknown scope ${scope}.`);
      }
    }
    if (document.manifest.kind === "Policy") {
      for (const application of document.manifest.spec.applications) {
        if (names.get(application)?.manifest.kind !== "Application") {
          errors.push(`${document.path}: Unknown application ${application}.`);
        }
      }
    }
  }
  return errors;
}
