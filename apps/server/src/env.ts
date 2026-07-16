import { z } from "zod";

const developmentSecret = "development-only-secret-change-me-32-bytes";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  PUBLIC_ORIGIN: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z
    .string()
    .min(1)
    .default("postgresql://authometry:authometry@localhost:5432/authometry"),
  COOKIE_SECRET: z.string().min(32).default(developmentSecret),
  CSRF_SECRET: z.string().min(32).default(developmentSecret),
  ACCESS_TOKEN_SECRET: z.string().min(32).default(developmentSecret),
  REFRESH_TOKEN_SECRET: z.string().min(32).default(developmentSecret),
  INSTALLATION_ENCRYPTION_KEY: z.string().min(32).default(developmentSecret),
  TOKEN_HMAC_KEY: z.string().min(32).default(developmentSecret),
  BOOTSTRAP_TOKEN: z.string().min(16).default("authometry-development-bootstrap"),
  BOOTSTRAP_TOKEN_EXPIRES_AT: z.coerce.date().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().startsWith("re_").optional(),
  RESEND_FROM: z.string().default("Authometry <auth@cams.ch3n.cc>"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().default("Authometry <auth@example.com>"),
  SMTP_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) throw new Error(`Invalid environment: ${z.prettifyError(parsed.error)}`);
if (parsed.data.NODE_ENV === "production" && parsed.data.COOKIE_SECRET === developmentSecret) {
  throw new Error("Production secrets must be configured.");
}
if (parsed.data.NODE_ENV === "production" && !parsed.data.BOOTSTRAP_TOKEN_EXPIRES_AT) {
  throw new Error("BOOTSTRAP_TOKEN_EXPIRES_AT is required in production.");
}

export const env = parsed.data;
