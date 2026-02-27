import { put, list } from '@vercel/blob';
import { isoBase64URL } from '@simplewebauthn/server/helpers';

// Types match store.ts but defined here to avoid circular imports

interface SerializedCredential {
	id: string;
	userId: string;
	webAuthnUserId: string;
	publicKey: string; // base64url
	counter: number;
	deviceType: string;
	backedUp: boolean;
	transports: string[];
	createdAt: number;
	lastUsedAt: number | null;
}

export interface LogEntry {
	id: string;
	site: string;
	level: 'debug' | 'info' | 'warn' | 'error';
	message: string;
	timestamp: string;
	path?: string;
	userAgent?: string;
	ip?: string;
	metadata?: Record<string, unknown>;
}

// -- Internal helpers --

async function fetchBlobJson<T>(prefix: string): Promise<T | null> {
	const result = await list({ prefix });
	if (result.blobs.length === 0) return null;
	const response = await fetch(result.blobs[0].downloadUrl);
	if (!response.ok) return null;
	return response.json() as Promise<T>;
}

async function putBlobJson(pathname: string, data: unknown): Promise<string> {
	const { url } = await put(pathname, JSON.stringify(data), {
		access: 'private',
		addRandomSuffix: false,
		contentType: 'application/json'
	});
	return url;
}

// -- User/Credential persistence --

export async function loadUsers(): Promise<Array<{ id: string; username: string }>> {
	return (await fetchBlobJson<Array<{ id: string; username: string }>>('passkey-store/users.json')) ?? [];
}

export async function loadCredentials(): Promise<
	Array<{
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
	}>
> {
	const data = await fetchBlobJson<SerializedCredential[]>('passkey-store/credentials.json');
	if (!data) return [];
	return data.map((d) => ({
		...d,
		publicKey: isoBase64URL.toBuffer(d.publicKey),
		createdAt: d.createdAt ?? 0,
		lastUsedAt: d.lastUsedAt ?? null
	}));
}

export async function persistUsers(users: Array<{ id: string; username: string }>): Promise<void> {
	await putBlobJson('passkey-store/users.json', users);
}

export async function persistCredentials(
	credentials: Array<{
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
	}>
): Promise<void> {
	const serialized: SerializedCredential[] = credentials.map((c) => ({
		...c,
		publicKey: isoBase64URL.fromBuffer(new Uint8Array(c.publicKey) as Uint8Array<ArrayBuffer>)
	}));
	await putBlobJson('passkey-store/credentials.json', serialized);
}

// -- Log storage --

export async function appendLog(entry: Omit<LogEntry, 'id'>): Promise<LogEntry> {
	const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	const full: LogEntry = { id, ...entry };
	const date = entry.timestamp.slice(0, 10);
	await put(`logs/${entry.site}/${date}/${id}.json`, JSON.stringify(full), {
		access: 'private',
		contentType: 'application/json'
	});
	return full;
}

export async function listLogs(options?: {
	site?: string;
	date?: string;
	limit?: number;
	cursor?: string;
}): Promise<{ entries: LogEntry[]; cursor?: string; hasMore: boolean }> {
	let prefix = 'logs/';
	if (options?.site) {
		prefix += `${options.site}/`;
		if (options?.date) {
			prefix += `${options.date}/`;
		}
	}

	const result = await list({
		prefix,
		limit: options?.limit ?? 50,
		cursor: options?.cursor
	});

	const entries: LogEntry[] = [];
	const fetches = result.blobs.map(async (blob) => {
		try {
			const resp = await fetch(blob.downloadUrl);
			if (resp.ok) return (await resp.json()) as LogEntry;
		} catch {
			// skip malformed
		}
		return null;
	});

	const results = await Promise.all(fetches);
	for (const r of results) {
		if (r) entries.push(r);
	}

	entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

	return {
		entries,
		cursor: result.cursor,
		hasMore: result.hasMore
	};
}

export async function listSites(): Promise<string[]> {
	const result = await list({ prefix: 'logs/', mode: 'folded' });
	return (result.folders ?? []).map((f) => f.replace('logs/', '').replace(/\/$/, '')).filter(Boolean);
}
