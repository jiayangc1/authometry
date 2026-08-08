import { z } from "zod";

export const slugSchema = z
  .string()
  .min(3)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens.");

export const scopeNameSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z0-9][a-z0-9:._-]*$/, "Scope names cannot contain spaces.");

export const redirectUriSchema = z
  .string()
  .trim()
  .max(2048)
  .superRefine((value, context) => {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      context.addIssue({ code: "custom", message: "Enter a valid absolute URI." });
      return;
    }

    if (url.hash) {
      context.addIssue({ code: "custom", message: "Redirect URIs cannot include fragments." });
    }

    if (url.username || url.password) {
      context.addIssue({ code: "custom", message: "Redirect URIs cannot contain credentials." });
    }

    const localhost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    if (url.protocol !== "https:" && !(localhost && url.protocol === "http:")) {
      context.addIssue({ code: "custom", message: "Use HTTPS unless the host is localhost." });
    }
  });

export const applicationLogoUriSchema = z
  .string()
  .trim()
  .max(2048)
  .superRefine((value, context) => {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      context.addIssue({ code: "custom", message: "Enter a valid absolute logo URL." });
      return;
    }

    const localhost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    if (url.protocol !== "https:" && !(localhost && url.protocol === "http:")) {
      context.addIssue({ code: "custom", message: "Use HTTPS unless the host is localhost." });
    }
    if (url.username || url.password) {
      context.addIssue({ code: "custom", message: "Logo URLs cannot contain credentials." });
    }
  });

export const applicationLaunchUriSchema = z
  .string()
  .trim()
  .max(2048)
  .superRefine((value, context) => {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      context.addIssue({ code: "custom", message: "Enter a valid application launch URL." });
      return;
    }

    const localhost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    if (url.protocol !== "https:" && !(localhost && url.protocol === "http:")) {
      context.addIssue({ code: "custom", message: "Use HTTPS unless the host is localhost." });
    }
    if (url.username || url.password) {
      context.addIssue({ code: "custom", message: "Launch URLs cannot contain credentials." });
    }
  });

export function createDefaultApplicationLaunchUri(
  redirectUris: readonly string[],
): string | undefined {
  const firstRedirectUri = redirectUris[0];
  if (!firstRedirectUri) return undefined;
  const target = new URL(firstRedirectUri);
  target.pathname = "/login";
  target.search = "";
  target.hash = "";
  return target.toString();
}

const uniqueStrings = <T extends z.ZodType<string>>(schema: T, maximum: number) =>
  z
    .array(schema)
    .max(maximum)
    .refine(
      (values) => new Set(values).size === values.length,
      "Duplicate values are not allowed.",
    );

const applicationTypeSchema = z.enum(["web", "spa", "native", "machine", "device"]);

export const applicationInputSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    slug: slugSchema,
    type: applicationTypeSchema,
    description: z.string().trim().max(500).optional(),
    logoUri: applicationLogoUriSchema.optional(),
    redirectUris: uniqueStrings(redirectUriSchema, 25),
    postLogoutRedirectUris: uniqueStrings(redirectUriSchema, 25).default([]),
    allowedScopes: uniqueStrings(scopeNameSchema, 100).min(1).optional(),
    portalEnabled: z.boolean().optional(),
    launchUri: applicationLaunchUriSchema.optional(),
  })
  .superRefine((value, context) => {
    if (["web", "spa", "native"].includes(value.type) && value.redirectUris.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["redirectUris"],
        message: `A ${value.type} application requires at least one redirect URI.`,
      });
    }
  })
  .transform((value) => {
    const launchUri = value.launchUri ?? createDefaultApplicationLaunchUri(value.redirectUris);
    return {
      ...value,
      portalEnabled: value.portalEnabled ?? Boolean(launchUri),
      ...(launchUri ? { launchUri } : {}),
    };
  });

export const applicationUpdateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  logoUri: applicationLogoUriSchema.nullable().optional(),
  redirectUris: uniqueStrings(redirectUriSchema, 25).optional(),
  postLogoutRedirectUris: uniqueStrings(redirectUriSchema, 25).optional(),
  requirePkce: z.boolean().optional(),
  requireConsent: z.boolean().optional(),
  allowedScopes: uniqueStrings(scopeNameSchema, 100).optional(),
  portalEnabled: z.boolean().optional(),
  launchUri: applicationLaunchUriSchema.nullable().optional(),
  version: z.number().int().positive(),
});

export function createApplicationSlug(name: string): string {
  return name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

export function redactSecret(value: string): string {
  if (value.length < 10) return "••••••••";
  return `${value.slice(0, Math.min(value.indexOf("_") + 1 || 3, 10))}••••••••${value.slice(-4)}`;
}
