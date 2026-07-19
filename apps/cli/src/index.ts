import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import chalk from "chalk";
import { Command } from "commander";
import packageJson from "../package.json" with { type: "json" };
import {
  buildConfigurationPlan,
  comparableManifest,
  loadManifestDirectory,
  resolveSecretReference,
  serializeManifest,
  summarizePlan,
  validateManifestRelationships,
  type AuthometryManifest,
  type ManifestDocument,
  type PlanEntry,
} from "@authometry/config";
import {
  applicationCreatePayload,
  applicationTypes,
  assertApplicationEnvironmentWritable,
  provisionedApplication,
  writeApplicationEnvironment,
  type ApplicationCreateOptions,
  type ApplicationType,
  type CreatedApplicationResponse,
} from "./applications.js";

interface GlobalOptions {
  server: string;
  token?: string;
  environment: string;
}

const program = new Command()
  .name("authometry")
  .description("Validate, inspect, and apply Authometry configuration.")
  .version(packageJson.version)
  .option(
    "--server <url>",
    "Authometry server URL",
    process.env.AUTHOMETRY_SERVER ?? "https://authometry.ch3n.cc",
  )
  .option("--token <token>", "Authometry personal access token", process.env.AUTHOMETRY_TOKEN)
  .option(
    "--environment <environment>",
    "Environment ID or slug",
    process.env.AUTHOMETRY_ENVIRONMENT ?? "production",
  );

function globalOptions(command: Command): GlobalOptions {
  return command.optsWithGlobals<GlobalOptions>();
}

async function load(directory: string): Promise<ManifestDocument[]> {
  const documents = await loadManifestDirectory(resolve(directory));
  if (!documents.length) throw new Error(`No YAML manifests were found in ${directory}.`);
  const errors = validateManifestRelationships(documents);
  if (errors.length) throw new Error(errors.join("\n"));
  return documents;
}

async function api<T>(path: string, options: GlobalOptions, init?: RequestInit): Promise<T> {
  if (!options.token) throw new Error("Set AUTHOMETRY_TOKEN or pass --token.");
  const response = await fetch(`${options.server.replace(/\/$/, "")}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${options.token}`,
      "content-type": "application/json",
      "x-authometry-environment": options.environment,
      ...init?.headers,
    },
  });
  const result = (await response.json().catch(() => undefined)) as
    T | { error?: { message?: string } } | undefined;
  if (!response.ok) {
    throw new Error(
      (result as { error?: { message?: string } })?.error?.message ??
        `Authometry returned HTTP ${response.status}.`,
    );
  }
  return result as T;
}

function printPlan(entries: PlanEntry[]): void {
  const symbols = {
    create: chalk.green("+"),
    update: chalk.yellow("~"),
    delete: chalk.red("-"),
    unchanged: chalk.dim("="),
  };
  for (const entry of entries) stdout.write(`  ${symbols[entry.operation]} ${entry.key}\n`);
  const summary = summarizePlan(entries);
  stdout.write(
    `\nPlan: ${summary.create} create, ${summary.update} update, ${summary.delete} delete, ${summary.unchanged} unchanged.\n`,
  );
}

function collectOption(value: string, values: string[]): string[] {
  return [...values, value];
}

const applications = program
  .command("apps")
  .alias("applications")
  .description("Provision OAuth applications on Authometry Cloud.");

