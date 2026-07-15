import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./db.js";

const migrationDirectory = process.env.MIGRATIONS_PATH
  ? resolve(process.env.MIGRATIONS_PATH)
  : resolve(fileURLToPath(new URL("../migrations", import.meta.url)));

export async function migrate(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtext('authometry:migrations'))");
    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const applied = new Set(
      (await client.query<{ version: string }>("SELECT version FROM schema_migrations")).rows.map(
        ({ version }) => version,
      ),
    );
    const files = (await readdir(migrationDirectory))
      .filter((file) => file.endsWith(".sql"))
      .sort();
    for (const file of files) {
      if (applied.has(file)) continue;
      await client.query("BEGIN");
      try {
        await client.query(await readFile(join(migrationDirectory, file), "utf8"));
        await client.query("INSERT INTO schema_migrations(version) VALUES ($1)", [file]);
        await client.query("COMMIT");
        process.stdout.write(`Applied migration ${file}\n`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client
      .query("SELECT pg_advisory_unlock(hashtext('authometry:migrations'))")
      .catch(() => undefined);
    client.release();
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  await migrate();
  await pool.end();
}
