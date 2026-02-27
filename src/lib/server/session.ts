import { createHmac } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { dev } from '$app/environment';

const SECRET = process.env.SESSION_SECRET || 'dev-passkey-secret-change-in-production';
const COOKIE_NAME = 'passkey_session';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function sign(payload: string): string {
	return createHmac('sha256', SECRET).update(payload).digest('base64url');
}

export function createSession(cookies: Cookies, userId: string): void {
	const expiresAt = Math.floor(Date.now() / 1000) + MAX_AGE;
	const payload = `${userId}.${expiresAt}`;
	const signature = sign(payload);
	cookies.set(COOKIE_NAME, `${payload}.${signature}`, {
		httpOnly: true,
		secure: !dev,
		sameSite: 'strict',
		path: '/',
		maxAge: MAX_AGE
	});
}

export function getSession(cookies: Cookies): { userId: string } | null {
	const value = cookies.get(COOKIE_NAME);
	if (!value) return null;

	const lastDot = value.lastIndexOf('.');
	if (lastDot === -1) return null;

	const payload = value.substring(0, lastDot);
	const signature = value.substring(lastDot + 1);

	if (sign(payload) !== signature) return null;

	const [userId, expiresAtStr] = payload.split('.');
	if (!userId || !expiresAtStr) return null;

	const expiresAt = parseInt(expiresAtStr, 10);
	if (Date.now() / 1000 > expiresAt) return null;

	return { userId };
}

export function destroySession(cookies: Cookies): void {
	cookies.delete(COOKIE_NAME, { path: '/' });
}
