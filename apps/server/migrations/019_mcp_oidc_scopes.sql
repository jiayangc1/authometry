-- Existing dynamically registered MCP clients must accept the OIDC scopes
-- advertised by Authometry's discovery documents.
UPDATE oauth_applications
SET allowed_scopes = ARRAY(
      SELECT DISTINCT added.scope
      FROM unnest(allowed_scopes || ARRAY['openid', 'email', 'profile']) AS added(scope)
    ),
    updated_at = now()
WHERE client_id_source = 'dynamic';
