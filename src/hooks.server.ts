import type { Handle } from '@sveltejs/kit';
import { getSession } from '$lib/server/session.js';
import { getUser, initStore } from '$lib/server/store.js';
import { log } from '$lib/server/logger.js';

export const handle: Handle = async ({ event, resolve }) => {
	// Bridge Cloudflare Pages secrets into process.env for libraries that expect it
	// (e.g. @vercel/blob reads process.env.BLOB_READ_WRITE_TOKEN)
	const platformEnv = (event.platform as Record<string, unknown>)?.env as Record<string, string> | undefined;
	if (platformEnv) {
		for (const [key, value] of Object.entries(platformEnv)) {
			if (typeof value === 'string' && !process.env[key]) {
				process.env[key] = value;
			}
		}
	}

	await initStore();

	const session = getSession(event.cookies);

	if (session) {
		const user = getUser(session.userId);
		event.locals.user = user;
	} else {
		event.locals.user = null;
	}

	const response = await resolve(event);

	// Log page/API requests, skip static assets
	const path = event.url.pathname;
	if (!path.startsWith('/_app/') && !path.startsWith('/favicon')) {
		const hostname = event.url.hostname;
		const method = event.request.method;
		const userId = event.locals.user?.id;
		log(hostname, 'info', `${method} ${path} ${response.status}`, {
			path,
			userAgent: event.request.headers.get('user-agent') ?? undefined,
			ip: event.getClientAddress(),
			metadata: { userId }
		});
	}

	return response;
};
