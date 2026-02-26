<script lang="ts">
	import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

	let { data } = $props();

	let username = $state('');
	let status = $state<'idle' | 'loading' | 'success' | 'error'>('idle');
	let statusMessage = $state('');
	let logLines = $state<Array<{ text: string; type: string }>>([]);
	let credentials = $state<Array<{
		id: string;
		deviceType: string;
		backedUp: boolean;
		transports: string[];
		createdAt: number;
		lastUsedAt: number | null;
	}>>([]);

	function log(text: string, type: string = 'info') {
		logLines = [...logLines, { text, type }];
	}

	function clearLog() {
		logLines = [];
	}

	async function loadCredentials() {
		if (!data.user) return;
		try {
			const resp = await fetch('/api/credentials');
			if (resp.ok) {
				credentials = await resp.json();
			}
		} catch {
			// silently fail
		}
	}

	// Load credentials on mount if authenticated
	$effect(() => {
		if (data.user) {
			loadCredentials();
		}
	});

	async function handleRegister() {
		if (!username.trim()) {
			statusMessage = 'Username required';
			status = 'error';
			return;
		}

		status = 'loading';
		clearLog();
		log('Requesting registration options...', 'info');

		try {
			const optionsResp = await fetch('/api/auth/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username: username.trim() })
			});

			if (!optionsResp.ok) {
				const err = await optionsResp.json();
				throw new Error(err.message || 'Failed to get registration options');
			}

			const optionsJSON = await optionsResp.json();
			log('Options received. Waiting for authenticator...', 'info');

			const attResp = await startRegistration({ optionsJSON });
			log('Authenticator response received. Verifying...', 'info');

			const verifyResp = await fetch('/api/auth/register/verify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(attResp)
			});

			const result = await verifyResp.json();

			if (result.verified) {
				log('Passkey registered successfully.', 'success');
				status = 'success';
				statusMessage = 'Passkey enrolled. Reloading...';
				setTimeout(() => window.location.reload(), 800);
			} else {
				throw new Error('Verification failed');
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Registration failed';
			log(`Error: ${msg}`, 'error');
			status = 'error';
			statusMessage = msg;
		}
	}

	async function handleLogin() {
		status = 'loading';
		clearLog();
		log('Requesting authentication options...', 'info');

		try {
			const optionsResp = await fetch('/api/auth/login', {
				method: 'POST'
			});

			if (!optionsResp.ok) {
				const err = await optionsResp.json();
				throw new Error(err.message || 'Failed to get login options');
			}

			const optionsJSON = await optionsResp.json();
			log('Options received. Waiting for authenticator...', 'info');

			const asseResp = await startAuthentication({ optionsJSON });
			log('Authenticator response received. Verifying...', 'info');

			const verifyResp = await fetch('/api/auth/login/verify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(asseResp)
			});

			const result = await verifyResp.json();

			if (result.verified) {
				log('Authentication successful.', 'success');
				status = 'success';
				statusMessage = 'Authenticated. Reloading...';
				setTimeout(() => window.location.reload(), 500);
			} else {
				throw new Error('Authentication failed');
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Login failed';
			log(`Error: ${msg}`, 'error');
			status = 'error';
			statusMessage = msg;
		}
	}

	async function handleLogout() {
		await fetch('/api/auth/logout', { method: 'POST' });
		window.location.reload();
	}

	async function handleDeleteCredential(id: string) {
		if (!confirm('Delete this passkey?')) return;
		try {
			const resp = await fetch('/api/credentials', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id })
			});
			if (resp.ok) {
				await loadCredentials();
			}
		} catch {
			// silently fail
		}
	}

	async function handleExport() {
		log('To export credentials for deployment, run:', 'info');
		log('  bun run export', 'success');
		log('Then commit and deploy to Vercel.', 'info');
	}

	function truncateId(id: string): string {
		if (id.length <= 16) return id;
		return id.substring(0, 8) + '...' + id.substring(id.length - 8);
	}

	function formatDate(ts: number): string {
		if (!ts) return 'never';
		return new Date(ts * 1000).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}
</script>