applications
  .command("create")
  .description("Create an OAuth application and return its issuer and client credentials.")
  .requiredOption("--name <name>", "Application display name")
  .option("--slug <slug>", "Stable application slug; defaults to the display name")
  .option("--type <type>", `Client type: ${applicationTypes.join(", ")}`, "web")
  .option("--description <description>", "Application description")
  .option(
    "--redirect-uri <uri>",
    "Exact OAuth callback URI; repeat for additional deployments",
    collectOption,
    [],
  )
  .option(
    "--post-logout-redirect-uri <uri>",
    "Exact post-logout URI; repeat for additional deployments",
    collectOption,
    [],
  )
  .option("--scope <scope>", "Allowed OAuth scope; repeat for additional scopes", collectOption, [])
  .option("--output-env <path>", "Write credentials to an environment file without printing them")
  .option("--env-prefix <prefix>", "Environment variable prefix", "AUTHOMETRY")
  .option("--overwrite-env", "Replace existing Authometry values in --output-env", false)
  .option("--json", "Print machine-readable JSON", false)
  .action(
    async (
      input: {
        name: string;
        slug?: string;
        type: string;
        description?: string;
        redirectUri: string[];
        postLogoutRedirectUri: string[];
        scope: string[];
        outputEnv?: string;
        envPrefix: string;
        overwriteEnv: boolean;
        json: boolean;
      },
      command: Command,
    ) => {
      if (!applicationTypes.includes(input.type as ApplicationType)) {
        throw new Error(`--type must be one of: ${applicationTypes.join(", ")}.`);
      }
      const createOptions: ApplicationCreateOptions = {
        name: input.name,
        type: input.type as ApplicationType,
        redirectUris: input.redirectUri,
        postLogoutRedirectUris: input.postLogoutRedirectUri,
        scopes: input.scope,
        ...(input.slug ? { slug: input.slug } : {}),
        ...(input.description ? { description: input.description } : {}),
      };
      const payload = applicationCreatePayload(createOptions);
      if (input.outputEnv) {
        await assertApplicationEnvironmentWritable(
          input.outputEnv,
          input.overwriteEnv,
          input.envPrefix,
        );
      }
      const created = await api<CreatedApplicationResponse>(
        "/api/v1/applications",
        globalOptions(command),
        { method: "POST", body: JSON.stringify(payload) },
      );
      const result = provisionedApplication(createOptions, created);
      const environmentFile = input.outputEnv
        ? await writeApplicationEnvironment(
            input.outputEnv,
            created,
            input.overwriteEnv,
            input.envPrefix,
          )
        : undefined;

      if (input.json) {
        const output = environmentFile
          ? { ...result, clientSecret: undefined, environmentFile }
          : result;
        stdout.write(`${JSON.stringify(output, null, 2)}\n`);
        return;
      }

      stdout.write(`${chalk.green("✓")} Created ${result.name}\n\n`);
      stdout.write(`Application ID: ${result.applicationId}\n`);
      stdout.write(`Issuer: ${result.issuer}\n`);
      stdout.write(`Client ID: ${result.clientId}\n`);
      if (environmentFile) {
        stdout.write(`Credentials: ${environmentFile}\n`);
      } else if (result.clientSecret) {
        stdout.write(`Client secret: ${result.clientSecret}\n`);
        stdout.write(chalk.yellow("Store this secret now. Authometry cannot show it again.\n"));
      } else {
        stdout.write("Client secret: not used by this public client\n");
      }
    },
  );

program
  .command("init")
  .description("Generate a starter Authometry configuration directory.")
  .option("-d, --directory <path>", "Output directory", "authometry")
  .action(async ({ directory }: { directory: string }) => {
    const root = resolve(directory);
    for (const path of ["applications", "scopes", "policies", "claims"])
      await mkdir(join(root, path), { recursive: true });
    await writeFile(
      join(root, "authometry.yaml"),
      `apiVersion: authometry.dev/v1alpha1\nkind: AuthometryInstance\nmetadata:\n  name: primary\nspec:\n  issuer: https://authometry.ch3n.cc\n  defaultTokenLifetimes:\n    accessToken: 15m\n    refreshToken: 30d\n  supportedSigningAlgorithms: [RS256]\n  requireConsent: true\n  sessionLifetime: 7d\n`,
      { flag: "wx" },
    );
    await writeFile(
      join(root, "applications", "dashboard.yaml"),
      `apiVersion: authometry.dev/v1alpha1\nkind: Application\nmetadata:\n  name: dashboard\nspec:\n  displayName: Dashboard\n  type: web\n  redirectUris:\n    - http://localhost:3000/auth/callback\n  postLogoutRedirectUris:\n    - http://localhost:3000\n  grantTypes: [authorization_code, refresh_token]\n  responseTypes: [code]\n  scopes: [openid, profile, email]\n  security:\n    requirePkce: true\n    requireConsent: true\n    rotateRefreshTokens: true\n  tokens:\n    accessTokenLifetime: 15m\n    refreshTokenLifetime: 30d\n    authorizationCodeLifetime: 60s\n  tokenEndpointAuthMethod: client_secret_basic\n  credentials:\n    clientSecret:\n      valueFrom:\n        environment:\n          name: DASHBOARD_CLIENT_SECRET\n`,
      { flag: "wx" },
    );
    stdout.write(`${chalk.green("✓")} Created ${root}\n`);
  });

program
  .command("validate")
  .description("Validate configuration without contacting a server.")
  .option("-d, --directory <path>", "Manifest directory", "authometry")
  .action(async ({ directory }: { directory: string }) => {
    const documents = await load(directory);
    const counts = documents.reduce<Record<string, number>>((all, { manifest }) => {
      all[manifest.kind] = (all[manifest.kind] ?? 0) + 1;
      return all;
    }, {});
    for (const [kind, count] of Object.entries(counts))
      stdout.write(`${chalk.green("✓")} ${count} ${kind} resources valid\n`);
    stdout.write("\nConfiguration is valid.\n");
  });

