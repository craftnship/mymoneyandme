import type { Pool } from "mysql2/promise";

/**
 * Newsletter subscribers (section 4: newsletter sign-up with double opt-in).
 * The store is an interface so the engine is testable without a database;
 * production uses MySQL on the hosting account. Phase 3 moves this table into
 * the Prisma schema with the rest of the data model.
 */
export type SubscriberStatus = "pending" | "confirmed" | "unsubscribed";

export type Subscriber = {
  email: string;
  locale: string;
  status: SubscriberStatus;
  token: string;
  createdAt: string;
  confirmedAt?: string | null;
};

export interface SubscriberStore {
  findByEmail(email: string): Promise<Subscriber | undefined>;
  findByToken(token: string): Promise<Subscriber | undefined>;
  upsertPending(sub: Subscriber): Promise<void>;
  setStatus(email: string, status: SubscriberStatus): Promise<void>;
  listConfirmed(locale?: string): Promise<Subscriber[]>;
}

export class MemoryStore implements SubscriberStore {
  private rows = new Map<string, Subscriber>();
  async findByEmail(email: string) { return this.rows.get(email); }
  async findByToken(token: string) { return [...this.rows.values()].find((r) => r.token === token); }
  async upsertPending(sub: Subscriber) { this.rows.set(sub.email, { ...sub }); }
  async setStatus(email: string, status: SubscriberStatus) {
    const r = this.rows.get(email);
    if (r) this.rows.set(email, { ...r, status, confirmedAt: status === "confirmed" ? new Date().toISOString() : r.confirmedAt });
  }
  async listConfirmed(locale?: string) { return [...this.rows.values()].filter((r) => r.status === "confirmed" && (!locale || r.locale === locale)); }
}

const DDL = `CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  email VARCHAR(254) NOT NULL PRIMARY KEY,
  locale VARCHAR(8) NOT NULL DEFAULT 'en',
  status ENUM('pending','confirmed','unsubscribed') NOT NULL DEFAULT 'pending',
  token CHAR(48) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmed_at DATETIME NULL,
  UNIQUE KEY idx_token (token)
) CHARACTER SET utf8mb4`;

type Row = { email: string; locale: string; status: SubscriberStatus; token: string; created_at: Date; confirmed_at: Date | null };

export class MySqlStore implements SubscriberStore {
  private ready: Promise<void> | null = null;
  constructor(private pool: Pool) {}
  private async init() {
    if (!this.ready) this.ready = this.pool.query(DDL).then(() => undefined);
    return this.ready;
  }
  private map(r: Row): Subscriber {
    return { email: r.email, locale: r.locale, status: r.status, token: r.token, createdAt: r.created_at.toISOString(), confirmedAt: r.confirmed_at?.toISOString() ?? null };
  }
  async findByEmail(email: string) {
    await this.init();
    const [rows] = await this.pool.query<Row[] & import("mysql2").RowDataPacket[]>("SELECT * FROM newsletter_subscribers WHERE email = ?", [email]);
    return rows[0] ? this.map(rows[0]) : undefined;
  }
  async findByToken(token: string) {
    await this.init();
    const [rows] = await this.pool.query<Row[] & import("mysql2").RowDataPacket[]>("SELECT * FROM newsletter_subscribers WHERE token = ?", [token]);
    return rows[0] ? this.map(rows[0]) : undefined;
  }
  async upsertPending(sub: Subscriber) {
    await this.init();
    await this.pool.query(
      "INSERT INTO newsletter_subscribers (email, locale, status, token) VALUES (?, ?, 'pending', ?) ON DUPLICATE KEY UPDATE locale = VALUES(locale), status = 'pending', token = VALUES(token)",
      [sub.email, sub.locale, sub.token],
    );
  }
  async setStatus(email: string, status: SubscriberStatus) {
    await this.init();
    await this.pool.query("UPDATE newsletter_subscribers SET status = ?, confirmed_at = IF(? = 'confirmed', NOW(), confirmed_at) WHERE email = ?", [status, status, email]);
  }
  async listConfirmed(locale?: string) {
    await this.init();
    const [rows] = await this.pool.query<Row[] & import("mysql2").RowDataPacket[]>(
      locale ? "SELECT * FROM newsletter_subscribers WHERE status = 'confirmed' AND locale = ?" : "SELECT * FROM newsletter_subscribers WHERE status = 'confirmed'",
      locale ? [locale] : [],
    );
    return rows.map((r) => this.map(r));
  }
}

let shared: SubscriberStore | null = null;

/** The production store, or undefined when DATABASE_URL is not set (the sign-up then reports "not configured"). */
export async function getStore(): Promise<SubscriberStore | undefined> {
  if (shared) return shared;
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
  const mysql = await import("mysql2/promise");
  shared = new MySqlStore(mysql.createPool({ uri: url, connectionLimit: 4, waitForConnections: true }));
  return shared;
}
