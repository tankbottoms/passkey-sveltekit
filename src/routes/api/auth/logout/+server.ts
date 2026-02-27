import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { destroySession } from '$lib/server/session.js';
import { log } from '$lib/server/logger.js';

export const POST: RequestHandler = async ({ cookies, locals, url }) => {
	const userId = locals.user?.id;
	destroySession(cookies);
	log(url.hostname, 'info', `User logged out`, {
		path: '/api/auth/logout',
		metadata: { userId }
	});
	return json({ ok: true });
};
