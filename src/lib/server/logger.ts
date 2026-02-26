import { dev } from '$app/environment';
import { appendLog } from './blob-store.js';

export async function log(
	site: string,
	level: 'debug' | 'info' | 'warn' | 'error',
	message: string,
	extra?: { path?: string; userAgent?: string; ip?: string; metadata?: Record<string, unknown> }
): Promise<void> {
	if (dev) {
		console.log(`[${level.toUpperCase()}] ${site}: ${message}`);
		return;
	}
	try {
		await appendLog({
			site,
			level,
			message,
			timestamp: new Date().toISOString(),
			...extra
		});
	} catch {
		console.error(`Failed to persist log: ${message}`);
	}
}
