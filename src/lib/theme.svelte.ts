let darkMode = $state(false);

export function initTheme(): void {
	if (typeof window === 'undefined') return;
	const stored = localStorage.getItem('passkey-settings');
	if (stored) {
		try {
			darkMode = JSON.parse(stored)?.darkMode ?? false;
		} catch {
			darkMode = false;
		}
	}
	applyTheme();
}

export function toggleTheme(): void {
	darkMode = !darkMode;
	applyTheme();
	persistTheme();
}

export function isDarkMode(): boolean {
	return darkMode;
}

function applyTheme(): void {
	if (typeof document === 'undefined') return;
	document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
}

function persistTheme(): void {
	if (typeof window === 'undefined') return;
	try {
		const stored = localStorage.getItem('passkey-settings');
		const data = stored ? JSON.parse(stored) : {};
		data.darkMode = darkMode;
		localStorage.setItem('passkey-settings', JSON.stringify(data));
	} catch {
		// Silently fail
	}
}
