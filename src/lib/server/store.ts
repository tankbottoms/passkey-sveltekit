import { dev } from '$app/environment';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { getDb } from './db.js';
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

function db() {
	return getDb();
}

// -- Users --

export function getUser(id: string): User | null {
	if (dev) {
		const row = db().prepare('SELECT id, username FROM users WHERE id = ?').get(id) as User | undefined;
		return row ?? null;
	}
	return enrolledUsers.find((u) => u.id === id) ?? null;
}

export function getUserByUsername(username: string): User | null {
	if (dev) {
		const row = db()
			.prepare('SELECT id, username FROM users WHERE username = ?')
			.get(username) as User | undefined;
		return row ?? null;
	}
	return enrolledUsers.find((u) => u.username === username) ?? null;
}

export function createUser(id: string, username: string): User {
	if (!dev) throw new Error('Cannot create users in production');
	db().prepare('INSERT INTO users (id, username) VALUES (?, ?)').run(id, username);
	return { id, username };
}

// -- Credentials --

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

function enrolledToCredential(row: (typeof enrolledCredentials)[number]): StoredCredential {
	return {
		id: row.id,
		userId: row.userId,
		webAuthnUserId: row.webAuthnUserId,
		publicKey: isoBase64URL.toBuffer(row.publicKey),
		counter: row.counter,
		deviceType: row.deviceType,
		backedUp: row.backedUp,
		transports: row.transports,
		createdAt: 0,
		lastUsedAt: null
	};
}

export function getCredential(id: string): StoredCredential | null {
	if (dev) {
		const row = db().prepare('SELECT * FROM credentials WHERE id = ?').get(id) as
			| Record<string, unknown>
			| undefined;
		return row ? rowToCredential(row) : null;
	}
	const found = enrolledCredentials.find((c) => c.id === id);
	return found ? enrolledToCredential(found) : null;
}

export function getCredentialsByUser(userId: string): StoredCredential[] {
	if (dev) {
		const rows = db()
			.prepare('SELECT * FROM credentials WHERE user_id = ?')
			.all(userId) as Record<string, unknown>[];
		return rows.map(rowToCredential);
	}
	return enrolledCredentials.filter((c) => c.userId === userId).map(enrolledToCredential);
}

export function getAllCredentials(): StoredCredential[] {
	if (dev) {
		const rows = db().prepare('SELECT * FROM credentials').all() as Record<string, unknown>[];
		return rows.map(rowToCredential);
	}
	return enrolledCredentials.map(enrolledToCredential);
}

export function getAllUsers(): User[] {
	if (dev) {
		return db().prepare('SELECT id, username FROM users').all() as User[];
	}
	return [...enrolledUsers];
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
	if (!dev) throw new Error('Cannot save credentials in production');
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
}

export function updateCounter(credentialId: string, newCounter: number): void {
	if (!dev) return; // Read-only in production
	db()
		.prepare('UPDATE credentials SET counter = ?, last_used_at = unixepoch() WHERE id = ?')
		.run(newCounter, credentialId);
}

export function deleteCredential(credentialId: string): void {
	if (!dev) throw new Error('Cannot delete credentials in production');
	db().prepare('DELETE FROM credentials WHERE id = ?').run(credentialId);
}
