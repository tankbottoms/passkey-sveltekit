import { json, type RequestEvent } from '@sveltejs/kit';
import { appendLog } from '$lib/server/blob-store';

interface ClientEvent {
	event: string;
	sessionId: string;
	timestamp: string;
	url: string;
	data?: Record<string, unknown>;
	device?: {
		browser: string;
		os: string;
		deviceType: string;
		screenSize: string;
		language: string;
	};
}

export async function POST({ request, url }: RequestEvent) {
	const body = await request.json();
	const events: ClientEvent[] = Array.isArray(body) ? body : [body];
	const site = url.hostname;

	const writes = events.map((ev) =>
		appendLog({
			site,
			level: 'info',
			message: ev.event,
			timestamp: ev.timestamp || new Date().toISOString(),
			path: ev.url,
			metadata: {
				source: 'client',
				sessionId: ev.sessionId,
				device: ev.device,
				...ev.data
			}
		})
	);

	await Promise.all(writes);
	return json({ ok: true, count: events.length });
}
