import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { env } from "./env.js";

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.NODE_ENV === "test" ? 4 : 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: env.DATABASE_URL.includes("sslmode=require") ? { rejectUnauthorized: true } : undefined,
});

export async function query<T extends QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<T[]> {
  const result = await pool.query<T>(text, values);
  return result.rows;
}

export async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
