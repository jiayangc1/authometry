# OAuth 2.0 and OpenID Connect

Authometry is an OAuth 2.0 authorization server and OpenID Provider. Each environment has an issuer URL, applications, signing keys, users, policies, scopes, and token lifetimes.

## MCP authorization

The environment's MCP resource is `<issuer>/mcp`. It publishes RFC 9728 protected-resource metadata, challenges unauthenticated clients with `mcp:read mcp:write`, and advertises Dynamic Client Registration through authorization-server metadata. Public MCP clients use Authorization Code with mandatory S256 PKCE and include the exact MCP `resource` in authorization, token, and refresh requests. They can request `offline_access` when refresh tokens are needed.

MCP authorization uses the Authometry administrator account rather than an application identity user because the tools expose workspace configuration, management operations, and redacted operational traces. The consent screen identifies the MCP client, canonical resource, and separate `mcp:read` and `mcp:write` permissions before approval. Issued access tokens contain `authometry_principal=admin`, the approving workspace and role, and an audience equal to the MCP resource. `/mcp` validates all of those bindings on every request, and management tools additionally require `mcp:write`.

## Discover an issuer

Clients should load metadata rather than construct endpoint URLs:

```bash
curl https://authometry.ch3n.cc/.well-known/openid-configuration
```

The discovery document advertises Authorization Code, Refresh Token, Client Credentials, Device Authorization, and Token Exchange grants; the `code` response type; `query` response mode; S256 PKCE; public subjects; RS256 ID tokens; and `client_secret_basic`, `client_secret_post`, `private_key_jwt`, and `none` client authentication.

Environment-specific issuers may use `/<environmentSlug>`, `/w/<workspaceSlug>`, or `/w/<workspaceSlug>/<environmentSlug>` prefixes. Always use the issuer stored on the environment and the endpoints returned by its discovery document.

## Endpoints

| Endpoint                            | Method | Purpose                                                                    |
| ----------------------------------- | ------ | -------------------------------------------------------------------------- |
| `/.well-known/openid-configuration` | GET    | OIDC provider metadata.                                                    |
| `/.well-known/jwks.json`            | GET    | Active and retiring public signing keys.                                   |
| `/oauth/authorize`                  | GET    | Begin Authorization Code flow.                                             |
| `/oauth/par`                        | POST   | Push a signed, structured agent authorization request.                     |
| `/oauth/token`                      | POST   | Exchange codes and refresh, client, or device credentials for tokens.      |
| `/oauth/userinfo`                   | GET    | Return claims for a bearer access token.                                   |
| `/oauth/device/authorization`       | POST   | Begin Device Authorization flow.                                           |
| `/oauth/device`                     | GET    | Redirect the user to the device verification UI.                           |
| `/oauth/revoke`                     | POST   | Revoke a refresh family or JWT access token.                               |
| `/oauth/introspect`                 | POST   | Inspect an access or refresh token for the authenticated client.           |
| `/oauth/logout`                     | GET    | Clear the user session and optionally redirect to a registered logout URI. |

Token, device, revocation, and introspection requests use `application/x-www-form-urlencoded` bodies.

## Client types and authentication

| Type      | Typical use                                 | Token endpoint method                              |
| --------- | ------------------------------------------- | -------------------------------------------------- |
| `web`     | Server-rendered or backend-assisted web app | `client_secret_basic` preferred                    |
| `spa`     | Browser-only app                            | `none`; always use PKCE                            |
| `native`  | Desktop or mobile app                       | `none`; always use PKCE                            |
| `machine` | Service-to-service process                  | `client_secret_basic` preferred                    |
| `device`  | Input-constrained device                    | Depends on whether the device can protect a secret |

With HTTP Basic authentication, encode `client_id:client_secret` and send it in `Authorization: Basic ...`. With `client_secret_post`, send both values in the form body. Public clients send `client_id` and no secret.

Client credentials are opaque and stored as hashes. A newly generated secret is shown once. Rotate by creating a second credential, deploying it to the client, and revoking the old credential.

## Authorization Code with PKCE

### User accounts and the sign-in button

Authometry is the identity provider, not a shared consumer account network. Each workspace has its
own user directory, separate from the administrator accounts used to access the Authometry
dashboard. An application can label its entry point **Continue with Authometry** and send the user
through Authorization Code with PKCE.

