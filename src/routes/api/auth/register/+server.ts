import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { dev } from '$app/environment';
import { getUserByUsername, createUser, getCredentialsByUser } from '$lib/server/store.js';
import { randomBytes } from 'node:crypto';
import { log } from '$lib/server/logger.js';

export const POST: RequestHandler = async ({ request, cookies, url }) => {

	const { username } = await request.json();
	log(url.hostname, 'info', `Enrollment attempt for: ${username}`, { path: '/api/auth/register' });
	if (!username || typeof username !== 'string' || username.trim().length < 1) {
		throw error(400, 'Username is required');
	}

	const trimmed = username.trim().toLowerCase();

	// Find or create user
	let user = getUserByUsername(trimmed);
	if (!user) {
		const id = randomBytes(16).toString('hex');
		user = await createUser(id, trimmed);
	}

	// Get existing credentials to exclude
	const existingCreds = getCredentialsByUser(user.id);

	const rpID = url.hostname;
	const rpName = 'Passkey Gate';

	const options = await generateRegistrationOptions({
		rpName,
		rpID,
		userName: user.username,
		userDisplayName: user.username,
		attestationType: 'none',
		excludeCredentials: existingCreds.map((c) => ({
			id: c.id,
			transports: c.transports as AuthenticatorTransport[]
		})),
		authenticatorSelection: {
			authenticatorAttachment: 'platform',
			residentKey: 'preferred',
			userVerification: 'preferred'
		}
	});

	// Store challenge in a cookie (stateless, works on serverless)
	cookies.set('webauthn_challenge', options.challenge, {
		httpOnly: true,
		secure: !dev,
		sameSite: 'strict',
		maxAge: 300,
		path: '/'
	});

	// Store user ID for the verify step
	cookies.set('webauthn_user_id', user.id, {
		httpOnly: true,
		secure: !dev,
		sameSite: 'strict',
		maxAge: 300,
		path: '/'
	});

	return json(options);
};
