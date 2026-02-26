import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { getCredential, updateCounter, getUser } from '$lib/server/store.js';
import { createSession } from '$lib/server/session.js';
import { log } from '$lib/server/logger.js';

export const POST: RequestHandler = async ({ request, cookies, url }) => {
	const body = await request.json();

	const expectedChallenge = cookies.get('webauthn_challenge');
	if (!expectedChallenge) {
		throw error(400, 'No pending authentication challenge');
	}

	const passkey = getCredential(body.id);
	if (!passkey) {
		throw error(400, 'Passkey not found');
	}

	const rpID = url.hostname;
	const origin = url.origin;

	const credentialData = {
		id: passkey.id,
		publicKey: new Uint8Array(passkey.publicKey),
		counter: passkey.counter,
		transports: passkey.transports as AuthenticatorTransport[]
	};

	let verification;
	try {
		verification = await verifyAuthenticationResponse({
			response: body,
			expectedChallenge,
			expectedOrigin: origin,
			expectedRPID: rpID,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			credential: credentialData as any
		});
	} catch (err) {
		console.error('Authentication verification failed:', err);
		throw error(400, err instanceof Error ? err.message : 'Verification failed');
	}

	cookies.delete('webauthn_challenge', { path: '/' });

	if (!verification.verified) {
		return json({ verified: false });
	}

	await updateCounter(passkey.id, verification.authenticationInfo.newCounter);
	createSession(cookies, passkey.userId);

	const user = getUser(passkey.userId);
	log(url.hostname, 'info', `User authenticated: ${user?.username ?? passkey.userId}`, {
		path: '/api/auth/login/verify',
		metadata: { userId: passkey.userId, credentialId: passkey.id }
	});

	return json({ verified: true, userId: passkey.userId });
};
