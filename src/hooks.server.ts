import type { Handle } from '@sveltejs/kit';
import { getSession } from '$lib/server/session.js';
import { getUser } from '$lib/server/store.js';

export const handle: Handle = async ({ event, resolve }) => {
	const session = getSession(event.cookies);

	if (session) {
		const user = getUser(session.userId);
		event.locals.user = user;
	} else {
		event.locals.user = null;
	}

	return resolve(event);
};
