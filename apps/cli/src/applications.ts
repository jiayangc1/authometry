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

const applicationEnvironmentKeys = [
  "AUTHOMETRY_APPLICATION_ID",
  "AUTHOMETRY_ISSUER",
  "AUTHOMETRY_CLIENT_ID",
  "AUTHOMETRY_CLIENT_SECRET",
] as const;

export function applicationEnvironment(application: CreatedApplicationResponse): string {
  const values: Array<[string, string | undefined]> = [
    ["AUTHOMETRY_APPLICATION_ID", application.id],
    ["AUTHOMETRY_ISSUER", application.issuer],
    ["AUTHOMETRY_CLIENT_ID", application.clientId],
    ["AUTHOMETRY_CLIENT_SECRET", application.clientSecret],
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
): Promise<string> {
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
  const conflicts = applicationEnvironmentKeys.filter((key) => existingKeys.has(key));
  if (conflicts.length && !overwrite) {
    throw new Error(
      `${target} already defines ${conflicts.join(", ")}. Pass --overwrite-env to replace them.`,
    );
  }

  const preserved = existing
    .split(/\r?\n/)
    .filter((line) => {
      const key = assignment.exec(line)?.[1];
      return (
        !key ||
        !applicationEnvironmentKeys.includes(key as (typeof applicationEnvironmentKeys)[number])
      );
    })
    .join("\n")
    .trimEnd();
  const contents = `${preserved ? `${preserved}\n\n` : ""}${applicationEnvironment(application)}`;
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