<div class="container">
	{#if !data.user}
		<!-- LOCK SCREEN -->
		<div class="hero">
			<div class="hero-icon">[LOCKED]</div>
			<h1>PASSKEY//GATE</h1>
			<p class="text-muted text-sm">Authenticate with your passkey to continue</p>

			<div class="auth-actions mt-lg">
				<button class="primary" onclick={handleLogin} disabled={status === 'loading'}>
					{status === 'loading' ? 'AUTHENTICATING...' : 'AUTHENTICATE'}
				</button>

				{#if data.isDev}
					<div class="register-section mt-lg">
						<div class="panel">
							<div class="panel-header">ENROLL NEW PASSKEY</div>
							<div class="panel-body">
								<div class="input-row">
									<input
										type="text"
										bind:value={username}
										placeholder="username"
										onkeydown={(e) => e.key === 'Enter' && handleRegister()}
									/>
									<button onclick={handleRegister} disabled={status === 'loading'}>
										ENROLL
									</button>
								</div>
							</div>
						</div>
					</div>
				{/if}
			</div>
		</div>
	{:else}
		<!-- AUTHENTICATED: SETTINGS -->
		<div class="settings">
			<div class="settings-header">
				<h2>SETTINGS</h2>
				<button onclick={handleLogout}>LOGOUT</button>
			</div>

			<!-- Enrolled Credentials -->
			<div class="panel mt-md">
				<div class="panel-header">
					ENROLLED PASSKEYS ({credentials.length})
				</div>
				<div class="panel-body">
					{#if credentials.length === 0}
						<p class="text-muted text-sm">No passkeys enrolled yet.</p>
					{:else}
						<table class="data-table">
							<thead>
								<tr>
									<th>ID</th>
									<th>TYPE</th>
									<th>CREATED</th>
									{#if data.isDev}
										<th></th>
									{/if}
								</tr>
							</thead>
							<tbody>
								{#each credentials as cred}
									<tr>
										<td>
											<code class="text-xs">{truncateId(cred.id)}</code>
										</td>
										<td>
											<span class="badge badge-info">{cred.deviceType}</span>
											{#if cred.backedUp}
												<span class="badge badge-success">SYNCED</span>
											{/if}
										</td>
										<td class="text-xs text-muted">{formatDate(cred.createdAt)}</td>
										{#if data.isDev}
											<td>
												<button
													class="danger"
													style="font-size:0.65rem;padding:0.2rem 0.4rem"
													onclick={() => handleDeleteCredential(cred.id)}
												>
													DELETE
												</button>
											</td>
										{/if}
									</tr>
								{/each}
							</tbody>
						</table>
					{/if}
				</div>
			</div>

			{#if data.isDev}
				<!-- Register Another -->
				<div class="panel mt-md">
					<div class="panel-header">ENROLL ANOTHER PASSKEY</div>
					<div class="panel-body">
						<div class="input-row">
							<input
								type="text"
								bind:value={username}
								placeholder="username"
								onkeydown={(e) => e.key === 'Enter' && handleRegister()}
							/>
							<button onclick={handleRegister} disabled={status === 'loading'}>
								ENROLL
							</button>
						</div>
					</div>
				</div>

				<!-- Export -->
				<div class="panel mt-md">
					<div class="panel-header">DEPLOY TO VERCEL</div>
					<div class="panel-body">
						<p class="text-sm text-muted mb-sm">
							Export enrolled credentials for read-only deployment.
							After export, commit and push to deploy.
						</p>
						<button onclick={handleExport}>EXPORT CREDENTIALS</button>
					</div>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Status / Log -->
	{#if logLines.length > 0}
		<div class="terminal-log mt-lg">
			{#each logLines as line}
				<div class="log-line {line.type}">{line.text}</div>
			{/each}
		</div>
	{/if}

	{#if statusMessage && status === 'error'}
		<div class="status-bar error mt-sm">
			{statusMessage}
		</div>
	{/if}
</div>

<style>
	.hero {
		text-align: center;
		margin-top: 20vh;
	}

	.hero-icon {
		font-size: 1rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		color: var(--color-text-muted);
		margin-bottom: var(--spacing-sm);
	}

	.hero h1 {
		letter-spacing: 0.15em;
		margin-bottom: var(--spacing-xs);
	}

	.auth-actions {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-md);
	}

	.auth-actions button.primary {
		padding: 0.6rem 2rem;
		font-size: 0.9rem;
	}

	.register-section {
		width: 100%;
		max-width: 400px;
	}

	.input-row {
		display: flex;
		gap: var(--spacing-sm);
	}

	.input-row input {
		flex: 1;
	}

	.settings-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--spacing-md);
	}

	.settings-header h2 {
		letter-spacing: 0.1em;
	}

	.status-bar {
		font-family: var(--font-mono);
		font-size: 0.8rem;
		padding: var(--spacing-sm) var(--spacing-md);
		border: 1px solid;
	}

	.status-bar.error {
		background: var(--color-error-bg);
		border-color: var(--color-error);
		color: var(--color-error);
	}

	code {
		font-family: var(--font-mono);
	}

	@media (max-width: 480px) {
		.hero {
			margin-top: 10vh;
		}

		.input-row {
			flex-direction: column;
		}
	}
</style>