async function remoteManifests(options: GlobalOptions): Promise<AuthometryManifest[]> {
  const result = await api<{ manifests: AuthometryManifest[] }>("/api/v1/config/export", options);
  return result.manifests;
}

function comparableDocuments(documents: ManifestDocument[]): ManifestDocument[] {
  return documents.map(({ path, manifest }) => ({ path, manifest: comparableManifest(manifest) }));
}

for (const commandName of ["plan", "diff"] as const) {
  program
    .command(commandName)
    .description(
      commandName === "plan"
        ? "Show operations required to apply configuration."
        : "Show resource-level configuration changes.",
    )
    .option("-d, --directory <path>", "Manifest directory", "authometry")
    .action(async ({ directory }: { directory: string }, command: Command) => {
      const options = globalOptions(command);
      const entries = buildConfigurationPlan(
        comparableDocuments(await load(directory)),
        (await remoteManifests(options)).map(comparableManifest),
      );
      printPlan(entries);
      if (commandName === "diff") {
        for (const entry of entries.filter(({ operation }) => operation === "update")) {
          stdout.write(`\n${chalk.bold(entry.key)}\n`);
          stdout.write(
            chalk.red(`- ${serializeManifest(entry.current!).replaceAll("\n", "\n- ")}\n`),
          );
          stdout.write(
            chalk.green(`+ ${serializeManifest(entry.desired!).replaceAll("\n", "\n+ ")}\n`),
          );
        }
      }
    });
}

program
  .command("apply")
  .description("Atomically apply configuration to an Authometry environment.")
  .option("-d, --directory <path>", "Manifest directory", "authometry")
  .option("--non-interactive", "Apply without a confirmation prompt", false)
  .option("--revision <revision>", "Source revision", process.env.GITHUB_SHA)
  .option("--repository <repository>", "Source repository", process.env.GITHUB_REPOSITORY)
  .action(
    async (
      input: { directory: string; nonInteractive: boolean; revision?: string; repository?: string },
      command: Command,
    ) => {
      const options = globalOptions(command);
      const documents = await load(input.directory);
      const entries = buildConfigurationPlan(
        comparableDocuments(documents),
        (await remoteManifests(options)).map(comparableManifest),
      );
      const secrets: Record<string, string> = {};
      for (const { manifest } of documents) {
        if (manifest.kind === "Application" && manifest.spec.credentials) {
          secrets[`Application/${manifest.metadata.name}`] = await resolveSecretReference(
            manifest.spec.credentials.clientSecret,
          );
        }
      }
      printPlan(entries);
      if (!input.nonInteractive) {
        const terminal = createInterface({ input: stdin, output: stdout });
        const answer = await terminal.question("\nApply these changes? [y/N] ");
        terminal.close();
        if (!/^y(es)?$/i.test(answer.trim())) {
          stdout.write("No changes were applied.\n");
          return;
        }
      }
      const result = await api<{ deploymentId: string; applied: number }>(
        "/api/v1/config/apply",
        options,
        {
          method: "POST",
          body: JSON.stringify({
            manifests: documents.map(({ manifest, path }) => ({ manifest, path })),
            secrets,
            revision: input.revision,
            repository: input.repository,
          }),
        },
      );
      stdout.write(
        `${chalk.green("✓")} Applied ${result.applied} changes in deployment ${result.deploymentId}.\n`,
      );
    },
  );

program
  .command("status")
  .description("Show configuration ownership and drift.")
  .action(async (_input: unknown, command: Command) => {
    const result = await api<{
      environment: string;
      status: "in_sync" | "drifted" | "not_applied";
      resources: Array<{ key: string; status: string }>;
    }>("/api/v1/config/status", globalOptions(command));
    stdout.write(`${result.environment}\n\nConfiguration\n`);
    for (const resource of result.resources) {
      const symbol = resource.status === "in_sync" ? chalk.green("✓") : chalk.red("✕");
      stdout.write(`${symbol} ${resource.key}: ${resource.status}\n`);
    }
  });

program
  .command("export")
  .description("Export dashboard-managed resources as manifests.")
  .option("-d, --directory <path>", "Output directory", "authometry-export")
  .action(async ({ directory }: { directory: string }, command: Command) => {
    const options = globalOptions(command);
    const result = await api<{ documents: Array<{ path: string; source: string }> }>(
      "/api/v1/config/export?format=yaml",
      options,
    );
    const root = resolve(directory);
    for (const document of result.documents) {
      const path = join(root, document.path);
      await mkdir(resolve(path, ".."), { recursive: true });
      await writeFile(path, document.source, { flag: "wx" });
      stdout.write(`${chalk.green("✓")} ${path}\n`);
    }
  });

program.parseAsync().catch((error: unknown) => {
  process.stderr.write(
    `${chalk.red("Error:")} ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
