import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { dev } from '$app/environment';
import { getAllCredentials } from '$lib/server/store.js';

export const POST: RequestHandler = async ({ cookies, url }) => {
	const rpID = url.hostname;

	// Allow all enrolled credentials (discoverable)
	const allCreds = getAllCredentials();

	if (allCreds.length === 0) {
		throw error(400, 'No passkeys enrolled. Register a passkey first.');
	}

	const options = await generateAuthenticationOptions({
		rpID,
		allowCredentials: allCreds.map((c) => ({
			id: c.id,
			transports: c.transports as AuthenticatorTransport[]
		})),
		userVerification: 'preferred'
	});

	cookies.set('webauthn_challenge', options.challenge, {
		httpOnly: true,
		secure: !dev,
		sameSite: 'strict',
		maxAge: 300,
		path: '/'
	});

	return json(options);
};
