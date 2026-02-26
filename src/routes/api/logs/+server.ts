import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listLogs, listSites } from '$lib/server/blob-store.js';

export const prerender = false;

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) throw error(401, 'Not authenticated');

	const site = url.searchParams.get('site') ?? undefined;
	const date = url.searchParams.get('date') ?? undefined;
	const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);
	const cursor = url.searchParams.get('cursor') ?? undefined;

	const [logsResult, sites] = await Promise.all([
		listLogs({ site, date, limit, cursor }),
		listSites()
	]);

	return json({
		entries: logsResult.entries,
		sites,
		cursor: logsResult.cursor,
		hasMore: logsResult.hasMore
	});
};
