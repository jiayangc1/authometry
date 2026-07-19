import { randomUUID } from "node:crypto";
import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { applicationInputSchema, createApplicationSlug } from "@authometry/domain";

export const applicationTypes = ["web", "spa", "native", "machine", "device"] as const;
export type ApplicationType = (typeof applicationTypes)[number];

export interface ApplicationCreateOptions {
  name: string;
  slug?: string;
  type: ApplicationType;
  description?: string;
  redirectUris: string[];
  postLogoutRedirectUris: string[];
  scopes: string[];
}

export interface CreatedApplicationResponse {
  id: string;
  issuer: string;
  clientId: string;
  clientSecret?: string;
}

export interface ProvisionedApplication extends Omit<CreatedApplicationResponse, "id"> {
  applicationId: string;
  name: string;
  slug: string;
  type: ApplicationType;
  redirectUris: string[];
  postLogoutRedirectUris: string[];
  scopes: string[];
}

export function applicationCreatePayload(input: ApplicationCreateOptions) {
  if (["web", "spa", "native"].includes(input.type) && !input.redirectUris.length) {
    throw new Error(`A ${input.type} application requires at least one --redirect-uri.`);
  }
  const defaultScopes = input.type === "machine" ? undefined : ["openid", "profile", "email"];
  return applicationInputSchema.parse({
    name: input.name,
    slug: input.slug ?? createApplicationSlug(input.name),
    type: input.type,
    description: input.description,
    redirectUris: input.redirectUris,
    postLogoutRedirectUris: input.postLogoutRedirectUris,
    allowedScopes: input.scopes.length ? input.scopes : defaultScopes,
  });
}

export function provisionedApplication(
  input: ApplicationCreateOptions,
  response: CreatedApplicationResponse,
): ProvisionedApplication {
  const payload = applicationCreatePayload(input);
  const { id, ...credentials } = response;
  return {
    applicationId: id,
    ...credentials,
    name: payload.name,
    slug: payload.slug,
    type: payload.type,
    redirectUris: payload.redirectUris,
    postLogoutRedirectUris: payload.postLogoutRedirectUris,
    scopes: payload.allowedScopes ?? [],
  };
}

function applicationEnvironmentKeys(prefix: string): [string, string, string, string] {
  if (!/^[A-Z][A-Z0-9_]*$/.test(prefix)) {
    throw new Error("--env-prefix must contain only uppercase letters, numbers, and underscores.");
  }
  return [
    `${prefix}_APPLICATION_ID`,
    `${prefix}_ISSUER`,
    `${prefix}_CLIENT_ID`,
    `${prefix}_CLIENT_SECRET`,
  ];
}

async function environmentFileState(
  path: string,
  prefix: string,
): Promise<{
  target: string;
  existing: string;
  conflicts: string[];
}> {
  const target = resolve(path);
  let existing = "";
  try {
    existing = await readFile(target, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const assignment = /^([A-Z][A-Z0-9_]*)\s*=/;
  const existingKeys = new Set(
    existing
      .split(/\r?\n/)
      .map((line) => assignment.exec(line)?.[1])
      .filter((key): key is string => Boolean(key)),
  );
  return {
    target,
    existing,
    conflicts: applicationEnvironmentKeys(prefix).filter((key) => existingKeys.has(key)),
  };
}

export async function assertApplicationEnvironmentWritable(
  path: string,
  overwrite: boolean,
  prefix = "AUTHOMETRY",
): Promise<void> {
  const { target, conflicts } = await environmentFileState(path, prefix);
  if (conflicts.length && !overwrite) {
    throw new Error(
      `${target} already defines ${conflicts.join(", ")}. Pass --overwrite-env to replace them.`,
    );
  }
}

export function applicationEnvironment(
  application: CreatedApplicationResponse,
  prefix = "AUTHOMETRY",
): string {
  const [applicationIdKey, issuerKey, clientIdKey, clientSecretKey] =
    applicationEnvironmentKeys(prefix);
  const values: Array<[string, string | undefined]> = [
    [applicationIdKey, application.id],
    [issuerKey, application.issuer],
    [clientIdKey, application.clientId],
    [clientSecretKey, application.clientSecret],
  ];
  return `${values
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([name, value]) => `${name}=${JSON.stringify(value)}`)
    .join("\n")}\n`;
}

export async function writeApplicationEnvironment(
  path: string,
  application: CreatedApplicationResponse,
  overwrite: boolean,
  prefix = "AUTHOMETRY",
): Promise<string> {
  const keys = applicationEnvironmentKeys(prefix);
  const { target, existing, conflicts } = await environmentFileState(path, prefix);
  const assignment = /^([A-Z][A-Z0-9_]*)\s*=/;
  if (conflicts.length && !overwrite) {
    throw new Error(
      `${target} already defines ${conflicts.join(", ")}. Pass --overwrite-env to replace them.`,
    );
  }

  const preserved = existing
    .split(/\r?\n/)
    .filter((line) => {
      const key = assignment.exec(line)?.[1];
      return !key || !keys.includes(key);
    })
    .join("\n")
    .trimEnd();
  const contents = `${preserved ? `${preserved}\n\n` : ""}${applicationEnvironment(application, prefix)}`;
  const temporary = join(dirname(target), `.${basename(target)}.${randomUUID()}.tmp`);
  await writeFile(temporary, contents, { flag: "wx", mode: 0o600 });
  try {
    await rename(temporary, target);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
  return target;
}
