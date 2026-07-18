INSERT INTO resource_scopes
  (workspace_id, environment_id, name, display_name, description, consent_description,
   sensitivity, is_system)
SELECT e.workspace_id, e.id, 'mcp:write', 'Manage Authometry with MCP',
       'Create and change Authometry resources through the MCP server using the dashboard''s management API controls.',
       'Create, edit, rotate, revoke, and delete Authometry resources',
       'restricted', true
FROM environments e
ON CONFLICT (environment_id, name) DO NOTHING;

UPDATE oauth_applications
SET allowed_scopes = array_append(allowed_scopes, 'mcp:write'), updated_at = now()
WHERE 'mcp:read' = ANY(allowed_scopes)
  AND NOT ('mcp:write' = ANY(allowed_scopes));
