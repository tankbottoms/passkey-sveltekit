import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { appendLog } from '$lib/server/blob-store.js';
import { env } from '$env/dynamic/private';

export const prerender = false;

export const POST: RequestHandler = async ({ request }) => {
	const apiKey = env.LOG_API_KEY;
	if (apiKey) {
		const auth = request.headers.get('authorization');
		if (auth !== `Bearer ${apiKey}`) {
			throw error(401, 'Invalid API key');
		}
	}

	const body = await request.json();

	const entries = Array.isArray(body) ? body : [body];
	const results = [];

	for (const entry of entries) {
		if (!entry.site || !entry.message) {
			throw error(400, 'Each log entry requires "site" and "message"');
		}

		const logged = await appendLog({
			site: entry.site,
			level: entry.level ?? 'info',
			message: entry.message,
			timestamp: entry.timestamp ?? new Date().toISOString(),
			path: entry.path,
			userAgent: entry.userAgent,
			ip: entry.ip,
			metadata: entry.metadata
		});

		results.push(logged);
	}

	return json({ ok: true, count: results.length });
};
