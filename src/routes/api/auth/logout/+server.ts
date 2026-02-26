import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { destroySession } from '$lib/server/session.js';

export const POST: RequestHandler = async ({ cookies }) => {
	destroySession(cookies);
	return json({ ok: true });
};
