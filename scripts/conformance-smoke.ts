import process from "node:process";

interface DiscoveryDocument {
  issuer?: string;
  response_types_supported?: string[];
  code_challenge_methods_supported?: string[];
  grant_types_supported?: string[];
  authorization_endpoint?: string;
  token_endpoint?: string;
  userinfo_endpoint?: string;
  jwks_uri?: string;
  revocation_endpoint?: string;
  introspection_endpoint?: string;
  device_authorization_endpoint?: string;
  end_session_endpoint?: string;
}

interface JsonWebKeySet {
  keys?: Array<Record<string, unknown>>;
}

const origin = (
  process.argv[2] ??
  process.env.AUTHOMETRY_SERVER ??
  "http://127.0.0.1:3000"
).replace(/\/$/, "");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const health = await fetch(`${origin}/health/live`);
assert(health.ok, `Liveness returned HTTP ${health.status}.`);

const discoveryResponse = await fetch(`${origin}/.well-known/openid-configuration`);
assert(discoveryResponse.ok, `Discovery returned HTTP ${discoveryResponse.status}.`);
const discovery = (await discoveryResponse.json()) as DiscoveryDocument;
assert(discovery.issuer === origin, `Issuer mismatch: ${String(discovery.issuer)}.`);
assert(
  discovery.response_types_supported?.length === 1 &&
    discovery.response_types_supported[0] === "code",
  "Only the code response type may be advertised.",
);
assert(
  discovery.code_challenge_methods_supported?.includes("S256"),
  "S256 PKCE is not advertised.",
);
for (const grant of [
  "authorization_code",
  "refresh_token",
  "client_credentials",
  "urn:ietf:params:oauth:grant-type:device_code",
]) {
  assert(discovery.grant_types_supported?.includes(grant), `Missing grant: ${grant}.`);
}
for (const endpoint of [
  "authorization_endpoint",
  "token_endpoint",
  "userinfo_endpoint",
  "jwks_uri",
  "revocation_endpoint",
  "introspection_endpoint",
  "device_authorization_endpoint",
  "end_session_endpoint",
] as const) {
  const value = discovery[endpoint];
  assert(typeof value === "string" && value.startsWith(`${origin}/`), `Invalid ${endpoint}.`);
}

assert(discovery.jwks_uri, "Discovery does not include a JWKS URI.");
const jwksResponse = await fetch(discovery.jwks_uri);
assert(jwksResponse.ok, `JWKS returned HTTP ${jwksResponse.status}.`);
const jwks = (await jwksResponse.json()) as JsonWebKeySet;
assert(Array.isArray(jwks.keys) && jwks.keys.length > 0, "JWKS does not contain an active key.");
for (const key of jwks.keys) {
  assert(key.use === "sig" && key.alg === "RS256" && key.kid, "JWKS key metadata is incomplete.");
  assert(!("d" in key), "JWKS exposed private key material.");
}

process.stdout.write(`Authometry conformance smoke passed for ${origin}.\n`);
