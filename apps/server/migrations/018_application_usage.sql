CREATE TABLE user_application_launches (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  environment_id uuid NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES oauth_applications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES identity_users(id) ON DELETE CASCADE,
  last_launched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (environment_id, application_id, user_id)
);

CREATE INDEX user_application_launches_user_idx
  ON user_application_launches(user_id, environment_id);

INSERT INTO user_application_launches
  (workspace_id, environment_id, application_id, user_id, last_launched_at)
SELECT workspace_id, environment_id, application_id, user_id, last_launched_at
FROM user_application_assignments
WHERE last_launched_at IS NOT NULL
ON CONFLICT (environment_id, application_id, user_id)
DO UPDATE SET last_launched_at = GREATEST(
  user_application_launches.last_launched_at,
  EXCLUDED.last_launched_at
);

INSERT INTO user_application_launches
  (workspace_id, environment_id, application_id, user_id, last_launched_at)
SELECT u.workspace_id, event.environment_id, application.id, u.id, max(event.created_at)
FROM audit_events event
JOIN identity_users u
  ON u.id::text = event.actor_id AND u.workspace_id = event.workspace_id
JOIN oauth_applications application
  ON application.id::text = event.resource_id
    AND application.environment_id = event.environment_id
WHERE event.event_type = 'portal.application_launched'
  AND event.actor_type = 'user'
  AND event.resource_type = 'application'
  AND event.environment_id IS NOT NULL
GROUP BY u.workspace_id, event.environment_id, application.id, u.id
ON CONFLICT (environment_id, application_id, user_id)
DO UPDATE SET last_launched_at = GREATEST(
  user_application_launches.last_launched_at,
  EXCLUDED.last_launched_at
);

WITH application_activity AS (
  SELECT application_id, max(used_at) AS last_used_at
  FROM (
    SELECT application_id, last_used_at AS used_at
    FROM client_credentials
    WHERE last_used_at IS NOT NULL
    UNION ALL
    SELECT application_id, COALESCE(completed_at, created_at) AS used_at
    FROM authorization_traces
    WHERE application_id IS NOT NULL AND status = 'success'
  ) activity
  GROUP BY application_id
)
UPDATE oauth_applications application
SET last_used_at = GREATEST(
  COALESCE(application.last_used_at, '-infinity'::timestamptz),
  application_activity.last_used_at
)
FROM application_activity
WHERE application.id = application_activity.application_id;
