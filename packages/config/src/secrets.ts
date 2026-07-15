import { readFile } from "node:fs/promises";
import type { ApplicationManifest } from "./manifests";

export type SecretReference = NonNullable<
  ApplicationManifest["spec"]["credentials"]
>["clientSecret"];

export async function resolveSecretReference(
  reference: SecretReference,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  if ("environment" in reference.valueFrom) {
    const name = reference.valueFrom.environment.name;
    const value = environment[name];
    if (!value) throw new Error(`${name} is not available.`);
    return value;
  }

  const value = (await readFile(reference.valueFrom.file.path, "utf8")).trim();
  if (!value) throw new Error(`${reference.valueFrom.file.path} is empty.`);
  return value;
}
