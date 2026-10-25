import "server-only";
import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { MIGRATIONS } from "./migrations";

/**
 * One connection pool per process, shared by every store (newsletter, members,
 * check-ups). The schema is created and upgraded lazily on first use because
 * nothing can run commands on the host after a deploy (docs/deployment.md).
 */
let pool: Pool | undefined;
let ready: Promise<void> | undefined;

export function databaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export async function getPool(): Promise<Pool> {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    const mysql = await import("mysql2/promise");
    pool = mysql.createPool({ uri: url, connectionLimit: 5, waitForConnections: true, dateStrings: false, timezone: "Z" });
  }
  if (!ready) ready = migrate(pool).catch((e) => { ready = undefined; throw e; });
  await ready;
  return pool;
}

/**
 * Applies pending migrations under a database-wide lock: several processes
 * (build workers prerendering content, app instances) can start against the
 * same fresh database at once, and an ALTER must not run twice.
 */
async function migrate(p: Pool) {
  const conn = await p.getConnection();
  try {
    await conn.query("SELECT GET_LOCK('schema_migrations', 60)");
    await conn.query("CREATE TABLE IF NOT EXISTS schema_migrations (id VARCHAR(64) PRIMARY KEY, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)");
    const [rows] = await conn.query<RowDataPacket[]>("SELECT id FROM schema_migrations");
    const done = new Set(rows.map((r) => r.id as string));
    for (const m of MIGRATIONS) {
      if (done.has(m.id)) continue;
      for (const stmt of m.statements) await conn.query(stmt);
      await conn.query("INSERT INTO schema_migrations (id) VALUES (?)", [m.id]);
    }
  } finally {
    await conn.query("SELECT RELEASE_LOCK('schema_migrations')").catch(() => undefined);
    conn.release();
  }
}

export type Row = RowDataPacket;
export type { ResultSetHeader, PoolConnection };

export async function query<T extends RowDataPacket = RowDataPacket>(sql: string, params: unknown[] = []): Promise<T[]> {
  const p = await getPool();
  const [rows] = await p.query<T[]>(sql, params);
  return rows;
}

export async function execute(sql: string, params: unknown[] = []): Promise<ResultSetHeader> {
  const p = await getPool();
  const [res] = await p.query<ResultSetHeader>(sql, params);
  return res;
}

export async function one<T extends RowDataPacket = RowDataPacket>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  return (await query<T>(sql, params))[0];
}

export function newId() {
  return crypto.randomUUID();
}

/** Resets the pool between tests. */
export function _resetForTests() {
  pool = undefined;
  ready = undefined;
}
