import {
  buildConfigurationPlan,
  parseManifest,
  summarizePlan,
  validateManifestRelationships,
  type AuthometryManifest,
} from "@authometry/config";
import { describe, expect, it } from "vitest";
import { diffStat, manifestFiles, pipelines } from "./git-config-data";

const documents = manifestFiles.map((file) =>
  parseManifest(file.lines.map(([text]) => text).join("\n"), file.path),
);

describe("landing configuration sample", () => {
  it("parses every manifest with the real v1alpha1 schema", () => {
    expect(documents.map(({ manifest }) => `${manifest.kind}/${manifest.metadata.name}`)).toEqual([
      "Policy/workspace-member",
      "Scope/media-read",
      "Application/itsagram-web",
    ]);
  });

  it("only references declared applications and scopes", () => {
    expect(validateManifestRelationships(documents)).toEqual([]);
  });

  it("matches the plan printed in the CI transcript", () => {
    const application = documents.find(({ manifest }) => manifest.kind === "Application")!
      .manifest as Extract<AuthometryManifest, { kind: "Application" }>;
    const current: AuthometryManifest[] = [
      { ...application, spec: { ...application.spec, scopes: ["openid", "profile"] } },
      {
        apiVersion: "authometry.dev/v1alpha1",
        kind: "AuthometryInstance",
        metadata: { name: "primary" },
        spec: {
          issuer: "https://auth.itsagram.com",
          defaultTokenLifetimes: { accessToken: "15m", refreshToken: "30d" },
          supportedSigningAlgorithms: ["RS256"],
          requireConsent: true,
          sessionLifetime: "7d",
        },
      },
    ];
    const desired = [...documents, { path: "instance.yaml", manifest: current[1]! }];
    const plan = buildConfigurationPlan(desired, current);
    const printed = pipelines[0]!.steps[1]!.output.map(([line]) => line.trim()).filter(Boolean);

    expect(plan.map(({ operation, key }) => `${symbols[operation]} ${key}`)).toEqual(
      printed.slice(0, -1),
    );
    const summary = summarizePlan(plan);
    expect(printed.at(-1)).toBe(
      `Plan: ${summary.create} create, ${summary.update} update, ${summary.delete} delete, ${summary.unchanged} unchanged.`,
    );
  });

  it("reports the added lines shown in the pull request", () => {
    const added = manifestFiles.flatMap((file) => file.lines.filter(([, , isAdded]) => isAdded));
    expect(diffStat.added).toBe(added.length);
  });
});

const symbols = { create: "+", update: "~", delete: "-", unchanged: "=" } as const;
