import type { AuthometryManifest, ManifestDocument } from "./manifests";
import { serializeManifest } from "./manifests";

export type PlanOperation = "create" | "update" | "delete" | "unchanged";

export interface PlanEntry {
  key: string;
  kind: AuthometryManifest["kind"];
  name: string;
  operation: PlanOperation;
  desired?: AuthometryManifest;
  current?: AuthometryManifest;
}

function keyOf(manifest: AuthometryManifest): string {
  return `${manifest.kind}/${manifest.metadata.name}`;
}

export function buildConfigurationPlan(
  desiredDocuments: ManifestDocument[],
  currentManifests: AuthometryManifest[],
): PlanEntry[] {
  const desired = new Map(desiredDocuments.map(({ manifest }) => [keyOf(manifest), manifest]));
  const current = new Map(currentManifests.map((manifest) => [keyOf(manifest), manifest]));
  const keys = [...new Set([...desired.keys(), ...current.keys()])].sort();

  return keys.map((key) => {
    const desiredManifest = desired.get(key);
    const currentManifest = current.get(key);
    const source = desiredManifest ?? currentManifest;
    if (!source) throw new Error(`Unable to plan ${key}.`);
    const operation: PlanOperation = !currentManifest
      ? "create"
      : !desiredManifest
        ? "delete"
        : serializeManifest(currentManifest) === serializeManifest(desiredManifest)
          ? "unchanged"
          : "update";
    return {
      key,
      kind: source.kind,
      name: source.metadata.name,
      operation,
      ...(desiredManifest ? { desired: desiredManifest } : {}),
      ...(currentManifest ? { current: currentManifest } : {}),
    };
  });
}

export function summarizePlan(entries: PlanEntry[]): Record<PlanOperation, number> {
  return entries.reduce<Record<PlanOperation, number>>(
    (summary, entry) => ({ ...summary, [entry.operation]: summary[entry.operation] + 1 }),
    { create: 0, update: 0, delete: 0, unchanged: 0 },
  );
}
