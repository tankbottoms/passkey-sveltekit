import { dev } from '$app/environment';
import type { ServerLoad } from '@sveltejs/kit';

export const load: ServerLoad = async ({ locals }) => {
	return {
		user: locals.user,
		isDev: dev
	};
};
