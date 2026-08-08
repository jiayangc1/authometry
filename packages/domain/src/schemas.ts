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

export const redirectUriSchema = z.string().superRefine((value, context) => {
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

export const applicationInputSchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: slugSchema,
  type: z.enum(["web", "spa", "native", "machine", "device"]),
  description: z.string().trim().max(500).optional(),
  logoUri: applicationLogoUriSchema.optional(),
  redirectUris: z.array(redirectUriSchema).max(25),
  postLogoutRedirectUris: z.array(redirectUriSchema).max(25).default([]),
  allowedScopes: z.array(scopeNameSchema).min(1).max(100).optional(),
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
