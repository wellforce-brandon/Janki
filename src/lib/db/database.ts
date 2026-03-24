import Database from "@tauri-apps/plugin-sql";

export type { Database };

import { migrations } from "./migrations";

let db: Database | null = null;
let dbInitPromise: Promise<Database> | null = null;

export type QueryResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function safeQuery<T>(fn: () => Promise<T>): Promise<QueryResult<T>> {
	try {
		const data = await fn();
		return { ok: true, data };
	} catch (e) {
		const error = e instanceof Error ? e.message : String(e);
		console.error("[DB Error]", error);
		return { ok: false, error };
	}
}

/**
 * Execute multiple static SQL statements atomically in a single call.
 *
 * tauri-plugin-sql uses a connection pool (SQLx), so BEGIN/COMMIT across
 * separate execute() calls can land on different connections and fail with
 * "cannot commit -- no transaction is active". This function concatenates
 * all statements into one string so SQLite processes them on a single
 * connection as one atomic batch.
 *
 * Use this for static SQL (no parameter binding).
 */
export async function executeBatch(statements: string[]): Promise<void> {
	const db = await getDb();
	const batch = ["BEGIN IMMEDIATE", ...statements, "COMMIT"].join(";\n");
	try {
		await db.execute(batch);
	} catch (e) {
		await db.execute("ROLLBACK").catch(() => {});
		throw e;
	}
}

/**
 * Execute multiple operations that need parameter binding.
 *
 * WARNING: tauri-plugin-sql uses a connection pool, so each execute() call
 * may land on a different connection. This means the BEGIN/COMMIT wrapping
 * is best-effort -- it usually works for a single-user desktop app but is
 * not guaranteed atomic. For guaranteed atomicity with static SQL, use
 * executeBatch() instead.
 *
 * TODO: Replace with Rust-side transaction commands for true atomicity.
 */
export async function withTransaction<T>(fn: (db: Database) => Promise<T>): Promise<T> {
	const db = await getDb();
	await db.execute("BEGIN IMMEDIATE");
	try {
		const result = await fn(db);
		await db.execute("COMMIT");
		return result;
	} catch (e) {
		await db.execute("ROLLBACK").catch(() => {});
		throw e;
	}
}

export function sqlPlaceholders(count: number): string {
	if (count <= 0) throw new Error(`sqlPlaceholders: count must be > 0, got ${count}`);
	return Array(count).fill("?").join(",");
}

export async function getDb(): Promise<Database> {
	if (db) return db;
	if (dbInitPromise) return dbInitPromise;
	dbInitPromise = (async () => {
		const instance = await Database.load("sqlite:janki.db");
		await runMigrations(instance);
		db = instance;
		return instance;
	})().catch((e) => {
		dbInitPromise = null;
		throw e;
	});
	return dbInitPromise;
}

export async function closeDb(): Promise<void> {
	if (db) {
		await db.close();
		db = null;
		dbInitPromise = null;
	}
}

async function runMigrations(database: Database): Promise<void> {
	// Ensure settings table exists for version tracking
	await database.execute(`
		CREATE TABLE IF NOT EXISTS settings (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL
		)
	`);

	const rows = await database.select<{ value: string }[]>(
		"SELECT value FROM settings WHERE key = 'schema_version'",
	);
	const currentVersion = rows.length > 0 ? Number.parseInt(rows[0].value, 10) : 0;

	// Validate migration versions are strictly ascending
	for (let i = 1; i < migrations.length; i++) {
		if (migrations[i].version <= migrations[i - 1].version) {
			throw new Error(
				`Migration versions out of order: ${migrations[i - 1].version} -> ${migrations[i].version}`,
			);
		}
	}

	for (const migration of migrations) {
		if (migration.version > currentVersion) {
			console.log(`Running migration v${migration.version}: ${migration.description}`);
			if (!Array.isArray(migration.up)) {
				console.warn(
					`[Migration] v${migration.version} uses string format -- prefer string[] to avoid semicolon splitting issues`,
				);
			}
			const statements = (Array.isArray(migration.up) ? migration.up : migration.up.split(";"))
				.map((s) => s.trim())
				.filter((s) => s.length > 0);
			// Batch migration into a single execute() call to guarantee connection affinity.
			// Includes the schema_version update in the same batch.
			const batch = [
				"BEGIN IMMEDIATE",
				...statements,
				`INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '${migration.version}')`,
				"COMMIT",
			].join(";\n");
			try {
				await database.execute(batch);
			} catch (e) {
				await database.execute("ROLLBACK").catch(() => {});
				throw e;
			}
		}
	}
}
