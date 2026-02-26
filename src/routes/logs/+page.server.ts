import { redirect } from '@sveltejs/kit';
import type { ServerLoad } from '@sveltejs/kit';

export const prerender = false;

export const load: ServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/');
	}
	return {};
};
