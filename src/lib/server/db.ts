import type BetterSqlite3 from 'better-sqlite3';

const DB_PATH = 'data/app.db';

let _db: BetterSqlite3.Database | null = null;

export function getDb(): BetterSqlite3.Database {
	if (!_db) {
		// Dynamic import to avoid loading native module in production
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const Database = require('better-sqlite3');
		_db = new Database(DB_PATH);
		(_db as BetterSqlite3.Database).pragma('journal_mode = WAL');
		(_db as BetterSqlite3.Database).pragma('foreign_keys = ON');
		initSchema(_db as BetterSqlite3.Database);
	}
	return _db as BetterSqlite3.Database;
}

function initSchema(db: BetterSqlite3.Database) {
	db.exec(`
		CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			username TEXT UNIQUE NOT NULL,
			created_at INTEGER NOT NULL DEFAULT (unixepoch())
		);

		CREATE TABLE IF NOT EXISTS credentials (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			webauthn_user_id TEXT NOT NULL,
			public_key TEXT NOT NULL,
			counter INTEGER NOT NULL DEFAULT 0,
			device_type TEXT NOT NULL DEFAULT 'singleDevice',
			backed_up INTEGER NOT NULL DEFAULT 0,
			transports TEXT,
			created_at INTEGER NOT NULL DEFAULT (unixepoch()),
			last_used_at INTEGER
		);

		CREATE INDEX IF NOT EXISTS idx_credentials_user_id ON credentials(user_id);
	`);
}
