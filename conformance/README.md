# OpenID conformance plan

Authometry targets the OpenID Foundation OP tests relevant to a public/confidential web provider using Authorization Code flow:

- OIDC Core: discovery, issuer validation, authorization code, `nonce`, `prompt`, `max_age`, `auth_time`, ID token signatures, UserInfo, and RP-initiated logout.
- OAuth 2.0 Authorization Server: exact redirect matching, state round trips, token endpoint authentication, error responses, and code replay rejection.
- PKCE: S256 success, missing verifier, incorrect verifier, and authorization-code interception resistance.
- Refresh token rotation: successful rotation, scope narrowing, reuse detection, and token-family revocation.
- Dynamic client registration is intentionally excluded from v1 and must not be selected in a formal plan.
- Implicit, hybrid, resource-owner password, CIBA, FAPI, JAR, and JARM profiles are outside the v1 claim set. PAR and DPoP are implemented for registered agent authorization but are not yet included in the formal conformance plan.

Run `pnpm conformance -- https://authometry.ch3n.cc` for the repository smoke plan. A formal OpenID Foundation conformance-suite run is required before making any certification claim; results and exported suite logs should be attached to the release record.

The suite client should be registered with exact callback and post-logout redirect URIs supplied by the conformance runner, `authorization_code` and `refresh_token` grants, S256 PKCE, `client_secret_basic`, and `openid profile email offline_access` scopes.
