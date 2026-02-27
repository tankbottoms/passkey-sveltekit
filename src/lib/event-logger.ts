interface DeviceContext {
	browser: string;
	os: string;
	deviceType: string;
	screenSize: string;
	language: string;
}

interface ClientEvent {
	event: string;
	sessionId: string;
	timestamp: string;
	url: string;
	data?: Record<string, unknown>;
	device?: DeviceContext;
}

let sessionId: string | null = null;
let deviceContext: DeviceContext | null = null;
let buffer: ClientEvent[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
let initialized = false;

function getSessionId(): string {
	if (sessionId) return sessionId;
	const stored = sessionStorage.getItem('_ev_sid');
	if (stored) {
		sessionId = stored;
		return stored;
	}
	const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
	sessionStorage.setItem('_ev_sid', id);
	sessionId = id;
	return id;
}

function parseUA(): DeviceContext {
	if (deviceContext) return deviceContext;

	const ua = navigator.userAgent;

	let browser = 'other';
	if (ua.includes('Edg/')) browser = 'Edge';
	else if (ua.includes('Chrome/')) browser = 'Chrome';
	else if (ua.includes('Safari/') && !ua.includes('Chrome')) browser = 'Safari';
	else if (ua.includes('Firefox/')) browser = 'Firefox';

	let os = 'other';
	if (ua.includes('Mac OS X') || ua.includes('Macintosh')) os = 'macOS';
	else if (ua.includes('Windows')) os = 'Windows';
	else if (ua.includes('Android')) os = 'Android';
	else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
	else if (ua.includes('Linux')) os = 'Linux';

	let deviceType = 'desktop';
	if (/Mobi|Android.*Mobile|iPhone|iPod/.test(ua)) deviceType = 'mobile';
	else if (/iPad|Android(?!.*Mobile)|Tablet/.test(ua)) deviceType = 'tablet';

	deviceContext = {
		browser,
		os,
		deviceType,
		screenSize: `${screen.width}x${screen.height}`,
		language: navigator.language
	};
	return deviceContext;
}

function flush() {
	if (buffer.length === 0) return;
	const events = buffer.splice(0);
	const body = JSON.stringify(events);

	if (typeof navigator.sendBeacon === 'function' && document.visibilityState === 'hidden') {
		navigator.sendBeacon('/api/events', new Blob([body], { type: 'application/json' }));
		return;
	}

	fetch('/api/events', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body,
		keepalive: true
	}).catch(() => {
		// silently drop
	});
}

export function trackEvent(event: string, data?: Record<string, unknown>) {
	if (!initialized) return;
	buffer.push({
		event,
		sessionId: getSessionId(),
		timestamp: new Date().toISOString(),
		url: location.pathname,
		data,
		device: parseUA()
	});
}

export function initEventLogger() {
	if (initialized) return;
	initialized = true;

	flushTimer = setInterval(() => {
		if (buffer.length > 0) flush();
	}, 10_000);

	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden') flush();
	});
}

export function destroyEventLogger() {
	if (flushTimer) clearInterval(flushTimer);
	flush();
	initialized = false;
}
