import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "../env.js";
import { ApiError } from "./http.js";

export type SocialProvider = "google" | "github";

export interface SocialProfile {
  subject: string;
  email: string;
  name: string;
  emailVerified: boolean;
}

export function socialProviderConfigured(provider: SocialProvider): boolean {
  return provider === "google"
    ? Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)
    : Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);
}

export function socialAuthorizationUrl(
  provider: SocialProvider,
  redirectUri: string,
  state: string,
  verifierChallenge: string,
  nonce: string,
): URL {
  const clientId = provider === "google" ? env.GOOGLE_CLIENT_ID : env.GITHUB_CLIENT_ID;
  const clientSecret = provider === "google" ? env.GOOGLE_CLIENT_SECRET : env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new ApiError(404, "provider_disabled", `${provider} authentication is not configured.`);
  }

  const target =
    provider === "google"
      ? new URL("https://accounts.google.com/o/oauth2/v2/auth")
      : new URL("https://github.com/login/oauth/authorize");
  target.searchParams.set("client_id", clientId);
  target.searchParams.set("redirect_uri", redirectUri);
  target.searchParams.set("response_type", "code");
  target.searchParams.set(
    "scope",
    provider === "google" ? "openid email profile" : "read:user user:email",
  );
  target.searchParams.set("state", state);
  target.searchParams.set("code_challenge", verifierChallenge);
  target.searchParams.set("code_challenge_method", "S256");
  if (provider === "google") target.searchParams.set("nonce", nonce);
  return target;
}

export async function exchangeSocialCode(
  provider: SocialProvider,
  code: string,
  redirectUri: string,
  verifier: string,
  nonce: string,
): Promise<SocialProfile> {
  const clientId = provider === "google" ? env.GOOGLE_CLIENT_ID! : env.GITHUB_CLIENT_ID!;
  const clientSecret =
    provider === "google" ? env.GOOGLE_CLIENT_SECRET! : env.GITHUB_CLIENT_SECRET!;
  const tokenUrl =
    provider === "google"
      ? "https://oauth2.googleapis.com/token"
      : "https://github.com/login/oauth/access_token";
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
    grant_type: "authorization_code",
  });
  const tokenResponse = await fetch(tokenUrl, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const token = (await tokenResponse.json()) as {
    access_token?: string;
    id_token?: string;
    error?: string;
  };
  if (!tokenResponse.ok || !token.access_token) {
    throw new ApiError(
      401,
      "social_exchange_failed",
      "The social provider did not accept the callback.",
    );
  }
  if (provider === "google") {
    if (!token.id_token) {
      throw new ApiError(401, "invalid_id_token", "Google did not return an ID token.");
    }
    const result = await jwtVerify(
      token.id_token,
      createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs")),
      {
        issuer: ["https://accounts.google.com", "accounts.google.com"],
        audience: clientId,
      },
    );
    if (
      result.payload.nonce !== nonce ||
      !result.payload.sub ||
      typeof result.payload.email !== "string"
    ) {
      throw new ApiError(401, "invalid_id_token", "Google identity validation failed.");
    }
    return {
      subject: result.payload.sub,
      email: result.payload.email.toLowerCase(),
      name: typeof result.payload.name === "string" ? result.payload.name : result.payload.email,
      emailVerified: result.payload.email_verified === true,
    };
  }

  const headers = {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token.access_token}`,
    "user-agent": "Authometry",
  };
  const [profileResponse, emailsResponse] = await Promise.all([
    fetch("https://api.github.com/user", { headers }),
    fetch("https://api.github.com/user/emails", { headers }),
  ]);
  const profile = (await profileResponse.json()) as { id?: number; name?: string; login?: string };
  const emails = (await emailsResponse.json()) as Array<{
    email: string;
    primary: boolean;
    verified: boolean;
  }>;
  const email =
    emails.find((candidate) => candidate.primary && candidate.verified) ??
    emails.find((candidate) => candidate.verified);
  if (!profileResponse.ok || !emailsResponse.ok || !profile.id || !email) {
    throw new ApiError(
      401,
      "unverified_social_email",
      "GitHub must provide a verified email address.",
    );
  }
  return {
    subject: String(profile.id),
    email: email.email.toLowerCase(),
    name: profile.name ?? profile.login ?? email.email,
    emailVerified: true,
  };
}