Password users must already exist in the workspace directory. When Google or GitHub is configured,
the first successful social sign-in creates a workspace identity automatically; later sign-ins use
that linked identity. If the provider's verified email already belongs to a password user,
Authometry asks for that user's password once and then attaches the provider to the existing user
instead of creating a duplicate. Applications should begin the flow on their own backend or
authentication library so that PKCE, `state`, and `nonce` are generated and validated server-side.
A visual button must not replace those protocol protections.

Generate a high-entropy verifier and its base64url-encoded SHA-256 challenge. Authometry supports S256, not `plain`.

```js
import { createHash, randomBytes } from "node:crypto";

const verifier = randomBytes(48).toString("base64url");
const challenge = createHash("sha256").update(verifier).digest("base64url");
```

Redirect the browser to the authorization endpoint:

```text
https://authometry.ch3n.cc/oauth/authorize?
  response_type=code&
  client_id=CLIENT_ID&
  redirect_uri=https%3A%2F%2Fclient.example.com%2Fcallback&
  scope=openid%20profile%20email%20offline_access&
  state=RANDOM_STATE&
  nonce=RANDOM_NONCE&
  code_challenge=BASE64URL_SHA256_CHALLENGE&
  code_challenge_method=S256
```

Authometry validates the client and response type before redirecting. The complete redirect URI must exactly match a registered value. Request `openid` for an ID token and `offline_access` for a refresh token. Preserve and compare `state`; preserve `nonce` and compare it with the ID-token claim.

After authentication, policy evaluation, and consent, the callback receives `code` and the original `state`. Exchange the single-use code:

```bash
curl -u "$CLIENT_ID:$CLIENT_SECRET" \
  -H 'content-type: application/x-www-form-urlencoded' \
  -d grant_type=authorization_code \
  -d code="$CODE" \
  -d redirect_uri=https://client.example.com/callback \
  -d code_verifier="$VERIFIER" \
  https://authometry.ch3n.cc/oauth/token
```

The response contains a bearer `access_token`, `expires_in`, and `scope`; it includes an `id_token` for OpenID requests and a `refresh_token` when `offline_access` was authorized.

## Refresh tokens

```bash
curl -u "$CLIENT_ID:$CLIENT_SECRET" \
  -H 'content-type: application/x-www-form-urlencoded' \
  -d grant_type=refresh_token \
  -d refresh_token="$REFRESH_TOKEN" \
  https://authometry.ch3n.cc/oauth/token
```

Every successful use rotates the refresh token. Replace the stored token atomically with the new response. Reusing a consumed token marks the family as reused and revokes the entire family. A refresh request may narrow, but not expand, its original scopes.

## Client Credentials

Enable `client_credentials` on a confidential machine application. The requested scopes must be assigned to the client; `openid` is excluded from the default scope set because no user is present.

```bash
curl -u "$CLIENT_ID:$CLIENT_SECRET" \
  -H 'content-type: application/x-www-form-urlencoded' \
  -d grant_type=client_credentials \
  -d 'scope=events:read events:write' \
  https://authometry.ch3n.cc/oauth/token
```

The returned JWT represents the application as its subject and does not include an ID or refresh token.

## Device Authorization

Request a device and user code:

```bash
curl -u "$CLIENT_ID:$CLIENT_SECRET" \
  -H 'content-type: application/x-www-form-urlencoded' \
  -d 'scope=openid profile' \
  https://authometry.ch3n.cc/oauth/device/authorization
```

Show `user_code` and `verification_uri` to the user, or provide `verification_uri_complete`. The response expires in 600 seconds and specifies a five-second polling interval. Poll without exceeding that interval:

```bash
curl -u "$CLIENT_ID:$CLIENT_SECRET" \
  -H 'content-type: application/x-www-form-urlencoded' \
  -d grant_type=urn:ietf:params:oauth:grant-type:device_code \
  -d device_code="$DEVICE_CODE" \
  https://authometry.ch3n.cc/oauth/token
```

Pending authorization returns `authorization_pending`; polling too quickly returns `slow_down`. Stop on approval, denial, or expiry. A device code is consumed only once.

## UserInfo and claims

