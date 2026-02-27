import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { saveCredential } from '$lib/server/store.js';
import { createSession } from '$lib/server/session.js';
import { log } from '$lib/server/logger.js';

export const POST: RequestHandler = async ({ request, cookies, url }) => {

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
		log(url.hostname, 'error', `Enrollment verification failed: ${err instanceof Error ? err.message : 'unknown'}`, {
			path: '/api/auth/register/verify',
			metadata: { userId }
		});
		throw error(400, err instanceof Error ? err.message : 'Verification failed');
	}

	// Clean up challenge cookies
	cookies.delete('webauthn_challenge', { path: '/' });
	cookies.delete('webauthn_user_id', { path: '/' });

	if (!verification.verified || !verification.registrationInfo) {
		log(url.hostname, 'warn', `Enrollment verification rejected for user ${userId}`, {
			path: '/api/auth/register/verify',
			metadata: { userId }
		});
		return json({ verified: false });
	}

	const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

	await saveCredential({
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

	log(url.hostname, 'info', `New passkey registered for user ${userId}`, {
		path: '/api/auth/register/verify',
		metadata: { userId, credentialId: credential.id, deviceType: credentialDeviceType }
	});

	return json({ verified: true });
};
