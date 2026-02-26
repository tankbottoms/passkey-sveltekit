import { dev } from '$app/environment';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { enrolledUsers, enrolledCredentials } from './enrolled-data.js';

export interface User {
	id: string;
	username: string;
}

export interface StoredCredential {
	id: string;
	userId: string;
	webAuthnUserId: string;
	publicKey: Uint8Array;
	counter: number;
	deviceType: string;
	backedUp: boolean;
	transports: string[];
	createdAt: number;
	lastUsedAt: number | null;
}

// -- In-memory store (production) --
// Seeded from enrolled-data.ts, allows runtime additions (lost on cold start)

const memUsers = new Map<string, User>();
const memCredentials = new Map<string, StoredCredential>();

function seedMemory() {
	if (memUsers.size > 0 || memCredentials.size > 0) return;
	for (const u of enrolledUsers) {
		memUsers.set(u.id, { ...u });
	}
	for (const c of enrolledCredentials) {
		memCredentials.set(c.id, {
			id: c.id,
			userId: c.userId,
			webAuthnUserId: c.webAuthnUserId,
			publicKey: isoBase64URL.toBuffer(c.publicKey),
			counter: c.counter,
			deviceType: c.deviceType,
			backedUp: c.backedUp,
			transports: c.transports,
			createdAt: 0,
			lastUsedAt: null
		});
	}
}

// -- SQLite helpers (dev only) --

function db() {
	const { getDb } = require('./db.js');
	return getDb();
}

function rowToCredential(row: Record<string, unknown>): StoredCredential {
	return {
		id: row.id as string,
		userId: row.user_id as string,
		webAuthnUserId: row.webauthn_user_id as string,
		publicKey: isoBase64URL.toBuffer(row.public_key as string),
		counter: row.counter as number,
		deviceType: row.device_type as string,
		backedUp: (row.backed_up as number) === 1,
		transports: JSON.parse((row.transports as string) || '[]'),
		createdAt: row.created_at as number,
		lastUsedAt: (row.last_used_at as number) ?? null
	};
}

// -- Users --

export function getUser(id: string): User | null {
	if (dev) {
		const row = db().prepare('SELECT id, username FROM users WHERE id = ?').get(id) as User | undefined;
		return row ?? null;
	}
	seedMemory();
	return memUsers.get(id) ?? null;
}

export function getUserByUsername(username: string): User | null {
	if (dev) {
		const row = db()
			.prepare('SELECT id, username FROM users WHERE username = ?')
			.get(username) as User | undefined;
		return row ?? null;
	}
	seedMemory();
	for (const u of memUsers.values()) {
		if (u.username === username) return u;
	}
	return null;
}

export function createUser(id: string, username: string): User {
	if (dev) {
		db().prepare('INSERT INTO users (id, username) VALUES (?, ?)').run(id, username);
		return { id, username };
	}
	seedMemory();
	const user = { id, username };
	memUsers.set(id, user);
	return user;
}

// -- Credentials --

export function getCredential(id: string): StoredCredential | null {
	if (dev) {
		const row = db().prepare('SELECT * FROM credentials WHERE id = ?').get(id) as
			| Record<string, unknown>
			| undefined;
		return row ? rowToCredential(row) : null;
	}
	seedMemory();
	return memCredentials.get(id) ?? null;
}

export function getCredentialsByUser(userId: string): StoredCredential[] {
	if (dev) {
		const rows = db()
			.prepare('SELECT * FROM credentials WHERE user_id = ?')
			.all(userId) as Record<string, unknown>[];
		return rows.map(rowToCredential);
	}
	seedMemory();
	return [...memCredentials.values()].filter((c) => c.userId === userId);
}

export function getAllCredentials(): StoredCredential[] {
	if (dev) {
		const rows = db().prepare('SELECT * FROM credentials').all() as Record<string, unknown>[];
		return rows.map(rowToCredential);
	}
	seedMemory();
	return [...memCredentials.values()];
}

export function getAllUsers(): User[] {
	if (dev) {
		return db().prepare('SELECT id, username FROM users').all() as User[];
	}
	seedMemory();
	return [...memUsers.values()];
}

export function saveCredential(cred: {
	id: string;
	userId: string;
	webAuthnUserId: string;
	publicKey: Uint8Array;
	counter: number;
	deviceType: string;
	backedUp: boolean;
	transports: string[];
}): void {
	if (dev) {
		db()
			.prepare(
				`INSERT INTO credentials (id, user_id, webauthn_user_id, public_key, counter, device_type, backed_up, transports)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.run(
				cred.id,
				cred.userId,
				cred.webAuthnUserId,
				isoBase64URL.fromBuffer(new Uint8Array(cred.publicKey) as Uint8Array<ArrayBuffer>),
				cred.counter,
				cred.deviceType,
				cred.backedUp ? 1 : 0,
				JSON.stringify(cred.transports)
			);
		return;
	}
	seedMemory();
	memCredentials.set(cred.id, {
		...cred,
		publicKey: new Uint8Array(cred.publicKey),
		createdAt: Math.floor(Date.now() / 1000),
		lastUsedAt: null
	});
}

export function updateCounter(credentialId: string, newCounter: number): void {
	if (dev) {
		db()
			.prepare('UPDATE credentials SET counter = ?, last_used_at = unixepoch() WHERE id = ?')
			.run(newCounter, credentialId);
		return;
	}
	seedMemory();
	const cred = memCredentials.get(credentialId);
	if (cred) {
		cred.counter = newCounter;
		cred.lastUsedAt = Math.floor(Date.now() / 1000);
	}
}

export function deleteCredential(credentialId: string): void {
	if (dev) {
		db().prepare('DELETE FROM credentials WHERE id = ?').run(credentialId);
		return;
	}
	seedMemory();
	memCredentials.delete(credentialId);
}
