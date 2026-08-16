import { query } from "../db.js";

type QueryExecutor = (text: string, values?: unknown[]) => Promise<unknown>;

const executeQuery: QueryExecutor = (text, values) => query(text, values);

export async function recordApplicationUsage(
  applicationId: string,
  execute: QueryExecutor = executeQuery,
): Promise<void> {
  await execute("UPDATE oauth_applications SET last_used_at = now() WHERE id = $1", [
    applicationId,
  ]);
}

export async function recordPortalApplicationLaunch(
  input: {
    workspaceId: string;
    environmentId: string;
    applicationId: string;
    userId: string;
  },
  execute: QueryExecutor = executeQuery,
): Promise<void> {
  await execute(
    `INSERT INTO user_application_launches
      (workspace_id, environment_id, application_id, user_id, last_launched_at)
     VALUES ($1,$2,$3,$4,now())
     ON CONFLICT (environment_id, application_id, user_id)
     DO UPDATE SET last_launched_at = EXCLUDED.last_launched_at`,
    [input.workspaceId, input.environmentId, input.applicationId, input.userId],
  );
}
