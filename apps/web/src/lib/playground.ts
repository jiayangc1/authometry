export interface PlaygroundApplication {
  id: string;
  name: string;
  client_id: string;
  status: string;
  redirect_uris: string[];
  grant_types: string[];
  allowed_scopes: string[];
  token_endpoint_auth_method: string;
}

export interface PlaygroundConfiguration {
  clientId: string;
  redirectUri: string;
  scopes: string[];
}

export interface PlaygroundFlow extends PlaygroundConfiguration {
  issuer: string;
  verifier: string;
  challenge: string;
  state: string;
  nonce: string;
}

export function playgroundConfiguration(
  application: PlaygroundApplication | undefined,
  playgroundUri: string,
): PlaygroundConfiguration {
  const preferredScopes = ["openid", "profile", "email"];
  return {
    clientId: application?.client_id ?? "",
    redirectUri: application
      ? application.redirect_uris.includes(playgroundUri)
        ? playgroundUri
        : (application.redirect_uris[0] ?? "")
      : playgroundUri,
    scopes: application
      ? application.allowed_scopes.filter((scope) => preferredScopes.includes(scope))
      : preferredScopes,
  };
}

export function validatePlaygroundRequest(
  configuration: PlaygroundConfiguration,
  application: PlaygroundApplication | undefined,
): string {
  if (!configuration.clientId.trim()) return "Select an application to build the request.";
  if (!application)
    return "This client ID is not registered in the selected environment. Select an application.";
  if (application.status !== "active")
    return "This application is disabled. Select an active application.";
  if (!application.grant_types.includes("authorization_code"))
    return "This application does not support Authorization Code. Select a web, SPA, or native application.";
  if (!configuration.redirectUri || !application.redirect_uris.includes(configuration.redirectUri))
    return "Register this exact redirect URI on the application, or choose a registered callback URL.";
  if (!configuration.scopes.length) return "Select at least one scope.";
  if (configuration.scopes.some((scope) => !application.allowed_scopes.includes(scope)))
    return "The request includes scopes that are not allowed for this application.";
  return "";
}

export function parsePlaygroundFlow(saved: string | null): PlaygroundFlow | undefined {
  if (!saved) return undefined;
  try {
    const flow: unknown = JSON.parse(saved);
    if (!flow || typeof flow !== "object") return undefined;
    const candidate = flow as Record<string, unknown>;
    const required = [
      "clientId",
      "redirectUri",
      "issuer",
      "verifier",
      "challenge",
      "state",
      "nonce",
    ];
    if (required.some((key) => typeof candidate[key] !== "string" || !candidate[key]))
      return undefined;
    if (
      !Array.isArray(candidate.scopes) ||
      !candidate.scopes.every((scope) => typeof scope === "string")
    )
      return undefined;
    return candidate as unknown as PlaygroundFlow;
  } catch {
    return undefined;
  }
}

export function validatePlaygroundCallback(
  flow: PlaygroundFlow | undefined,
  parameters: URLSearchParams,
  issuer: string,
): string {
  if (!flow) return "The saved request is missing or expired. Start a new authorization request.";
  if (!parameters.get("state") || parameters.get("state") !== flow.state)
    return "The returned state does not match the saved request. Start a new authorization request.";
  if (!issuer) return "Loading the environment issuer…";
  if (flow.issuer !== issuer || (parameters.has("iss") && parameters.get("iss") !== flow.issuer))
    return "This response belongs to a different issuer. Return to the original environment or start a new request.";
  return "";
}
