-- Codex requests every OIDC scope advertised in authorization-server metadata.
-- Existing dynamic MCP clients need the remaining optional identity scopes too.
UPDATE oauth_applications
SET allowed_scopes = ARRAY(
      SELECT DISTINCT added.scope
      FROM unnest(allowed_scopes || ARRAY['phone', 'address']) AS added(scope)
    ),
    updated_at = now()
WHERE client_id_source = 'dynamic';
