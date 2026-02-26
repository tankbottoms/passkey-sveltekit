import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { dev } from '$app/environment';
import { saveCredential } from '$lib/server/store.js';
import { createSession } from '$lib/server/session.js';

export const POST: RequestHandler = async ({ request, cookies, url }) => {
	if (!dev) throw error(403, 'Registration is only available in development');

	const body = await request.json();

	const expectedChallenge = cookies.get('webauthn_challenge');
	const userId = cookies.get('webauthn_user_id');

	if (!expectedChallenge || !userId) {
		throw error(400, 'No pending registration challenge');
	}

	const rpID = url.hostname;
	const origin = url.origin;

	let verification;
	try {
		verification = await verifyRegistrationResponse({
			response: body,
			expectedChallenge,
			expectedOrigin: origin,
			expectedRPID: rpID
		});
	} catch (err) {
		console.error('Registration verification failed:', err);
		throw error(400, err instanceof Error ? err.message : 'Verification failed');
	}

	// Clean up challenge cookies
	cookies.delete('webauthn_challenge', { path: '/' });
	cookies.delete('webauthn_user_id', { path: '/' });

	if (!verification.verified || !verification.registrationInfo) {
		return json({ verified: false });
	}

	const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

	saveCredential({
		id: credential.id,
		userId,
		webAuthnUserId: body.response?.userHandle ?? userId,
		publicKey: credential.publicKey,
		counter: credential.counter,
		deviceType: credentialDeviceType,
		backedUp: credentialBackedUp,
		transports: credential.transports ?? []
	});

	// Auto-login after registration
	createSession(cookies, userId);

	return json({ verified: true });
};
