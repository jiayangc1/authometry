CREATE TABLE identity_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 64),
  created_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX identity_groups_workspace_name_idx
  ON identity_groups(workspace_id, lower(name));

INSERT INTO identity_groups(workspace_id, name)
SELECT DISTINCT u.workspace_id, btrim(group_name)
FROM identity_users u
CROSS JOIN LATERAL unnest(u.groups) AS group_name
WHERE btrim(group_name) <> ''
ON CONFLICT DO NOTHING;

CREATE TABLE group_application_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  environment_id uuid NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES identity_groups(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES oauth_applications(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (environment_id, group_id, application_id)
);

CREATE INDEX group_application_assignments_group_idx
  ON group_application_assignments(group_id, environment_id);

CREATE INDEX group_application_assignments_application_idx
  ON group_application_assignments(application_id, environment_id);