```bash
curl -H "authorization: Bearer $ACCESS_TOKEN" \
  https://authometry.ch3n.cc/oauth/userinfo
```

UserInfo validates signature, issuer, audience, revocation, client route, and active user status. `profile` enables `name` and `groups`; `email` enables `email` and `email_verified`. Claim mappings can add non-reserved values to access tokens, ID tokens, and UserInfo.

Clients must validate JWT signature, `iss`, `aud`, `exp`, and the expected token context. OIDC clients must also validate `nonce` when one was sent. Fetch JWKS by `kid` and honor its cache headers.

## Revocation and introspection

Both endpoints require client authentication. Revoking a refresh token revokes its full family. Revoking an access token records its JWT ID until expiry. Revocation deliberately returns success for unknown tokens.

Introspection returns `active: true` only when the token is valid, unexpired, unrevoked, and belongs to the authenticated client. Otherwise it returns `{ "active": false }`.

## Agent authorization

Agents are registered through `POST /api/v1/agents` with their own identifier, operator, OAuth client, public JWK, maximum capabilities, allowed resource audiences, redirect URIs, delegation settings, and authorization lifetime. Disabling an agent also disables its OAuth client and revokes all of its active grants.

An agent sends a short-lived signed assertion to `/oauth/par` using `Authorization: AgentAssertion <JWT>`. The assertion must use the registered key, identify the agent in both `iss` and `sub`, target the PAR endpoint in `aud`, and contain fresh `iat`, `exp`, and single-use `jti` claims. The form body contains mandatory S256 PKCE fields, `resource`, `scope`, `purpose`, and JSON `authorization_details` entries of type `agent_action`. Authometry checks these values against the registration before returning a single-use 90-second `request_uri`.

After direct user authentication and consent, Authometry stores a delegation grant independently from the code and token. The code exchange requires `private_key_jwt` client authentication and a DPoP proof bound to `POST <issuer>/oauth/token`. The access token has the user as `sub`; the agent and operator in `act`; the target API as `aud`; the approved structure in `authorization_details`; and `authometry_grant_id`, optional `authometry_task_id`, and `cnf.jkt` claims. Agent grants never issue refresh tokens.

One-level agent delegation uses RFC 8693 Token Exchange. The child agent supplies the parent access token, its own actor identity token, a DPoP proof, resource, and reduced scope. Exchange succeeds only when the parent agent may delegate, the child may receive delegation, depth remains within the parent registration, the audience is unchanged, scopes are a subset, expiration does not exceed the parent, and the child registration independently permits the resource and scopes. The child token records a nested `act` chain and parent grant ID.

Management APIs expose `GET /api/v1/agents`, `GET /api/v1/agent-grants`, grant revocation, usage recording, and the agent kill switch. Resource servers should introspect when immediate revocation or usage-limit enforcement is required; introspection rejects disabled, revoked, completed, and expired grants.

A registered agent may also use `client_credentials` with `private_key_jwt` when it acts as itself rather than for a person. It must request one of its assigned resource audiences. The resulting token uses the agent ID as `sub` and deliberately has no `act` claim or delegation grant ID.

## Logout

Send `id_token_hint` and `post_logout_redirect_uri` to `/oauth/logout`. Authometry redirects away from its own origin only when the ID token resolves to an application and the complete redirect URI is registered for that application. Invalid hints never expand the redirect target.

## Prompts, consent, and policies

The provider advertises `none`, `login`, `consent`, and `select_account`. `prompt=none` never renders interaction and returns an OAuth error if login or consent is required. Application and instance settings determine whether consent is required; existing grants can satisfy later requests for the same scope set.

Enabled policies assigned to the application are evaluated before authorization. Conditions support `equals`, `not_equals`, `contains`, and `in` against user, request, application, and environment context. All conditions in a policy must match; a matching policy allows the request, while its configured fallback explains denial.

## Unsupported features

Authometry v1 does not support implicit, hybrid, resource-owner password, dynamic client registration, CIBA, FAPI, JAR, JARM, plain PKCE, anonymous agents, recursive delegation beyond the registered limit, or broad agent refresh tokens. PAR and DPoP are supported for the registered-agent workflow described above; Authometry does not claim the broader FAPI conformance profiles.
