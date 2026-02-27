import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCredentialsByUser, deleteCredential } from '$lib/server/store.js';
import { log } from '$lib/server/logger.js';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Not authenticated');

	const creds = getCredentialsByUser(locals.user.id);
	return json(
		creds.map((c) => ({
			id: c.id,
			deviceType: c.deviceType,
			backedUp: c.backedUp,
			transports: c.transports,
			createdAt: c.createdAt,
			lastUsedAt: c.lastUsedAt
		}))
	);
};

export const DELETE: RequestHandler = async ({ request, locals, url }) => {
	if (!locals.user) throw error(401, 'Not authenticated');

	const { id } = await request.json();
	if (!id) throw error(400, 'Credential ID required');

	await deleteCredential(id);
	log(url.hostname, 'info', `Credential deleted: ${id}`, { metadata: { userId: locals.user.id } });
	return json({ ok: true });
};
